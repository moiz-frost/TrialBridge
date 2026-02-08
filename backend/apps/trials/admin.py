from django.contrib import admin

from .models import Trial, TrialSite


class TrialSiteInline(admin.TabularInline):
    model = TrialSite
    extra = 0


@admin.register(Trial)
class TrialAdmin(admin.ModelAdmin):
    list_display = ("trial_id", "source", "phase", "status", "updated_at")
    search_fields = ("trial_id", "title", "summary")
    list_filter = ("source", "status", "phase")
    inlines = [TrialSiteInline]
