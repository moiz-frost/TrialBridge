from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import Organization
from apps.patients.models import PatientProfile


class PatientIntakeRoutingTests(APITestCase):
    @patch("apps.core.api_views.evaluate_patient_against_trials")
    def test_routes_intake_patient_to_coordinator_org_in_same_country(self, _mock_eval):
        Organization.objects.create(
            name="No Coordinator Hospital",
            slug="no-coordinator-hospital",
            country="Pakistan",
            score_weights={"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05},
        )
        coordinator_org = Organization.objects.create(
            name="Aga Khan University Hospital",
            slug="aga-khan-university-hospital",
            country="Pakistan",
            score_weights={"eligibility": 0.50, "feasibility": 0.25, "urgency": 0.20, "explainability": 0.05},
        )
        user_model = get_user_model()
        user_model.objects.create_user(
            username="coord_pk",
            password="strong-pass-123",
            role="coordinator",
            organization=coordinator_org,
        )

        response = self.client.post(
            "/api/v1/patient/intake/",
            {
                "name": "Routing Test",
                "age": 37,
                "sex": "female",
                "city": "Karachi",
                "country": "Pakistan",
                "language": "english",
                "contactChannel": "email",
                "contactInfo": "routing.test@example.com",
                "story": "Metastatic breast cancer, ECOG 1, prior HER2-targeted therapy.",
                "consent": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        patient = PatientProfile.objects.get(id=response.data["patient_id"])
        self.assertEqual(patient.organization_id, coordinator_org.id)

    @override_settings(INTAKE_DEFAULT_ORGANIZATION_SLUG="cleveland-clinic-abu-dhabi")
    @patch("apps.core.api_views.evaluate_patient_against_trials")
    def test_routes_to_configured_default_organization_slug(self, _mock_eval):
        default_org = Organization.objects.create(
            name="Cleveland Clinic Abu Dhabi",
            slug="cleveland-clinic-abu-dhabi",
            country="UAE",
            score_weights={"eligibility": 0.50, "feasibility": 0.25, "urgency": 0.20, "explainability": 0.05},
        )
        Organization.objects.create(
            name="Another Org",
            slug="another-org",
            country="Pakistan",
            score_weights={"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05},
        )

        response = self.client.post(
            "/api/v1/patient/intake/",
            {
                "name": "Default Routing Test",
                "age": 40,
                "sex": "male",
                "city": "Dubai",
                "country": "UAE",
                "language": "english",
                "contactChannel": "email",
                "contactInfo": "default.routing@example.com",
                "story": "Diagnosed with advanced carcinoma, prior chemotherapy and ECOG 2.",
                "consent": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        patient = PatientProfile.objects.get(id=response.data["patient_id"])
        self.assertEqual(patient.organization_id, default_org.id)
