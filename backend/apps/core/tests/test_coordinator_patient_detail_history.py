from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.core.models import Organization
from apps.patients.models import PatientProfile


class CoordinatorPatientDetailHistoryTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Detail History Org",
            slug="detail-history-org",
            country="Pakistan",
            score_weights={"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05},
        )
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="detail_history_coord",
            password="strong-pass-123",
            role="coordinator",
            organization=self.org,
        )

    def _login(self) -> None:
        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "detail_history_coord", "password": "strong-pass-123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_detail_view_backfills_initial_history_entry_from_story(self):
        patient = PatientProfile.objects.create(
            patient_code="PAT-7777",
            organization=self.org,
            full_name="History Missing Patient",
            age=39,
            sex="female",
            city="Karachi",
            country="Pakistan",
            language="english",
            diagnosis="",
            stage="",
            story="Initial intake history that should appear in coordinator detail.",
            structured_profile={},
            contact_channel="email",
            contact_value="detail-history@example.com",
            consent=True,
            profile_completeness=90,
        )
        self.assertEqual(patient.history_entries.count(), 0)

        self._login()
        response = self.client.get(f"/api/v1/coordinator/patients/{patient.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data["history_entries"]), 1)
        self.assertEqual(response.data["history_entries"][0]["source"], "intake")
        self.assertIn("Initial intake history", response.data["history_entries"][0]["entry_text"])
