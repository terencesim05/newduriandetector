import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone


class SubscriptionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2)
    features = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscription_plans'

    def __str__(self):
        return self.name


class Subscription(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),       # Before start_date
        ('active', 'Active'),         # Between start_date and end_date
        ('expired', 'Expired'),       # Past end_date
        ('cancelled', 'Cancelled'),
    ]

    DURATION_CHOICES = [
        (1, '1 Month'),
        (3, '3 Months'),
        (6, '6 Months'),
        (12, '12 Months'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE, related_name='subscriptions', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    duration_months = models.IntegerField(choices=DURATION_CHOICES, default=1)
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscriptions'

    def __str__(self):
        return f"{self.user} - {self.get_status_display()} ({self.start_date.date()} → {self.end_date.date()})"

    def save(self, *args, **kwargs):
        # Auto-compute end_date from start_date + duration
        if self.start_date and self.duration_months and not self.end_date:
            self.end_date = self.start_date + timedelta(days=30 * self.duration_months)
        super().save(*args, **kwargs)

    def refresh_status(self):
        """Update status based on current time. Returns True if status changed."""
        now = timezone.now()
        old_status = self.status
        if self.status == 'cancelled':
            return False
        if now < self.start_date:
            self.status = 'pending'
        elif now > self.end_date:
            self.status = 'expired'
        else:
            self.status = 'active'
        if self.status != old_status:
            self.save(update_fields=['status'])
            return True
        return False
