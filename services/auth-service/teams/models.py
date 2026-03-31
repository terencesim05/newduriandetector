import uuid

from django.db import models


class Team(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    pin = models.CharField(max_length=6, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'users.User', on_delete=models.CASCADE, related_name='created_teams',
    )

    class Meta:
        db_table = 'teams'

    def __str__(self):
        return self.name
