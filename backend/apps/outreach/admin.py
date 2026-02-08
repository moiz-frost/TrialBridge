from django.contrib import admin

from .models import OutreachMessage


@admin.register(OutreachMessage)
class OutreachMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "match", "channel", "status", "provider", "sent_at")
    list_filter = ("channel", "status", "provider")
