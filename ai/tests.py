import json
from io import BytesIO
from unittest.mock import patch
from zipfile import ZipFile

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from ai.services.persona_generator import PersonaGenerator
from ai.views import extract_json_payload

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


class PersonaGenerationTests(SimpleTestCase):
    def test_extract_json_payload_accepts_fenced_json(self):
        payload = extract_json_payload("""```json
{"personas": []}
```""")

        self.assertEqual(payload, {"personas": []})

    def test_extract_json_payload_accepts_text_around_json(self):
        payload = extract_json_payload('Voici le JSON : {"personas": []} merci.')

        self.assertEqual(payload, {"personas": []})

    @patch("ai.services.persona_generator.GroqClient")
    def test_persona_generator_requests_json_response(self, groq_client_class):
        groq_client = groq_client_class.return_value
        groq_client.chat.return_value = '{"personas": []}'

        PersonaGenerator().generate("Projet de test")

        groq_client.chat.assert_called_once()
        _, _, kwargs = groq_client.chat.mock_calls[0]
        self.assertEqual(kwargs["max_tokens"], 2600)
        self.assertEqual(kwargs["response_format"]["type"], "json_schema")
        self.assertTrue(kwargs["response_format"]["json_schema"]["strict"])
        self.assertEqual(kwargs["temperature"], 0.4)


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
            response.json()["response"],
            "Bonjour, comment puis-je aider ?",
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

    @patch("ai.views.PersonaGenerator")
    def test_owner_can_generate_project_personas(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "personas": [
                    {
                        "id": "persona_1",
                        "card_color": "green",
                        "name": "Lucas",
                        "age": "20 ans",
                        "type": "Etudiant organise",
                        "portrait": "👤",
                        "location": "Lyon, France",
                        "job": "Etudiant",
                        "social_background": "Classe moyenne",
                        "situation": "Celibataire",
                        "tech_level": "A l'aise",
                        "summary": "Cherche une solution simple.",
                        "quote": "Je veux gagner du temps.",
                        "objectives": ["Objectif 1"],
                        "needs": ["Besoin 1"],
                        "frustrations": ["Frustration 1"],
                        "behaviors": ["Comportement 1"],
                        "scenario": "Lucas utilise la plateforme.",
                        "expectations": "Interface simple.",
                    },
                    {
                        "id": "persona_2",
                        "card_color": "violet",
                        "name": "Sarah",
                        "age": "34 ans",
                        "type": "Professionnelle",
                        "portrait": "👤",
                        "location": "Paris, France",
                        "job": "Cheffe de projet",
                        "social_background": "Cadre urbain",
                        "situation": "En couple",
                        "tech_level": "Expert",
                        "summary": "Cherche a organiser son equipe.",
                        "quote": "Je veux une vision claire.",
                        "objectives": ["Objectif 2"],
                        "needs": ["Besoin 2"],
                        "frustrations": ["Frustration 2"],
                        "behaviors": ["Comportement 2"],
                        "scenario": "Sarah compare les options.",
                        "expectations": "Donnees fiables.",
                    },
                    {
                        "id": "persona_3",
                        "card_color": "orange",
                        "name": "Karim",
                        "age": "47 ans",
                        "type": "Artisan independant",
                        "portrait": "👤",
                        "location": "Marseille, France",
                        "job": "Artisan",
                        "social_background": "Independant",
                        "situation": "Parent",
                        "tech_level": "Intermediaire",
                        "summary": "Cherche une aide concrete.",
                        "quote": "Je veux aller a l'essentiel.",
                        "objectives": ["Objectif 3"],
                        "needs": ["Besoin 3"],
                        "frustrations": ["Frustration 3"],
                        "behaviors": ["Comportement 3"],
                        "scenario": "Karim consulte la page sur mobile.",
                        "expectations": "Resultat rapide.",
                    },
                ],
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_personas", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["cached"])
        self.assertEqual(len(response.json()["personas"]), 3)
        self.analysis.refresh_from_db()
        self.assertEqual(len(self.analysis.response_json["personas"]), 3)

    @patch("ai.views.PersonaGenerator")
    def test_force_generation_asks_for_different_personas(self, generator_class):
        self.analysis.response_json = {
            "personas": [
                {
                    "id": "persona_1",
                    "name": "Lucas",
                    "card_color": "green",
                    "objectives": ["Objectif 1"],
                },
                {"id": "persona_2", "name": "Sarah", "card_color": "violet"},
                {"id": "persona_3", "name": "Karim", "card_color": "orange"},
            ],
        }
        self.analysis.save(update_fields=["response_json"])
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "personas": [
                    {"id": "persona_1", "name": "Nina"},
                    {"id": "persona_2", "name": "Omar"},
                    {"id": "persona_3", "name": "Claire"},
                ],
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_personas", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        generation_context = generator.generate.call_args.args[0]
        self.assertIn("previous_personas_to_avoid", generation_context)
        self.assertIn("regeneration_nonce", generation_context)
        self.assertNotIn("Objectif 1", generation_context)

    @patch("ai.views.PersonaGenerator")
    def test_personas_endpoint_returns_cached_personas(self, generator_class):
        self.analysis.response_json = {
            "personas": [
                {"id": "persona_1", "name": "A", "card_color": "green"},
                {"id": "persona_2", "name": "B", "card_color": "violet"},
                {"id": "persona_3", "name": "C", "card_color": "orange"},
            ],
        }
        self.analysis.save(update_fields=["response_json"])
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_personas", args=[self.analysis.pk]),
            data=json.dumps({"force": False}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["cached"])
        self.assertEqual(len(response.json()["personas"]), 3)
        generator_class.assert_not_called()

    def test_user_cannot_generate_personas_for_another_users_project(self):
        self.client.force_login(self.other_user)

        response = self.client.post(
            reverse("groq_project_personas", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)

    @patch("ai.views.StorymapGenerator")
    def test_owner_can_generate_user_stories(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "user_stories": [
                    {
                        "id": "US-01",
                        "role": "visiteur",
                        "action": "creer un compte",
                        "benefit": "acceder a son espace",
                        "priority": "Haute",
                        "points": 5,
                        "epic": "Authentification",
                        "acceptance_criteria": ["L'utilisateur peut saisir son email"],
                    },
                ],
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_user_stories", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["cached"])
        self.analysis.refresh_from_db()
        self.assertEqual(len(self.analysis.response_json["user_stories"]), 1)

    @patch("ai.views.BacklogGenerator")
    def test_owner_can_generate_backlog(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "backlog": [
                    {
                        "id": "US-01",
                        "priority": "P0",
                        "title": "Creer un compte",
                        "story": "En tant que visiteur, je souhaite creer un compte.",
                        "points": 5,
                        "status": "A faire",
                        "epic": "Authentification",
                        "acceptance_criteria": ["L'utilisateur peut saisir son email"],
                    },
                ],
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_backlog", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["backlog"][0]["priority"], "P0")
        self.analysis.refresh_from_db()
        self.assertEqual(len(self.analysis.response_json["backlog"]), 1)

    @patch("ai.views.BusinessModelGenerator")
    def test_owner_can_generate_business_model(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "business_model_canvas": {
                    "key_partners": ["Hebergeur"],
                    "key_activities": ["Developpement"],
                    "key_resources": ["Equipe"],
                    "value_propositions": ["Gain de temps"],
                    "customer_relationships": ["Self-service"],
                    "channels": ["Site web"],
                    "customer_segments": ["Etudiants"],
                    "cost_structure": ["API IA"],
                    "revenue_streams": ["Abonnement"],
                },
                "metrics": {
                    "market_potential": "Moyen",
                    "complexity": "Moyenne",
                    "initial_investment": "Moyen",
                    "launch_time": "3 - 6 mois",
                    "estimated_profitability": "Moyenne",
                },
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_business_model", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn(
            "customer_segments",
            response.json()["business_model"]["business_model_canvas"],
        )
        self.analysis.refresh_from_db()
        self.assertIn("business_model", self.analysis.response_json)

    @patch("ai.views.SWOTGenerator")
    def test_owner_can_generate_swot(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "swot": {
                    "strengths": ["Interface simple"],
                    "weaknesses": ["Dépendance API"],
                    "opportunities": ["Marché IA en croissance"],
                    "threats": ["Concurrence forte"],
                },
                "recommendations": ["Prioriser un parcours utilisateur clair"],
                "summary": {
                    "main_strength": "Interface simple",
                    "main_risk": "Dépendance API",
                    "priority_action": "Valider le besoin utilisateur",
                },
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_swot", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["swot"]["swot"]["strengths"][0], "Interface simple"
        )
        self.analysis.refresh_from_db()
        self.assertIn("swot", self.analysis.response_json)

    @patch("ai.views.SpeechGenerator")
    def test_owner_can_generate_speech(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "speech": {
                    "title": "Pitch du projet",
                    "estimated_duration": "3:30 min",
                    "word_count": 520,
                    "sections": [
                        {
                            "id": 1,
                            "emoji": "🎤",
                            "title": "Introduction",
                            "time_range": "0:00 - 0:30",
                            "content": "Bonjour, voici notre projet.",
                        },
                    ],
                    "slide_plan": [
                        {
                            "id": 1,
                            "title": "Introduction",
                            "visual_suggestion": "Logo et promesse",
                        },
                    ],
                    "presentation_tips": ["Parler clairement"],
                },
                "quick_preview": {
                    "duration": "3:30 min",
                    "words": 520,
                    "sections": 1,
                },
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_speech", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["speech"]["sections"][0]["title"], "Introduction"
        )
        self.analysis.refresh_from_db()
        self.assertIn("speech", self.analysis.response_json)

    @patch("ai.views.SprintGenerator")
    def test_owner_can_generate_sprint(self, generator_class):
        generator = generator_class.return_value
        generator.generate.return_value = json.dumps(
            {
                "sprint": {
                    "id": "sprint_1",
                    "name": "Sprint 1",
                    "status": "En cours",
                    "goal": "Poser les bases du produit.",
                    "duration": "2 semaines",
                    "start_label": "Semaine 1",
                    "end_label": "Semaine 2",
                    "team_capacity_points": 40,
                    "forecast_load_percent": 80,
                    "risk": "Moyen",
                    "total_points": 8,
                    "planned_points": 8,
                    "progress_percent": 20,
                    "user_stories": [
                        {
                            "id": "US-01",
                            "story": "En tant que visiteur, je souhaite creer un compte.",
                            "points": 5,
                            "priority": "Haute",
                            "status": "En cours",
                            "progress_percent": 30,
                        }
                    ],
                    "tasks": [
                        {"label": "Creer le modele utilisateur", "status": "En cours"}
                    ],
                    "team": [{"name": "Emma Martin", "role": "Product Owner"}],
                },
                "summary": {"done": 0, "in_progress": 1, "todo": 0},
            },
        )
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_sprint", args=[self.analysis.pk]),
            data=json.dumps({"force": True}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["sprint"]["sprint"]["user_stories"][0]["id"],
            "US-01",
        )
        self.analysis.refresh_from_db()
        self.assertIn("sprint", self.analysis.response_json)

    def test_owner_can_download_speech_slides(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("groq_project_speech_slides", args=[self.analysis.pk]),
            data=json.dumps(
                {
                    "speech": {
                        "estimated_duration": "3:00 min",
                        "word_count": 320,
                        "sections": [
                            {
                                "id": 1,
                                "title": "Introduction",
                                "time_range": "0:00 - 0:30",
                                "content": "Bonjour, voici le projet.",
                            }
                        ],
                    }
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content[:2], b"PK")
        with ZipFile(BytesIO(response.content)) as archive:
            self.assertIn("ppt/presentation.xml", archive.namelist())
