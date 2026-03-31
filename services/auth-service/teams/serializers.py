from rest_framework import serializers

from .models import Team


class TeamMemberSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    is_team_leader = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class TeamSerializer(serializers.ModelSerializer):
    members = TeamMemberSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'pin', 'created_at', 'created_by', 'members', 'member_count']
        read_only_fields = ['id', 'created_at', 'created_by']

    def get_member_count(self, obj):
        return obj.members.count()
