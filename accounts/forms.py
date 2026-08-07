from django.contrib.auth import get_user_model
from django.contrib.auth.forms import AuthenticationForm


class EmailOrUsernameAuthenticationForm(AuthenticationForm):
    def clean(self):
        username = self.cleaned_data.get("username")

        if username and "@" in username:
            User = get_user_model()
            user = User.objects.filter(email__iexact=username).first()

            if user:
                self.cleaned_data["username"] = user.get_username()

        return super().clean()
