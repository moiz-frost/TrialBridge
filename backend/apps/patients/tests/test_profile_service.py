from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings

from apps.patients.services.profile import infer_structured_profile


class ProfileServiceTests(SimpleTestCase):
    @override_settings(LLM_MODE="gemini", GEMINI_API_KEY="test-key", GEMINI_MODEL="gemini-2.0-flash")
    @patch("apps.patients.services.profile.requests.post")
    def test_uses_gemini_plain_text_when_json_is_not_returned(self, mock_post):
        response = Mock()
        response.raise_for_status = Mock()
        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Clinical summary from Gemini without JSON schema wrapping."},
                        ]
                    }
                }
            ]
        }
        mock_post.return_value = response

        result = infer_structured_profile("I have severe scoliosis with persistent pain.")

        self.assertEqual(result["ai_summary"], "Clinical summary from Gemini without JSON schema wrapping.")
        self.assertEqual(result["parser"], "gemini:gemini-2.0-flash:text")

    @override_settings(LLM_MODE="gemini", GEMINI_API_KEY="test-key", GEMINI_MODEL="gemini-2.0-flash")
    @patch("apps.patients.services.profile.requests.post")
    def test_uses_gemini_json_response_when_available(self, mock_post):
        response = Mock()
        response.raise_for_status = Mock()
        response.json.return_value = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    '{"ai_summary":"Structured summary","diagnosis":"Scoliosis","stage":"","markers":[],'
                                    '"symptoms":["back pain"],"treatments":["physiotherapy"]}'
                                )
                            }
                        ]
                    }
                }
            ]
        }
        mock_post.return_value = response

        result = infer_structured_profile("Scoliosis with ongoing treatment.")

        self.assertEqual(result["ai_summary"], "Structured summary")
        self.assertEqual(result["diagnosis"], "Scoliosis")
        self.assertEqual(result["parser"], "gemini:gemini-2.0-flash")
