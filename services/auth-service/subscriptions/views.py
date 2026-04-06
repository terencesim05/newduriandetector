from datetime import timedelta

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Subscription, SubscriptionPlan
from .serializers import SubscriptionPlanSerializer, SubscriptionSerializer
from users.team_utils import handle_tier_downgrade_from_exclusive, handle_tier_upgrade_to_exclusive


class SubscriptionViewSet(viewsets.GenericViewSet):
    queryset = Subscription.objects.all()

    def get_serializer_class(self):
        if self.action == 'plans':
            return SubscriptionPlanSerializer
        return SubscriptionSerializer

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def plans(self, request):
        plans = SubscriptionPlan.objects.all()
        serializer = SubscriptionPlanSerializer(plans, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-subscription', permission_classes=[IsAuthenticated])
    def my_subscription(self, request):
        user = request.user

        # For EXCLUSIVE team members, look up the leader's subscription
        lookup_user = user
        if user.tier == 'EXCLUSIVE' and user.team_id and not user.is_team_leader:
            from users.models import User
            leader = User.objects.filter(team_id=user.team_id, is_team_leader=True).first()
            if leader:
                lookup_user = leader

        subscription = Subscription.objects.filter(
            user=lookup_user,
        ).order_by('-created_at').first()

        if not subscription:
            return Response({
                'subscription': None,
                'tier': user.tier,
            })

        # Refresh status based on current time
        subscription.refresh_status()
        serializer = SubscriptionSerializer(subscription)
        return Response({
            'subscription': serializer.data,
            'tier': user.tier,
        })

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def upgrade(self, request):
        tier = request.data.get('tier')
        duration_months = request.data.get('duration_months', 1)

        valid_tiers = {'free': 'FREE', 'premium': 'PREMIUM', 'exclusive': 'EXCLUSIVE'}
        valid_durations = [1, 3, 6, 12]

        if not tier:
            return Response({'detail': 'tier is required.'}, status=status.HTTP_400_BAD_REQUEST)

        new_tier = valid_tiers.get(tier.lower())
        if not new_tier:
            return Response({'detail': 'Invalid tier.'}, status=status.HTTP_400_BAD_REQUEST)

        old_tier = request.user.tier

        # Validate duration for paid tiers
        if new_tier != 'FREE':
            try:
                duration_months = int(duration_months)
            except (TypeError, ValueError):
                duration_months = 1
            if duration_months not in valid_durations:
                return Response({'detail': 'Invalid duration. Choose 1, 3, 6, or 12 months.'}, status=status.HTTP_400_BAD_REQUEST)

            # Subscription always starts now
            start_date = timezone.now()
            end_date = start_date + timedelta(days=30 * duration_months)
            sub_status = 'active'
        else:
            sub_status = 'active'

        # Update user tier
        request.user.tier = new_tier
        request.user.subscription_status = sub_status
        request.user.save(update_fields=['tier', 'subscription_status'])

        # Cancel existing subscriptions
        Subscription.objects.filter(
            user=request.user, status__in=['active', 'pending']
        ).update(status='cancelled')

        # Create subscription for paid tiers
        if new_tier != 'FREE':
            plan_name_map = {'PREMIUM': 'Premium', 'EXCLUSIVE': 'Exclusive'}
            plan = SubscriptionPlan.objects.filter(name=plan_name_map.get(new_tier)).first()

            Subscription.objects.create(
                user=request.user,
                plan=plan,
                status='active',
                duration_months=duration_months,
                start_date=start_date,
                end_date=end_date,
            )

        # Handle team side effects
        if old_tier == 'EXCLUSIVE' and new_tier != 'EXCLUSIVE':
            handle_tier_downgrade_from_exclusive(request.user)
        elif new_tier == 'EXCLUSIVE' and old_tier != 'EXCLUSIVE':
            handle_tier_upgrade_to_exclusive(request.user)

        response_data = {
            'detail': 'Tier updated successfully.',
            'tier': new_tier,
            'subscription_status': sub_status,
        }

        if new_tier != 'FREE':
            response_data['start_date'] = start_date.isoformat()
            response_data['end_date'] = end_date.isoformat()
            response_data['duration_months'] = duration_months

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def renew(self, request):
        """Renew an expired subscription. Starts immediately."""
        duration_months = request.data.get('duration_months', 1)
        valid_durations = [1, 3, 6, 12]

        if request.user.tier == 'FREE':
            return Response({'detail': 'Free tier does not require a subscription.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            duration_months = int(duration_months)
        except (TypeError, ValueError):
            duration_months = 1
        if duration_months not in valid_durations:
            return Response({'detail': 'Invalid duration.'}, status=status.HTTP_400_BAD_REQUEST)

        start_date = timezone.now()
        end_date = start_date + timedelta(days=30 * duration_months)

        # Cancel old subscriptions
        Subscription.objects.filter(
            user=request.user, status__in=['active', 'pending', 'expired']
        ).update(status='cancelled')

        plan_name_map = {'PREMIUM': 'Premium', 'EXCLUSIVE': 'Exclusive'}
        plan = SubscriptionPlan.objects.filter(name=plan_name_map.get(request.user.tier)).first()

        Subscription.objects.create(
            user=request.user,
            plan=plan,
            status='active',
            duration_months=duration_months,
            start_date=start_date,
            end_date=end_date,
        )

        request.user.subscription_status = 'active'
        request.user.save(update_fields=['subscription_status'])

        return Response({
            'detail': 'Subscription renewed successfully.',
            'subscription_status': 'active',
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'duration_months': duration_months,
        })
