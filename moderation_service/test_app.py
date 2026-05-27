import unittest
from unittest.mock import patch

from moderation_service import app as moderation_app
from fastapi.testclient import TestClient


class ModerationServiceTest(unittest.TestCase):
    def setUp(self):
        moderation_app.HF_TOKEN = "test-token"
        self.client = TestClient(moderation_app.app)

    def test_allows_safe_text(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.return_value = [
                {"label": "toxic", "score": 0.01}
            ]

            result = moderation_app.moderate_text("Let's review the project tasks.")

        self.assertEqual(result["action"], "allow")

    def test_blocks_toxic_text(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.return_value = [
                {"label": "toxic", "score": 0.91}
            ]

            result = moderation_app.moderate_text("unsafe text")

        self.assertEqual(result["action"], "block")
        self.assertEqual(result["reason"], moderation_app.BLOCK_REASON)

    def test_allows_empty_text_without_calling_hugging_face(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            result = moderation_app.moderate_text("   ")

        self.assertEqual(result["action"], "allow")
        self.assertEqual(result["labels"], [])
        client_class.assert_not_called()

    def test_allows_toxic_text_below_threshold(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.return_value = [
                {"label": "toxic", "score": 0.69}
            ]

            result = moderation_app.moderate_text("borderline text")

        self.assertEqual(result["action"], "allow")

    def test_blocks_strict_labels_at_lower_threshold(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.return_value = [
                {"label": "identity hate", "score": 0.51}
            ]

            result = moderation_app.moderate_text("unsafe identity text")

        self.assertEqual(result["action"], "block")

    def test_hugging_face_errors_return_503(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.side_effect = RuntimeError("offline")

            with self.assertRaises(moderation_app.HTTPException) as error:
                moderation_app.moderate_text("service unavailable")

        self.assertEqual(error.exception.status_code, 503)

    def test_moderate_endpoint_allows_safe_text(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.return_value = [
                {"label": "toxic", "score": 0.02}
            ]

            response = self.client.post("/moderate", json={"text": "Let's finish the worksheet."})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["action"], "allow")

    def test_moderate_endpoint_blocks_unsafe_text(self):
        with patch.object(moderation_app, "InferenceClient") as client_class:
            client_class.return_value.text_classification.return_value = [
                {"label": "insult", "score": 0.88}
            ]

            response = self.client.post("/moderate", json={"text": "unsafe text"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["action"], "block")


if __name__ == "__main__":
    unittest.main()
