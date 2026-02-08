from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.patients.models import PatientProfile


class PatientUploadApiTests(APITestCase):
    def _create_patient(self) -> tuple[int, str]:
        intake_response = self.client.post(
            "/api/v1/patient/intake/",
            {
                "name": "Upload Test Patient",
                "age": 44,
                "sex": "female",
                "city": "Karachi",
                "country": "Pakistan",
                "language": "english",
                "contactChannel": "email",
                "contactInfo": "upload.test@example.com",
                "story": "HER2 positive disease with metastatic progression and ECOG 1.",
                "consent": True,
            },
            format="json",
        )
        self.assertEqual(intake_response.status_code, 201)
        return intake_response.data["patient_id"], intake_response.data["patient_token"]

    def test_patient_intake_and_document_upload(self):
        patient_id, token = self._create_patient()
        self.client.credentials(HTTP_X_PATIENT_TOKEN=token)

        upload = SimpleUploadedFile(
            "clinical-history.txt",
            b"Patient has HER2-positive metastatic breast cancer. ECOG 1.",
            content_type="text/plain",
        )
        upload_response = self.client.post(
            f"/api/v1/patient/{patient_id}/documents/",
            {"document": upload},
            format="multipart",
        )
        self.assertEqual(upload_response.status_code, 201)
        self.assertEqual(upload_response.data["patient"], patient_id)
        self.assertEqual(upload_response.data["original_name"], "clinical-history.txt")
        self.assertEqual(upload_response.data["extraction_status"], "extracted")
        self.assertGreater(upload_response.data["extracted_text_chars"], 0)

    def test_rejects_unsupported_document_type(self):
        patient_id, token = self._create_patient()
        self.client.credentials(HTTP_X_PATIENT_TOKEN=token)
        upload = SimpleUploadedFile(
            "scan-image.png",
            b"\x89PNG\r\n\x1a\nfakeimagebytes",
            content_type="image/png",
        )
        upload_response = self.client.post(
            f"/api/v1/patient/{patient_id}/documents/",
            {"document": upload},
            format="multipart",
        )
        self.assertEqual(upload_response.status_code, 400)
        self.assertIn("Unsupported file type", upload_response.data.get("detail", ""))

    def test_patient_history_is_append_only(self):
        patient_id, token = self._create_patient()
        self.client.credentials(HTTP_X_PATIENT_TOKEN=token)

        history_response = self.client.get(f"/api/v1/patient/{patient_id}/history/")
        self.assertEqual(history_response.status_code, 200)
        self.assertGreaterEqual(len(history_response.data), 1)

        first_entry = history_response.data[0]
        self.assertIn("entry_text", first_entry)

        add_response = self.client.post(
            f"/api/v1/patient/{patient_id}/history/",
            {"entry_text": "Additional update: recent ECOG was 1 and bilirubin is normal."},
            format="json",
        )
        self.assertEqual(add_response.status_code, 201)
        self.assertEqual(add_response.data["entry"]["source"], "patient_portal")

        updated_history_response = self.client.get(f"/api/v1/patient/{patient_id}/history/")
        self.assertEqual(updated_history_response.status_code, 200)
        self.assertGreaterEqual(len(updated_history_response.data), 2)

    def test_rejects_missing_patient_token(self):
        patient_id, _ = self._create_patient()
        self.client.credentials()

        response = self.client.get(f"/api/v1/patient/{patient_id}/history/")
        self.assertEqual(response.status_code, 401)

    def test_rejects_cross_patient_access_with_valid_token(self):
        patient_id_a, token_a = self._create_patient()
        patient_id_b, _ = self._create_patient()
        self.client.credentials(HTTP_X_PATIENT_TOKEN=token_a)

        response = self.client.get(f"/api/v1/patient/{patient_id_b}/history/")
        self.assertEqual(response.status_code, 403)

    def test_patient_access_returns_patient_portal_token(self):
        patient_id, _ = self._create_patient()
        patient = PatientProfile.objects.get(id=patient_id)

        access_response = self.client.post(
            "/api/v1/patient/access/",
            {
                "patient_code": patient.patient_code,
                "contact_info": patient.contact_value,
            },
            format="json",
        )
        self.assertEqual(access_response.status_code, 200)
        self.assertIn("patient_token", access_response.data)
