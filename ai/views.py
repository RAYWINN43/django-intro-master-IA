import json

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .groq_client import GroqConfigurationError, ask_groq
from .llama_service import LlamaService
from .models import GroqAnalysis


@require_GET
def llama_status(request):
    service = LlamaService()
    return JsonResponse({
        "ok": True,
        "model": service.model,
        "api_key_configured": bool(service.api_key),
    })


@require_POST
def llama_chat(request):
    payload = json.loads(request.body.decode("utf-8") or "{}")
    prompt = payload.get("prompt", "")
    service = LlamaService()

    try:
        response = service.generate(prompt)
    except Exception as exc:
        return JsonResponse({
            "error": str(exc),
            "model": service.model,
            "api_key_configured": bool(service.api_key),
        }, status=502)

    return JsonResponse({"response": response})


@require_POST
@login_required
def groq_ask(request):
    payload = json.loads(request.body.decode("utf-8") or "{}")
    message = payload.get("message", "")

    if not message.strip():
        return JsonResponse(
            {"error": "Le champ message est obligatoire."},
            status=400,
        )

    try:
        answer = ask_groq(message)
    except GroqConfigurationError as exc:
        return JsonResponse(
            {"error": str(exc)},
            status=503,
        )
    except Exception as exc:
        return JsonResponse(
            {"error": str(exc)},
            status=502,
        )

    parsed_response = None
    try:
        parsed_response = json.loads(answer)
    except json.JSONDecodeError:
        parsed_response = None

    GroqAnalysis.objects.create(
        user=request.user,
        prompt=message,
        response_text=answer,
        response_json=parsed_response,
    )

    return JsonResponse({"answer": answer})
