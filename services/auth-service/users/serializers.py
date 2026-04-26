from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


def _get_subscription_info(user):
    """Get the user's active/pending subscription status and end date.
    For EXCLUSIVE team members, use the team leader's subscription."""
    from subscriptions.models import Subscription

    # Free users don't need subscriptions
    if user.tier == 'FREE' or user.is_superuser:
        return 'active', None

    # For EXCLUSIVE team members (non-leaders), check the leader's subscription
    lookup_user = user
    if user.tier == 'EXCLUSIVE' and user.team_id and not user.is_team_leader:
        leader = User.objects.filter(team_id=user.team_id, is_team_leader=True).first()
        if leader:
            lookup_user = leader

    sub = Subscription.objects.filter(
        user=lookup_user, status__in=['active', 'pending']
    ).order_by('-created_at').first()

    if not sub:
        # No subscription record — treat as expired for paid tiers
        return 'expired', None

    # Refresh status based on current time
    sub.refresh_status()
    end_date = sub.end_date.isoformat() if sub.end_date else None
    return sub.status, end_date


def _add_custom_claims(refresh, user):
    """Add tier, team_id, user_name, subscription info to both access and refresh tokens."""
    refresh["tier"] = user.tier or "FREE"
    refresh["team_id"] = str(user.team_id) if user.team_id else None
    refresh["user_name"] = f"{user.first_name} {user.last_name}".strip() or user.email
    refresh["is_team_leader"] = user.is_team_leader
    refresh["is_superuser"] = user.is_superuser

    sub_status, sub_end_date = _get_subscription_info(user)
    refresh["subscription_status"] = sub_status
    refresh["subscription_end_date"] = sub_end_date

    # Also update the user model's subscription_status field
    if user.subscription_status != sub_status:
        user.subscription_status = sub_status
        user.save(update_fields=['subscription_status'])

    return refresh


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'tier', 'is_team_leader', 'is_superuser', 'team', 'subscription_status', 'created_at']
        read_only_fields = ['id', 'created_at']


class AdminUserSerializer(serializers.ModelSerializer):
    """Serializer for admin views — includes all user fields."""
    class Meta:
        model = User
        fields = ['id', 'email', 'username', 'first_name', 'last_name', 'tier', 'is_team_leader',
                  'is_superuser', 'team', 'subscription_status', 'is_active', 'date_joined', 'created_at']
        read_only_fields = ['id', 'date_joined', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    email = serializers.EmailField(
        validators=[UniqueValidator(
            queryset=User.objects.all(),
            message="A user with this email already exists.",
        )]
    )

    class Meta:
        model = User
        fields = ['email', 'username', 'password', 'first_name', 'last_name', 'tier']

    def create(self, validated_data):
        tier = validated_data.pop('tier', 'FREE')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        user.tier = tier
        user.save(update_fields=['tier'])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled.')
        refresh = _add_custom_claims(RefreshToken.for_user(user), user)
        return {
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        }
