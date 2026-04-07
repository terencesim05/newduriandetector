import random
import string

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
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

    @action(detail=False, methods=['post'], url_path='change-password', permission_classes=[IsAuthenticated])
    def change_password(self, request):
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response({'detail': 'Current password and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({'detail': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        if not request.user.check_password(current_password):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new_password)
        request.user.save()
        _log_action(request, request.user, 'password_changed', 'User changed their password')
        return Response({'detail': 'Password changed successfully.'})

    @action(detail=False, methods=['post'], url_path='password-reset/request', permission_classes=[AllowAny])
    def password_reset_request(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Always respond 200 to avoid leaking which emails exist
        generic_response = Response(
            {'detail': 'If an account with that email exists, a reset link has been sent.'}
        )

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return generic_response

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"

        subject = 'Reset your DurianDetector password'
        body = (
            f"Hi {user.first_name or user.username},\n\n"
            f"We received a request to reset your DurianDetector password. "
            f"Click the link below to set a new password. This link will expire in 3 days.\n\n"
            f"{reset_link}\n\n"
            f"If you didn't request this, you can safely ignore this email.\n"
        )

        try:
            send_mail(
                subject,
                body,
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=False,
            )
            _log_action(request, user, 'password_reset_requested', 'Password reset email sent')
        except Exception as e:
            return Response(
                {'detail': f'Failed to send reset email: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return generic_response

    @action(detail=False, methods=['post'], url_path='password-reset/confirm', permission_classes=[AllowAny])
    def password_reset_confirm(self, request):
        uid = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        if not uid or not token or not new_password:
            return Response(
                {'detail': 'uid, token, and new_password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {'detail': 'New password must be at least 8 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_pk = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_pk)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response(
                {'detail': 'Reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save()
        _log_action(request, user, 'password_reset_completed', 'Password reset via email link')
        return Response({'detail': 'Password has been reset successfully.'})

    @action(detail=False, methods=['get', 'patch'], permission_classes=[IsAuthenticated])
    def me(self, request):
        if request.method == 'GET':
            serializer = UserSerializer(request.user)
            return Response(serializer.data)
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
