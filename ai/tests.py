import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from .llama_service import LlamaService
from .models import GroqAnalysis


class LlamaServiceTests(SimpleTestCase):
    def test_service_uses_explicit_configuration(self):
        service = LlamaService(
            api_key="test-api-key",
            model="test-model",
            base_url="https://example.com/chat",
        )

        self.assertEqual(service.api_key, "test-api-key")
        self.assertEqual(service.model, "test-model")
        self.assertEqual(service.base_url, "https://example.com/chat")


class LlamaViewsTests(TestCase):
    def test_chat_rejects_invalid_json(self):
        response = self.client.post(
            reverse("llama_chat"),
            data="{",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"], "JSON invalide.")

    @patch("ai.views.LlamaService")
    def test_chat_returns_mocked_ai_answer_without_calling_groq(self, service_class):
        service = service_class.return_value
        service.generate.return_value = "Bonjour, comment puis-je aider ?"

        response = self.client.post(
            reverse("llama_chat"),
            data=json.dumps({"prompt": "Explique Django"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["response"], "Bonjour, comment puis-je aider ?"
        )
        service.generate.assert_called_once_with("Explique Django")

    @patch("ai.views.LlamaService")
    def test_chat_returns_error_when_ai_provider_fails(self, service_class):
        service = service_class.return_value
        service.model = "llama-3.3-70b-versatile"
        service.api_key = "test-api-key"
        service.generate.side_effect = RuntimeError("Erreur fournisseur IA")

        response = self.client.post(
            reverse("llama_chat"),
            data=json.dumps({"prompt": "Bonjour"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["error"], "Erreur fournisseur IA")

    @patch("ai.views.LlamaService")
    def test_status_exposes_configuration_without_secret(self, service_class):
        service = service_class.return_value
        service.model = "llama-3.3-70b-versatile"
        service.api_key = "test-api-key"

        response = self.client.get(reverse("llama_status"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["model"], "llama-3.3-70b-versatile")
        self.assertTrue(response.json()["api_key_configured"])


class GroqAnalysisViewsTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="project_owner",
            email="project_owner@example.com",
            password="TestPassword!2026",
        )
        self.other_user = user_model.objects.create_user(
            username="other_user",
            email="other_user@example.com",
            password="TestPassword!2026",
        )
        self.analysis = GroqAnalysis.objects.create(
            user=self.user,
            prompt="Creer une application de suivi sportif",
            response_text="Voici le projet propose.",
        )

    def test_owner_can_open_project_detail(self):
        self.client.force_login(self.user)

        response = self.client.get(
            reverse("groq_analysis_detail", args=[self.analysis.pk])
        )

        self.assertEqual(response.status_code, 200)
        project = response.json()["project"]
        self.assertEqual(project["id"], self.analysis.pk)
        self.assertEqual(project["prompt"], self.analysis.prompt)
        self.assertEqual(project["response_text"], self.analysis.response_text)

    def test_user_cannot_open_another_users_project(self):
        self.client.force_login(self.other_user)

        response = self.client.get(
            reverse("groq_analysis_detail", args=[self.analysis.pk])
        )

        self.assertEqual(response.status_code, 404)

    @patch("ai.views.ask_groq")
    def test_ask_creates_project_and_returns_its_details(self, ask_groq):
        ask_groq.return_value = "Reponse simulee"
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_ask"),
            data=json.dumps({"message": "Une nouvelle idee"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        analysis = GroqAnalysis.objects.get(prompt="Une nouvelle idee")
        self.assertEqual(analysis.user, self.user)
        self.assertEqual(response.json()["project"]["id"], analysis.pk)
