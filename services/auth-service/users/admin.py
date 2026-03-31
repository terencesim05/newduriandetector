from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'tier', 'subscription_status', 'is_active']
    list_filter = ['tier', 'subscription_status', 'is_active', 'is_staff']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Subscription Info', {'fields': ('tier', 'team', 'subscription_status')}),
    )
