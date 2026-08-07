from django.contrib.auth import views as auth_views
from django.urls import path
from django.views.generic import RedirectView

from .forms import EmailOrUsernameAuthenticationForm
from .views import change_password, home, index, profile, register

login_view = auth_views.LoginView.as_view(
    template_name="account.html",
    authentication_form=EmailOrUsernameAuthenticationForm,
    redirect_authenticated_user=True,
    extra_context={"account_mode": "connexion"},
)

urlpatterns = [
    path("", RedirectView.as_view(pattern_name="index", permanent=False), name="root"),
    path("index.html", index, name="index"),
    path("account.html", login_view, name="account"),
    path("login/", login_view, name="login"),
    path("register/", register, name="register"),
    path("home/", home, name="home"),
    path("profile/", profile, name="profile"),
    path("profile/change-password/", change_password, name="change_password"),
]
