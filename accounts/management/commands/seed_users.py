import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from accounts.models import Profile


class Command(BaseCommand):
    help = "Create or update the default users from environment variables."

    def handle(self, *args, **options):
        self.ensure_user(
            username=os.environ.get("DJANGO_SUPERUSER_USERNAME", "admin"),
            email=os.environ.get("DJANGO_SUPERUSER_EMAIL", "admin@example.com"),
            password=os.environ.get("DJANGO_SUPERUSER_PASSWORD", "admin1234"),
            is_staff=True,
            is_superuser=True,
        )
        self.ensure_user(
            username=os.environ.get("DJANGO_PLAYER_USERNAME", "player"),
            email=os.environ.get("DJANGO_PLAYER_EMAIL", "player@example.com"),
            password=os.environ.get("DJANGO_PLAYER_PASSWORD", "player1234"),
            is_staff=False,
            is_superuser=False,
        )

    def ensure_user(self, username, email, password, is_staff, is_superuser):
        User = get_user_model()
        user, created = User.objects.get_or_create(username=username)
        user.email = email
        user.is_staff = is_staff
        user.is_superuser = is_superuser
        user.is_active = True
        user.set_password(password)
        user.save()
        Profile.objects.get_or_create(user=user)

        status = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"{username} {status}"))
