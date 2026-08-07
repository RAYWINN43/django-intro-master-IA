import json

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .groq_client import GroqConfigurationError, ask_groq


@login_required
@require_POST
def ask(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON invalide."}, status=400)

    message = str(payload.get("message", "")).strip()
    if not message:
        return JsonResponse({"error": "Le champ message est obligatoire."}, status=400)

    try:
        answer = ask_groq(message)
    except GroqConfigurationError as error:
        return JsonResponse({"error": str(error)}, status=503)

    return JsonResponse(
        {
            "model": settings.GROQ_MODEL,
            "answer": answer,
        }
    )
