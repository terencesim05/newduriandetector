from rest_framework import serializers

from .models import Team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name', 'pin', 'created_at', 'created_by']
        read_only_fields = ['id', 'created_at', 'created_by']
