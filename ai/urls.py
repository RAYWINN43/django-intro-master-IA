from django.urls import path

from .views import llama_chat, llama_status

urlpatterns = [
    path("status/", llama_status, name="llama_status"),
    path("chat/", llama_chat, name="llama_chat"),
]
