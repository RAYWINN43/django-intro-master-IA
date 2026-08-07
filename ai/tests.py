import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .groq_client import GroqConfigurationError


class GroqAskViewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="test_ai_user",
            email="test_ai_user@example.com",
            password="MotDePasse!2026",
        )
        self.url = reverse("groq_ask")

    def test_ask_requires_authenticated_user(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"message": "Bonjour"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 302)

    @patch("ai.views.ask_groq", return_value="Bonjour, comment puis-je aider ?")
    def test_ask_returns_mocked_ai_answer_without_calling_groq(self, mock_ask_groq):
        self.client.force_login(self.user)

        response = self.client.post(
            self.url,
            data=json.dumps({"message": "Explique Django"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["answer"], "Bonjour, comment puis-je aider ?")
        mock_ask_groq.assert_called_once_with("Explique Django")

    def test_ask_rejects_empty_message(self):
        self.client.force_login(self.user)

        response = self.client.post(
            self.url,
            data=json.dumps({"message": "   "}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "Le champ message est obligatoire.")

    @patch(
        "ai.views.ask_groq",
        side_effect=GroqConfigurationError("Configuration Groq absente."),
    )
    def test_ask_returns_clear_error_when_ai_is_not_configured(self, mock_ask_groq):
        self.client.force_login(self.user)

        response = self.client.post(
            self.url,
            data=json.dumps({"message": "Bonjour"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["error"], "Configuration Groq absente.")
        mock_ask_groq.assert_called_once_with("Bonjour")
