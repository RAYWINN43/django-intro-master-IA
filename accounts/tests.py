from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone


class AuthenticationViewsTests(TestCase):
    def setUp(self):
        self.password = "MotDePasse!2026"
        self.user = get_user_model().objects.create_user(
            username="test_user",
            email="test_user@example.com",
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

    def test_register_enforces_password_requirements(self):
        invalid_passwords = {
            "Court!1": "12 caracteres",
            "PasDeChiffre!": "un chiffre",
            "sansmajuscule1!": "une majuscule et une minuscule",
            "SansSpecial123": "un caractere special",
        }

        for index, (password, error) in enumerate(invalid_passwords.items()):
            with self.subTest(password=password):
                response = self.client.post(
                    reverse("register"),
                    {
                        "username": f"utilisateur{index}",
                        "email": f"utilisateur{index}@example.com",
                        "password": password,
                        "password_confirm": password,
                    },
                )

                self.assertEqual(response.status_code, 200)
                self.assertContains(response, error)

    def test_password_change_enforces_password_requirements(self):
        self.client.force_login(self.user)

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": self.password,
                "new_password1": "NouveauMotDePasse2027",
                "new_password2": "NouveauMotDePasse2027",
            },
        )

        self.user.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "un caractere special")
        self.assertTrue(self.user.check_password(self.password))

    def test_profile_displays_user_information(self):
        self.user.last_login = timezone.now()
        self.user.save(update_fields=["last_login"])
        self.client.force_login(self.user)

        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, self.user.username)
        self.assertContains(response, self.user.email)
        self.assertContains(response, "Derniere connexion")

    def test_password_change_keeps_user_connected(self):
        self.client.force_login(self.user)
        new_password = "NouveauMotDePasse!2027"

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": self.password,
                "new_password1": new_password,
                "new_password2": new_password,
            },
        )

        self.user.refresh_from_db()
        self.assertRedirects(
            response,
            reverse("profile"),
            fetch_redirect_response=False,
        )
        self.assertTrue(self.user.check_password(new_password))
        profile_response = self.client.get(reverse("profile"))
        self.assertEqual(profile_response.status_code, 200)
        self.assertContains(profile_response, "Mot de passe modifie avec succes.")
