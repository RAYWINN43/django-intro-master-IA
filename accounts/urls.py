from django.contrib.auth import views as auth_views
from django.urls import path

from .views import home

login_view = auth_views.LoginView.as_view(
    template_name="index.html",
    redirect_authenticated_user=True,
)

urlpatterns = [
    path("", login_view, name="login"),
    path("login/", login_view, name="login-page"),
    path("home/", home, name="home"),
]
