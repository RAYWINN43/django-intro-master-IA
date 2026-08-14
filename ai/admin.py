from django.contrib import admin

from .models import GroqAnalysis


@admin.register(GroqAnalysis)
class GroqAnalysisAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "prompt_preview", "created_at")
    list_filter = ("created_at",)
    search_fields = (
        "user__username",
        "user__email",
        "prompt",
        "response_text",
    )
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)

    @admin.display(description="Prompt")
    def prompt_preview(self, obj):
        return obj.prompt[:80]
