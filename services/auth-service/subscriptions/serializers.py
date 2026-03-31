from rest_framework import serializers

from .models import Subscription, SubscriptionPlan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'name', 'price_monthly', 'price_yearly', 'features', 'created_at']
        read_only_fields = ['id', 'created_at']


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)

    class Meta:
        model = Subscription
        fields = ['id', 'user', 'plan', 'status', 'start_date', 'end_date', 'auto_renew', 'created_at']
        read_only_fields = ['id', 'start_date', 'created_at']
