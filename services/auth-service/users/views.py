import random
import string

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AuditLog, User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer, _add_custom_claims


def _log_action(request, user, action, details=''):
    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        user_id=user.id,
        user_email=user.email,
        action=action,
        details=details,
        ip_address=ip or None,
    )


def _generate_pin(length=6):
    """Generate a random alphanumeric PIN."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


class AuthViewSet(viewsets.GenericViewSet):
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.action == 'register':
            return RegisterSerializer
        if self.action == 'login':
            return LoginSerializer
        return UserSerializer

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def register(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        tier = request.data.get('tier', 'FREE')

        # Handle Exclusive team logic
        if tier == 'EXCLUSIVE':
            from teams.models import Team

            is_leader = request.data.get('is_team_leader', False)
            team_pin = request.data.get('team_pin', '')

            if is_leader:
                # Create a new team with a generated PIN
                pin = _generate_pin()
                while Team.objects.filter(pin=pin).exists():
                    pin = _generate_pin()

                team = Team.objects.create(
                    name=f"{user.first_name or user.username}'s Team",
                    pin=pin,
                    created_by=user,
                )
                user.team = team
                user.is_team_leader = True
                user.save(update_fields=['team', 'is_team_leader'])

            elif team_pin:
                # Join an existing team via PIN
                try:
                    team = Team.objects.get(pin=team_pin)
                except Team.DoesNotExist:
                    return Response(
                        {'detail': 'Invalid team PIN. Please check with your team leader.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                # Check max 4 members (excluding the leader)
                member_count = User.objects.filter(team=team, is_team_leader=False).count()
                if member_count >= 4:
                    return Response(
                        {'detail': 'This team is full (maximum 4 members). Contact the team leader.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                user.team = team
                user.save(update_fields=['team'])

        refresh = _add_custom_claims(RefreshToken.for_user(user), user)
        _log_action(request, user, 'user_registered', f'Registered with tier {user.tier}')
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def login(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_id = data['user']['id']
        try:
            user = User.objects.get(pk=user_id)
            action_type = 'admin_login' if user.is_superuser else 'user_login'
            _log_action(request, user, action_type, f'Logged in')
        except User.DoesNotExist:
            pass
        return Response(data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass
        return Response({'detail': 'Successfully logged out.'})

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.method == 'GET':
            serializer = UserSerializer(request.user)
            return Response(serializer.data)
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
