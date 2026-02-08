from rest_framework import serializers

from .models import OutreachMessage


class OutreachMessageSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="match.patient.full_name", read_only=True)
    trial_id = serializers.CharField(source="match.trial.trial_id", read_only=True)

    class Meta:
        model = OutreachMessage
        fields = [
            "id",
            "match",
            "patient_name",
            "trial_id",
            "channel",
            "direction",
            "body",
            "provider",
            "provider_message_id",
            "status",
            "status_payload",
            "sent_at",
            "delivered_at",
            "replied_at",
            "created_at",
        ]


class SendOutreachSerializer(serializers.Serializer):
    match_id = serializers.IntegerField()
    channel = serializers.ChoiceField(choices=["sms", "whatsapp", "email", "phone"])
    body = serializers.CharField()
