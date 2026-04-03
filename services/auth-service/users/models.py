from django.contrib.auth.models import AbstractUser
from django.db import models


class AuditLog(models.Model):
    """Tracks admin and important user actions for platform auditing."""
    user_id = models.IntegerField()
    user_email = models.EmailField()
    action = models.CharField(max_length=50)
    details = models.TextField(blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user_email} — {self.action} at {self.timestamp}"


class User(AbstractUser):
    TIER_CHOICES = [
        ('FREE', 'Free'),
        ('PREMIUM', 'Premium'),
        ('EXCLUSIVE', 'Exclusive'),
    ]

    tier = models.CharField(max_length=10, choices=TIER_CHOICES, default='FREE')
    team = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='members',
    )
    is_team_leader = models.BooleanField(default=False)
    subscription_status = models.CharField(max_length=20, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email or self.username
