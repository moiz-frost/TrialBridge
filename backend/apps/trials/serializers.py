from rest_framework import serializers

from .models import Trial, TrialSite


class TrialSiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrialSite
        fields = ["facility", "city", "country", "latitude", "longitude"]


class TrialSerializer(serializers.ModelSerializer):
    locations = TrialSiteSerializer(many=True, source="sites", read_only=True)

    class Meta:
        model = Trial
        fields = [
            "id",
            "trial_id",
            "source",
            "title",
            "phase",
            "status",
            "conditions",
            "interventions",
            "countries",
            "locations",
            "sponsor",
            "summary",
            "eligibility_summary",
            "source_url",
            "external_last_updated",
        ]
