from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import Organization


@override_settings(ALLOW_ANONYMOUS_COORDINATOR=False)
class CoordinatorAuthApiTests(APITestCase):
    def setUp(self):
        self.org = Organization.objects.create(
            name="Auth Test Org",
            slug="auth-test-org",
            country="PK",
            score_weights={"eligibility": 0.45, "feasibility": 0.30, "urgency": 0.20, "explainability": 0.05},
        )
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="auth_coordinator",
            password="strong-pass-123",
            role="coordinator",
            organization=self.org,
        )

    def test_dashboard_requires_authentication(self):
        response = self.client.get("/api/v1/coordinator/dashboard/")
        self.assertEqual(response.status_code, 401)

    def test_login_grants_access_to_dashboard(self):
        login = self.client.post(
            "/api/v1/auth/login/",
            {"username": "auth_coordinator", "password": "strong-pass-123"},
            format="json",
        )
        self.assertEqual(login.status_code, 200)
        token = login.data["access"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        dashboard = self.client.get("/api/v1/coordinator/dashboard/")
        self.assertEqual(dashboard.status_code, 200)
        self.assertIn("newMatches", dashboard.data)
