from django.test import TestCase, override_settings

from apps.core.models import Organization
from apps.matching.models import MatchEvaluation
from apps.outreach.services.sender import send_outreach_message
from apps.patients.models import PatientProfile
from apps.trials.models import Trial


@override_settings(OUTREACH_DELIVERY_MODE="mock")
class OutreachSenderSafeModeTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Outreach Org",
            slug="outreach-org",
            country="PK",
            score_weights={"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05},
        )
        self.patient = PatientProfile.objects.create(
            patient_code="PAT-OUT-01",
            organization=self.org,
            full_name="Outreach Safe Patient",
            age=40,
            sex="female",
            city="Karachi",
            country="Pakistan",
            language="English",
            diagnosis="HER2+ Breast Cancer",
            stage="Stage IV",
            story="Metastatic disease",
            structured_profile={"markers": ["her2"]},
            contact_channel="whatsapp",
            contact_value="+923001234567",
            consent=True,
            profile_completeness=90,
        )
        self.trial = Trial.objects.create(
            trial_id="NCT-OUT-01",
            title="Outreach Trial",
            phase="Phase 2",
            status="RECRUITING",
            source="clinicaltrials.gov",
            conditions=["Breast Cancer"],
            interventions=["Investigational agent"],
            countries=["Pakistan"],
            summary="",
            eligibility_summary="",
            inclusion_text="",
            exclusion_text="",
            embedding_text="",
            source_url="https://clinicaltrials.gov/study/NCT-OUT-01",
        )
        self.match = MatchEvaluation.objects.create(
            organization=self.org,
            patient=self.patient,
            trial=self.trial,
            eligibility_score=75,
            feasibility_score=70,
            urgency_score=85,
            explainability_score=65,
            urgency_flag="high",
            overall_status="Possibly Eligible",
        )

    def test_mock_delivery_mode_marks_message_without_real_send(self):
        message = send_outreach_message(self.match, channel="whatsapp", body="Hello from test")
        self.match.refresh_from_db()

        self.assertEqual(message.status, "sent")
        self.assertEqual(self.match.outreach_status, "sent")
        self.assertEqual(message.status_payload.get("delivery_mode"), "mock")
        self.assertTrue(message.status_payload.get("simulated"))
