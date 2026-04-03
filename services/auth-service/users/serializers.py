from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


def _add_custom_claims(refresh, user):
    """Add tier, team_id, user_name, and is_superuser to both access and refresh tokens."""
    refresh["tier"] = user.tier or "FREE"
    refresh["team_id"] = str(user.team_id) if user.team_id else None
    refresh["user_name"] = f"{user.first_name} {user.last_name}".strip() or user.email
    refresh["is_team_leader"] = user.is_team_leader
    refresh["is_superuser"] = user.is_superuser
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
