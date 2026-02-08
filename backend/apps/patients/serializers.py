from rest_framework import serializers

from .models import PatientDocument, PatientHistoryEntry, PatientProfile


class PatientProfileSerializer(serializers.ModelSerializer):
    registered_at = serializers.DateTimeField(source="created_at", read_only=True, format="%Y-%m-%d")
    contactInfo = serializers.CharField(source="contact_value", read_only=True)
    contactChannel = serializers.CharField(source="contact_channel", read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            "id",
            "patient_code",
            "full_name",
            "age",
            "sex",
            "city",
            "country",
            "language",
            "diagnosis",
            "stage",
            "story",
            "contactChannel",
            "contactInfo",
            "profile_completeness",
            "registered_at",
            "structured_profile",
        ]


class PatientIntakeSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    age = serializers.IntegerField(min_value=0)
    sex = serializers.CharField(max_length=32)
    city = serializers.CharField(max_length=128)
    country = serializers.CharField(max_length=128)
    language = serializers.CharField(max_length=32)
    contactChannel = serializers.ChoiceField(choices=["sms", "whatsapp", "email", "phone"])
    contactInfo = serializers.CharField(max_length=255)
    story = serializers.CharField(allow_blank=True)
    consent = serializers.BooleanField(default=False)


class PatientHistoryEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientHistoryEntry
        fields = ["id", "patient", "source", "entry_text", "created_at"]
        read_only_fields = fields


class PatientHistoryEntryCreateSerializer(serializers.Serializer):
    entry_text = serializers.CharField(min_length=5)


class PatientDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    extracted_text_preview = serializers.SerializerMethodField()
    extracted_text_chars = serializers.SerializerMethodField()

    class Meta:
        model = PatientDocument
        fields = [
            "id",
            "patient",
            "original_name",
            "content_type",
            "size_bytes",
            "file_url",
            "extraction_status",
            "extraction_error",
            "extracted_text",
            "extracted_text_preview",
            "extracted_text_chars",
            "created_at",
        ]
        read_only_fields = fields

    def get_file_url(self, obj: PatientDocument) -> str:
        try:
            return obj.file.url
        except Exception:
            return ""

    def get_extracted_text_preview(self, obj: PatientDocument) -> str:
        text = (obj.extracted_text or "").strip()
        if len(text) <= 400:
            return text
        return f"{text[:400].rstrip()}..."

    def get_extracted_text_chars(self, obj: PatientDocument) -> int:
        return len(obj.extracted_text or "")
