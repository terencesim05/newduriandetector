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
        plan_id = request.data.get('plan_id')
        if not plan_id:
            return Response({'detail': 'plan_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Plan not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Cancel existing active subscriptions
        Subscription.objects.filter(user=request.user, status='active').update(status='cancelled')

        # Create new subscription
        subscription = Subscription.objects.create(user=request.user, plan=plan)

        # Update user tier based on plan name
        tier_map = {'Free': 'FREE', 'Premium': 'PREMIUM', 'Exclusive': 'EXCLUSIVE'}
        old_tier = request.user.tier
        new_tier = tier_map.get(plan.name, 'FREE')
        request.user.tier = new_tier
        request.user.subscription_status = 'active'
        request.user.save(update_fields=['tier', 'subscription_status'])

        # If downgraded from EXCLUSIVE, handle team cleanup
        if old_tier == 'EXCLUSIVE' and new_tier != 'EXCLUSIVE':
            handle_tier_downgrade_from_exclusive(request.user)
        # If upgraded to EXCLUSIVE, create team and make leader
        elif new_tier == 'EXCLUSIVE' and old_tier != 'EXCLUSIVE':
            handle_tier_upgrade_to_exclusive(request.user)

        serializer = SubscriptionSerializer(subscription)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
