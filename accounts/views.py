import re

from django.contrib.auth import get_user_model, login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST


def index(request):
    return render(request, "index.html")


@login_required
def home(request):
    return HttpResponse(f"Connecte : {request.user.username}")


@require_POST
def register(request):
    username = request.POST.get("username", "").strip()
    email = request.POST.get("email", "").strip()
    password = request.POST.get("password", "")
    password_confirm = request.POST.get("password_confirm", "")

    if not all([username, email, password, password_confirm]):
        return render_account_error(request, "Tous les champs sont obligatoires.")

    if password != password_confirm:
        return render_account_error(request, "Les mots de passe ne correspondent pas.")

    password_error = get_password_error(password)
    if password_error:
        return render_account_error(request, password_error)

    User = get_user_model()

    if User.objects.filter(username=username).exists():
        return render_account_error(request, "Ce pseudo est deja utilise.")

    if User.objects.filter(email__iexact=email).exists():
        return render_account_error(request, "Cette adresse email est deja utilisee.")

    user = User(
        username=username,
        email=email,
    )

    try:
        validate_password(password, user=user)
    except ValidationError as error:
        return render_account_error(request, " ".join(error.messages))

    user.set_password(password)
    user.save()
    login(request, user)

    return redirect("home")


def render_account_error(request, message):
    return render(
        request,
        "account.html",
        {
            "account_mode": "inscription",
            "register_error": message,
        },
    )


def get_password_error(password):
    if len(password) < 12:
        return "Le mot de passe doit contenir au moins 12 caracteres."

    if not re.search(r"\d", password):
        return "Le mot de passe doit contenir un chiffre."

    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password):
        return "Le mot de passe doit contenir une majuscule et une minuscule."

    if not re.search(r"[^A-Za-z0-9]", password):
        return "Le mot de passe doit contenir un caractere special."

    return None
