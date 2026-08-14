import re

from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm


class EmailOrUsernameAuthenticationForm(AuthenticationForm):
    def clean(self):
        username = self.cleaned_data.get("username")

        if username and "@" in username:
            User = get_user_model()
            user = User.objects.filter(email__iexact=username).first()

            if user:
                self.cleaned_data["username"] = user.get_username()

        return super().clean()


def get_password_requirement_error(password):
    if len(password) < 12:
        return "Le mot de passe doit contenir au moins 12 caracteres."

    if not re.search(r"\d", password):
        return "Le mot de passe doit contenir un chiffre."

    if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password):
        return "Le mot de passe doit contenir une majuscule et une minuscule."

    if not re.search(r"[^A-Za-z0-9]", password):
        return "Le mot de passe doit contenir un caractere special."

    return None


class StrictPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["new_password1"].widget.attrs["data-password-input"] = ""

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("new_password1")
        password_error = get_password_requirement_error(password) if password else None

        if password_error:
            self.add_error("new_password1", password_error)

        return cleaned_data
