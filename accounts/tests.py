from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


class AuthenticationViewsTests(TestCase):
    def setUp(self):
        self.password = "MotDePasse!2026"
        self.user = get_user_model().objects.create_user(
            username="antoine",
            email="antoine@example.com",
            password=self.password,
        )

    def test_root_redirects_to_welcome_page(self):
        response = self.client.get(reverse("root"))

        self.assertRedirects(response, reverse("index"))

    def test_login_accepts_email(self):
        response = self.client.post(
            reverse("login"),
            {
                "username": self.user.email,
                "password": self.password,
            },
        )

        self.assertRedirects(response, reverse("home"))
        self.assertEqual(self.client.session.get("_auth_user_id"), str(self.user.pk))

    def test_register_creates_and_connects_user(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "nouvel_utilisateur",
                "email": "nouveau@example.com",
                "password": self.password,
                "password_confirm": self.password,
            },
        )

        user = get_user_model().objects.get(username="nouvel_utilisateur")
        self.assertRedirects(response, reverse("home"))
        self.assertTrue(user.check_password(self.password))
        self.assertEqual(self.client.session.get("_auth_user_id"), str(user.pk))

    def test_register_rejects_passwords_that_do_not_match(self):
        response = self.client.post(
            reverse("register"),
            {
                "username": "nouvel_utilisateur",
                "email": "nouveau@example.com",
                "password": self.password,
                "password_confirm": "AutreMotDePasse!2026",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Les mots de passe ne correspondent pas.")
        self.assertFalse(
            get_user_model().objects.filter(username="nouvel_utilisateur").exists()
        )
