from django.db import models
from pgvector.django import VectorField

from apps.core.models import TimeStampedModel


class TrialStatus(models.TextChoices):
    RECRUITING = "RECRUITING", "Recruiting"
    NOT_YET_RECRUITING = "NOT_YET_RECRUITING", "Not Yet Recruiting"
    ACTIVE_NOT_RECRUITING = "ACTIVE_NOT_RECRUITING", "Active, Not Recruiting"
    COMPLETED = "COMPLETED", "Completed"


class Trial(TimeStampedModel):
    source = models.CharField(max_length=64, default="clinicaltrials.gov")
    trial_id = models.CharField(max_length=64, unique=True)
    title = models.TextField()
    phase = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=64, choices=TrialStatus.choices, default=TrialStatus.RECRUITING)

    conditions = models.JSONField(default=list)
    interventions = models.JSONField(default=list)
    countries = models.JSONField(default=list)

    sponsor = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True)
    eligibility_summary = models.TextField(blank=True)
    inclusion_text = models.TextField(blank=True)
    exclusion_text = models.TextField(blank=True)
    eligibility_json = models.JSONField(default=dict)
    metadata = models.JSONField(default=dict)

    embedding_text = models.TextField(blank=True)
    embedding_vector = VectorField(dimensions=384, null=True, blank=True)

    source_url = models.URLField(blank=True)
    external_last_updated = models.DateField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.trial_id} - {self.title[:80]}"


class TrialSite(TimeStampedModel):
    trial = models.ForeignKey(Trial, on_delete=models.CASCADE, related_name="sites")
    facility = models.CharField(max_length=255)
    city = models.CharField(max_length=128)
    country = models.CharField(max_length=128)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ("trial", "facility", "city", "country")

    def __str__(self) -> str:
        return f"{self.trial.trial_id} @ {self.facility}"
