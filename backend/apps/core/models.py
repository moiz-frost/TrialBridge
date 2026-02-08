from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Organization(TimeStampedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    country = models.CharField(max_length=128, blank=True)
    score_weights = models.JSONField(
        default=dict,
        help_text="Expected keys: eligibility, feasibility, urgency, explainability",
    )

    def __str__(self) -> str:
        return self.name
