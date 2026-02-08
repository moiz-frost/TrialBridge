from django.db import models

from apps.core.models import TimeStampedModel


class MatchOverallStatus(models.TextChoices):
    ELIGIBLE = "Eligible", "Eligible"
    POSSIBLY_ELIGIBLE = "Possibly Eligible", "Possibly Eligible"
    UNLIKELY = "Unlikely", "Unlikely"


class UrgencyFlag(models.TextChoices):
    HIGH = "high", "High"
    MEDIUM = "medium", "Medium"
    LOW = "low", "Low"


class OutreachStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    DRAFT = "draft", "Draft"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    REPLIED = "replied", "Replied"
    NO_RESPONSE = "no_response", "No Response"


class MatchingRun(TimeStampedModel):
    run_type = models.CharField(max_length=32, default="scheduled")
    status = models.CharField(max_length=32, default="running")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict)


class MatchEvaluation(TimeStampedModel):
    organization = models.ForeignKey("core.Organization", on_delete=models.CASCADE, related_name="matches")
    patient = models.ForeignKey("patients.PatientProfile", on_delete=models.CASCADE, related_name="matches")
    trial = models.ForeignKey("trials.Trial", on_delete=models.CASCADE, related_name="matches")
    matching_run = models.ForeignKey(
        MatchingRun,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="match_evaluations",
    )

    eligibility_score = models.PositiveSmallIntegerField(default=0)
    feasibility_score = models.PositiveSmallIntegerField(default=0)
    urgency_score = models.PositiveSmallIntegerField(default=0)
    explainability_score = models.PositiveSmallIntegerField(default=0)

    urgency_flag = models.CharField(max_length=16, choices=UrgencyFlag.choices, default=UrgencyFlag.LOW)
    overall_status = models.CharField(
        max_length=32,
        choices=MatchOverallStatus.choices,
        default=MatchOverallStatus.POSSIBLY_ELIGIBLE,
    )

    reasons_matched = models.JSONField(default=list)
    reasons_failed = models.JSONField(default=list)
    missing_info = models.JSONField(default=list)
    doctor_checklist = models.JSONField(default=list)

    explanation_summary = models.TextField(blank=True)
    explanation_language = models.CharField(max_length=16, default="en")
    explanation_model = models.CharField(max_length=255, blank=True)
    prompt_version = models.CharField(max_length=32, default="v1")
    confidence = models.FloatField(default=0.0)

    outreach_status = models.CharField(max_length=32, choices=OutreachStatus.choices, default=OutreachStatus.PENDING)
    vector_similarity = models.FloatField(default=0.0)

    last_evaluated = models.DateTimeField(auto_now=True)
    is_new = models.BooleanField(default=True)

    class Meta:
        unique_together = ("patient", "trial")

    def __str__(self) -> str:
        return f"{self.patient.patient_code} -> {self.trial.trial_id}"
