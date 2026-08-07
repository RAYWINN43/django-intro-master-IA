from django.conf import settings
from django.db import models


class GroqAnalysis(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="groq_analyses",
    )
    prompt = models.TextField()
    response_text = models.TextField()
    response_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Groq analysis #{self.pk} for {self.user}"
