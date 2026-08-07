from django.urls import path

from .views import groq_ask, llama_status, llama_chat

urlpatterns = [
    path("ask/", groq_ask, name="groq_ask"),
    path("status/", llama_status, name="llama_status"),
    path("chat/", llama_chat, name="llama_chat"),
]
