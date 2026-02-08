from django.conf import settings
from django.db import models
from pgvector.django import VectorField

from apps.core.models import TimeStampedModel


class ContactChannel(models.TextChoices):
    SMS = "sms", "SMS"
    WHATSAPP = "whatsapp", "WhatsApp"
    EMAIL = "email", "Email"
    PHONE = "phone", "Phone"


class PatientProfile(TimeStampedModel):
    patient_code = models.CharField(max_length=32, unique=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="patient_profile",
    )
    organization = models.ForeignKey("core.Organization", on_delete=models.CASCADE, related_name="patients")

    full_name = models.CharField(max_length=255)
    age = models.PositiveIntegerField()
    sex = models.CharField(max_length=32)
    city = models.CharField(max_length=128)
    country = models.CharField(max_length=128)
    language = models.CharField(max_length=32, default="English")

    diagnosis = models.CharField(max_length=255, blank=True)
    stage = models.CharField(max_length=255, blank=True)
    story = models.TextField(blank=True)

    structured_profile = models.JSONField(default=dict)
    contact_channel = models.CharField(max_length=32, choices=ContactChannel.choices)
    contact_value = models.CharField(max_length=255)
    consent = models.BooleanField(default=False)

    profile_completeness = models.PositiveSmallIntegerField(default=0)
    embedding_vector = VectorField(dimensions=384, null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.patient_code} - {self.full_name}"


class PatientHistoryEntry(TimeStampedModel):
    class Source(models.TextChoices):
        INTAKE = "intake", "Intake"
        PATIENT_PORTAL = "patient_portal", "Patient Portal"
        COORDINATOR = "coordinator", "Coordinator"

    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="history_entries")
    source = models.CharField(max_length=32, choices=Source.choices, default=Source.PATIENT_PORTAL)
    entry_text = models.TextField()

    def __str__(self) -> str:
        return f"{self.patient.patient_code} history entry ({self.source})"


def _document_upload_path(instance: "PatientDocument", filename: str) -> str:
    # Keep names deterministic and scoped to patient code to simplify retrieval and backups.
    return f"patient_documents/{instance.patient.patient_code}/{filename}"


class PatientDocument(TimeStampedModel):
    class ExtractionStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        EXTRACTED = "extracted", "Extracted"
        UNSUPPORTED = "unsupported", "Unsupported"
        EMPTY = "empty", "Empty"
        FAILED = "failed", "Failed"

    patient = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to=_document_upload_path)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=127, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(blank=True, default="")
    extraction_status = models.CharField(
        max_length=32,
        choices=ExtractionStatus.choices,
        default=ExtractionStatus.PENDING,
    )
    extraction_error = models.TextField(blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="uploaded_patient_documents",
    )

    def __str__(self) -> str:
        return f"{self.patient.patient_code} - {self.original_name}"
