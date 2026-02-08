from django.contrib import admin

from .models import MatchEvaluation, MatchingRun


@admin.register(MatchingRun)
class MatchingRunAdmin(admin.ModelAdmin):
    list_display = ("id", "run_type", "status", "started_at", "finished_at")


@admin.register(MatchEvaluation)
class MatchEvaluationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "patient",
        "trial",
        "overall_status",
        "eligibility_score",
        "feasibility_score",
        "urgency_flag",
        "outreach_status",
    )
    search_fields = ("patient__patient_code", "patient__full_name", "trial__trial_id")
