from rest_framework import serializers

from apps.patients.serializers import PatientProfileSerializer
from apps.trials.serializers import TrialSerializer
from .models import MatchEvaluation, MatchingRun


class MatchEvaluationSerializer(serializers.ModelSerializer):
    patient = PatientProfileSerializer(read_only=True)
    trial = TrialSerializer(read_only=True)

    class Meta:
        model = MatchEvaluation
        fields = [
            "id",
            "patient",
            "trial",
            "eligibility_score",
            "feasibility_score",
            "urgency_score",
            "explainability_score",
            "urgency_flag",
            "overall_status",
            "reasons_matched",
            "reasons_failed",
            "missing_info",
            "doctor_checklist",
            "explanation_summary",
            "explanation_language",
            "explanation_model",
            "prompt_version",
            "confidence",
            "outreach_status",
            "last_evaluated",
            "is_new",
        ]


class MatchingRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchingRun
        fields = ["id", "run_type", "status", "started_at", "finished_at", "metadata"]
