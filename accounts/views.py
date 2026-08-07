from django.contrib import messages
from django.contrib.auth import get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST

from ai.models import GroqAnalysis

from .forms import StrictPasswordChangeForm, get_password_requirement_error


def index(request):
    return render(request, "index.html")


@login_required
def home(request):
    projects = GroqAnalysis.objects.filter(user=request.user).only(
        "id",
        "prompt",
        "created_at",
    )
    return render(request, "home.html", {"projects": projects})


@require_POST
def logout_view(request):
    logout(request)
    return redirect("index")


@login_required
def profile(request):
    return render(
        request,
        "profile.html",
        {"password_form": StrictPasswordChangeForm(request.user)},
    )


@login_required
@require_POST
def change_password(request):
    password_form = StrictPasswordChangeForm(request.user, request.POST)

    if not password_form.is_valid():
        return render(request, "profile.html", {"password_form": password_form})

    user = password_form.save()
    update_session_auth_hash(request, user)
    messages.success(request, "Mot de passe modifie avec succes.")

    return redirect("profile")


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

    password_error = get_password_requirement_error(password)
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
