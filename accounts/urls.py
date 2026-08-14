from django.contrib.auth import views as auth_views
from django.urls import path
from django.views.generic import RedirectView

from .forms import EmailOrUsernameAuthenticationForm
from .views import (
    change_password,
    current_user,
    home,
    index,
    logout_view,
    profile,
    project_page,
    project_section_page,
    register,
)

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
    path("me/", current_user, name="current_user"),
    path("project.html", project_page, name="project_page"),
    path(
        "user-story.html",
        project_section_page,
        {"template_name": "user-story.html"},
        name="user_story_page",
    ),
    path(
        "backlog.html",
        project_section_page,
        {"template_name": "backlog.html"},
        name="backlog_page",
    ),
    path(
        "business-model.html",
        project_section_page,
        {"template_name": "business-model.html"},
        name="business_model_page",
    ),
    path(
        "swot.html",
        project_section_page,
        {"template_name": "swot.html"},
        name="swot_page",
    ),
    path(
        "speech.html",
        project_section_page,
        {"template_name": "speech.html"},
        name="speech_page",
    ),
    path(
        "sprint-planning.html",
        project_section_page,
        {"template_name": "sprint-planning.html"},
        name="sprint_planning_page",
    ),
    path("logout/", logout_view, name="logout"),
    path("profile/", profile, name="profile"),
    path("profile/change-password/", change_password, name="change_password"),
]
