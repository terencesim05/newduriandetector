import random
import string

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Team
from .serializers import TeamSerializer


def _generate_pin(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Team.objects.filter(
            members=self.request.user,
        ) | Team.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='regenerate_pin')
    def regenerate_pin(self, request, pk=None):
        team = self.get_object()

        # Only the team leader can regenerate
        if team.created_by != request.user:
            return Response(
                {'detail': 'Only the team leader can regenerate the PIN.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        pin = _generate_pin()
        while Team.objects.filter(pin=pin).exists():
            pin = _generate_pin()

        team.pin = pin
        team.save(update_fields=['pin'])

        serializer = self.get_serializer(team)
        return Response(serializer.data)
