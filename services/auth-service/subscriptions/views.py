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
        subscription = Subscription.objects.filter(
            user=request.user, status='active',
        ).select_related('plan').first()
        if not subscription:
            return Response({'detail': 'No active subscription found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SubscriptionSerializer(subscription)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def upgrade(self, request):
        tier = request.data.get('tier')
        plan_id = request.data.get('plan_id')

        valid_tiers = {'free': 'FREE', 'premium': 'PREMIUM', 'exclusive': 'EXCLUSIVE'}

        if tier:
            new_tier = valid_tiers.get(tier.lower())
            if not new_tier:
                return Response({'detail': 'Invalid tier.'}, status=status.HTTP_400_BAD_REQUEST)
        elif plan_id:
            try:
                plan = SubscriptionPlan.objects.get(id=plan_id)
            except SubscriptionPlan.DoesNotExist:
                return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)
            tier_map = {'Free': 'FREE', 'Premium': 'PREMIUM', 'Exclusive': 'EXCLUSIVE'}
            new_tier = tier_map.get(plan.name, 'FREE')
        else:
            return Response({'detail': 'tier or plan_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        old_tier = request.user.tier
        if old_tier == new_tier:
            return Response({'detail': 'You are already on this plan.'}, status=status.HTTP_400_BAD_REQUEST)

        # Update user tier
        request.user.tier = new_tier
        request.user.subscription_status = 'active'
        request.user.save(update_fields=['tier', 'subscription_status'])

        # Update subscription records if the tables exist
        try:
            Subscription.objects.filter(user=request.user, status='active').update(status='cancelled')
            plan_name_map = {'FREE': 'Free', 'PREMIUM': 'Premium', 'EXCLUSIVE': 'Exclusive'}
            plan = SubscriptionPlan.objects.filter(name=plan_name_map.get(new_tier)).first()
            if plan:
                Subscription.objects.create(user=request.user, plan=plan)
        except Exception:
            pass  # subscriptions table may not exist yet

        # If downgraded from EXCLUSIVE, handle team cleanup
        if old_tier == 'EXCLUSIVE' and new_tier != 'EXCLUSIVE':
            handle_tier_downgrade_from_exclusive(request.user)
        # If upgraded to EXCLUSIVE, create team and make leader
        elif new_tier == 'EXCLUSIVE' and old_tier != 'EXCLUSIVE':
            handle_tier_upgrade_to_exclusive(request.user)

        return Response({'detail': 'Tier updated successfully.', 'tier': new_tier}, status=status.HTTP_200_OK)
