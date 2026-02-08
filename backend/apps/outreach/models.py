from django.db import models

from apps.core.models import TimeStampedModel


class OutreachChannel(models.TextChoices):
    SMS = "sms", "SMS"
    WHATSAPP = "whatsapp", "WhatsApp"
    EMAIL = "email", "Email"
    PHONE = "phone", "Phone"


class DeliveryStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    QUEUED = "queued", "Queued"
    SENT = "sent", "Sent"
    DELIVERED = "delivered", "Delivered"
    FAILED = "failed", "Failed"
    REPLIED = "replied", "Replied"


class OutreachMessage(TimeStampedModel):
    match = models.ForeignKey("matching.MatchEvaluation", on_delete=models.CASCADE, related_name="outreach_messages")
    channel = models.CharField(max_length=32, choices=OutreachChannel.choices)
    direction = models.CharField(max_length=16, default="outbound")

    body = models.TextField()
    provider = models.CharField(max_length=64, default="twilio")
    provider_message_id = models.CharField(max_length=255, blank=True)

    status = models.CharField(max_length=32, choices=DeliveryStatus.choices, default=DeliveryStatus.DRAFT)
    status_payload = models.JSONField(default=dict)

    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.channel}:{self.match_id}:{self.status}"
