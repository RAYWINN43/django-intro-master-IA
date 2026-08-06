from django.urls import path

from .views import llama_status, llama_chat

urlpatterns = [
    path("status/", llama_status, name="llama_status"),
    path("chat/", llama_chat, name="llama_chat"),
]
