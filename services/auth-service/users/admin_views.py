from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from subscriptions.models import Subscription
from teams.models import Team
from .models import AuditLog, User
from .serializers import AdminUserSerializer
from .team_utils import handle_tier_downgrade_from_exclusive, handle_tier_upgrade_to_exclusive


def _log_action(request, action, details='', target_user=None):
    """Helper to create an audit log entry."""
    ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        user_id=request.user.id,
        user_email=request.user.email,
        action=action,
        details=details,
        ip_address=ip or None,
    )


class IsAdminPermission(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_superuser


class AdminViewSet(viewsets.GenericViewSet):
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsAdminPermission]

    # ── Dashboard stats ──────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def stats(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        users = User.objects.filter(is_superuser=False)

        total_users = users.count()
        active_users = users.filter(is_active=True).count()
        suspended_users = users.filter(is_active=False).count()

        tier_counts = dict(
            users.values_list('tier').annotate(count=Count('id')).values_list('tier', 'count')
        )

        premium_count = tier_counts.get('PREMIUM', 0)
        exclusive_teams = Team.objects.count()
        active_subs = premium_count + exclusive_teams
        monthly_revenue = (premium_count * 49) + (exclusive_teams * 199)

        new_users_month = users.filter(created_at__gte=month_start).count()
        new_users_today = users.filter(created_at__gte=today_start).count()

        return Response({
            'total_users': total_users,
            'active_users': active_users,
            'suspended_users': suspended_users,
            'tier_breakdown': {
                'FREE': tier_counts.get('FREE', 0),
                'PREMIUM': premium_count,
                'EXCLUSIVE': tier_counts.get('EXCLUSIVE', 0),
            },
            'active_subscriptions': active_subs,
            'revenue_this_month': float(monthly_revenue),
            'new_users_month': new_users_month,
            'new_users_today': new_users_today,
        })

    # ── User management ──────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def users(self, request):
        qs = User.objects.filter(is_superuser=False).order_by('-created_at')

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(username__icontains=search))

        tier = request.query_params.get('tier', '').upper()
        if tier in ('FREE', 'PREMIUM', 'EXCLUSIVE'):
            qs = qs.filter(tier=tier)

        status_filter = request.query_params.get('status', '').lower()
        if status_filter == 'suspended':
            qs = qs.filter(is_active=False)
        elif status_filter == 'active':
            qs = qs.filter(is_active=True)

        page = int(request.query_params.get('page', 1))
        per_page = int(request.query_params.get('per_page', 50))
        total = qs.count()
        offset = (page - 1) * per_page
        users = qs[offset:offset + per_page]

        return Response({
            'users': AdminUserSerializer(users, many=True).data,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page,
        })

    @action(detail=True, methods=['get'])
    def user_detail(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = AdminUserSerializer(user).data

        sub = Subscription.objects.filter(user=user, status='active').select_related('plan').first()
        if sub:
            data['subscription'] = {
                'plan': sub.plan.name,
                'price_monthly': float(sub.plan.price_monthly),
                'start_date': sub.start_date.isoformat(),
                'auto_renew': sub.auto_renew,
            }
        else:
            data['subscription'] = None

        return Response(data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.is_superuser:
            return Response({'detail': 'Cannot suspend an admin user.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = False
        user.save(update_fields=['is_active'])
        _log_action(request, 'user_suspended', f'Suspended {user.email}')
        return Response({'detail': f'User {user.email} suspended.'})

    @action(detail=True, methods=['post'])
    def unsuspend(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        user.is_active = True
        user.save(update_fields=['is_active'])
        _log_action(request, 'user_unsuspended', f'Unsuspended {user.email}')
        return Response({'detail': f'User {user.email} unsuspended.'})

    @action(detail=True, methods=['post'])
    def change_tier(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        new_tier = request.data.get('tier', '').upper()
        if new_tier not in ('FREE', 'PREMIUM', 'EXCLUSIVE'):
            return Response({'detail': 'Invalid tier.'}, status=status.HTTP_400_BAD_REQUEST)

        old_tier = user.tier
        user.tier = new_tier
        user.save(update_fields=['tier'])

        # If downgraded from EXCLUSIVE, handle team cleanup
        if old_tier == 'EXCLUSIVE' and new_tier != 'EXCLUSIVE':
            handle_tier_downgrade_from_exclusive(user)
        # If upgraded to EXCLUSIVE, create team and make leader
        elif new_tier == 'EXCLUSIVE' and old_tier != 'EXCLUSIVE':
            handle_tier_upgrade_to_exclusive(user)

        _log_action(request, 'tier_changed', f'{user.email}: {old_tier} → {new_tier}')
        return Response({'detail': f'User {user.email} tier changed to {new_tier}.'})

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        temp_password = 'TempPass123!'
        user.set_password(temp_password)
        user.save(update_fields=['password'])
        _log_action(request, 'password_reset', f'Reset password for {user.email}')
        return Response({
            'detail': f'Password reset for {user.email}.',
            'temp_password': temp_password,
        })

    # ── Subscriptions ────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def subscriptions(self, request):
        PRICES = {'FREE': 0, 'PREMIUM': 49, 'EXCLUSIVE': 199}

        users = User.objects.filter(is_superuser=False)
        tier_counts = dict(
            users.values_list('tier').annotate(count=Count('id')).values_list('tier', 'count')
        )

        free_count = tier_counts.get('FREE', 0)
        premium_count = tier_counts.get('PREMIUM', 0)
        exclusive_teams = Team.objects.count()
        active_paid = premium_count + exclusive_teams
        monthly_revenue = (premium_count * PRICES['PREMIUM']) + (exclusive_teams * PRICES['EXCLUSIVE'])

        # Premium individual subscriptions
        ongoing = []
        premium_users = users.filter(is_active=True, tier='PREMIUM').order_by('-created_at')
        for u in premium_users:
            ongoing.append({
                'id': u.id,
                'type': 'user',
                'user_email': u.email,
                'name': f'{u.first_name} {u.last_name}'.strip() or u.username,
                'plan': 'PREMIUM',
                'price': PRICES['PREMIUM'],
                'status': 'active',
                'start_date': u.created_at.isoformat(),
            })

        # Exclusive team subscriptions
        teams = Team.objects.prefetch_related('members').order_by('-created_at')
        for team in teams:
            members = team.members.all()
            leader = members.filter(is_team_leader=True).first()
            ongoing.append({
                'id': str(team.id),
                'type': 'team',
                'user_email': leader.email if leader else '—',
                'name': team.name,
                'plan': 'EXCLUSIVE',
                'price': PRICES['EXCLUSIVE'],
                'member_count': members.count(),
                'status': 'active',
                'start_date': team.created_at.isoformat(),
            })

        return Response({
            'tier_breakdown': {
                'FREE': free_count,
                'PREMIUM': premium_count,
                'EXCLUSIVE_TEAMS': exclusive_teams,
            },
            'active_subscriptions': active_paid,
            'monthly_revenue': float(monthly_revenue),
            'ongoing_subscriptions': ongoing,
        })

    # ── Teams ────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def teams(self, request):
        teams = Team.objects.prefetch_related('members').order_by('-created_at')

        data = []
        for team in teams:
            members = team.members.all()
            leader = members.filter(is_team_leader=True).first() or team.created_by
            data.append({
                'id': str(team.id),
                'name': team.name,
                'pin': team.pin,
                'created_at': team.created_at.isoformat(),
                'leader': {
                    'id': leader.id,
                    'email': leader.email,
                    'name': f'{leader.first_name} {leader.last_name}'.strip() or leader.email,
                } if leader else None,
                'member_count': members.count(),
                'members': [
                    {
                        'id': m.id,
                        'email': m.email,
                        'name': f'{m.first_name} {m.last_name}'.strip() or m.email,
                        'is_team_leader': m.is_team_leader,
                    }
                    for m in members
                ],
            })

        return Response({
            'teams': data,
            'total': len(data),
        })

    @action(detail=True, methods=['delete'])
    def delete_team(self, request, pk=None):
        try:
            team = Team.objects.get(pk=pk)
        except Team.DoesNotExist:
            return Response({'detail': 'Team not found.'}, status=status.HTTP_404_NOT_FOUND)

        team_name = team.name
        # Remove team association from members
        User.objects.filter(team=team).update(team=None, is_team_leader=False)
        team.delete()
        _log_action(request, 'team_deleted', f'Deleted team {team_name}')
        return Response({'detail': f'Team {team_name} deleted.'})

    @action(detail=True, methods=['post'])
    def remove_member(self, request, pk=None):
        try:
            team = Team.objects.get(pk=pk)
        except Team.DoesNotExist:
            return Response({'detail': 'Team not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            member = User.objects.get(pk=user_id, team=team)
        except User.DoesNotExist:
            return Response({'detail': 'User not found in this team.'}, status=status.HTTP_404_NOT_FOUND)

        if member.is_team_leader:
            return Response({'detail': 'Cannot remove the team leader.'}, status=status.HTTP_400_BAD_REQUEST)

        member.team = None
        member.save(update_fields=['team'])
        _log_action(request, 'member_removed', f'Removed {member.email} from {team.name}')
        return Response({'detail': f'{member.email} removed from {team.name}.'})

    # ── Audit logs ───────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def audit_log(self, request):
        limit = int(request.query_params.get('limit', 100))
        logs = AuditLog.objects.all()[:limit]

        return Response([
            {
                'id': log.id,
                'user_email': log.user_email,
                'action': log.action,
                'details': log.details,
                'ip_address': log.ip_address,
                'timestamp': log.timestamp.isoformat(),
            }
            for log in logs
        ])
