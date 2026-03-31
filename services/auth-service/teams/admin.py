from django.contrib import admin

from .models import Team


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ['name', 'pin', 'created_by', 'created_at']
    search_fields = ['name', 'pin']
