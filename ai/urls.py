from django.urls import path

from .views import (
    groq_analysis_detail,
    groq_ask,
    groq_project_personas,
    llama_chat,
    llama_status,
)

urlpatterns = [
    path("ask/", groq_ask, name="groq_ask"),
    path(
        "projects/<int:analysis_id>/",
        groq_analysis_detail,
        name="groq_analysis_detail",
    ),
    path(
        "projects/<int:analysis_id>/personas/",
        groq_project_personas,
        name="groq_project_personas",
    ),
    path("status/", llama_status, name="llama_status"),
    path("chat/", llama_chat, name="llama_chat"),
]
