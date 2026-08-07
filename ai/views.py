import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST
from groq import GroqError

from .groq_client import GroqConfigurationError, ask_groq
from .llama_service import LlamaService
from .models import GroqAnalysis


def serialize_analysis(analysis):
    return {
        "id": analysis.pk,
        "prompt": analysis.prompt,
        "response_text": analysis.response_text,
        "created_at": analysis.created_at.isoformat(),
        "detail_url": reverse("groq_analysis_detail", args=[analysis.pk]),
    }


@require_GET
def llama_status(request):
    service = LlamaService()
    return JsonResponse(
        {
            "ok": True,
            "model": service.model,
            "api_key_configured": bool(service.api_key),
        }
    )


@require_POST
def llama_chat(request):
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON invalide."}, status=400)

    prompt = str(payload.get("prompt", "")).strip()
    if not prompt:
        return JsonResponse({"error": "Le champ prompt est obligatoire."}, status=400)

    service = LlamaService()

    try:
        response = service.generate(prompt)
    except (RuntimeError, ValueError) as exc:
        return JsonResponse(
            {
                "error": str(exc),
                "model": service.model,
                "api_key_configured": bool(service.api_key),
            },
            status=502,
        )

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
    except GroqError as exc:
        return JsonResponse(
            {"error": str(exc)},
            status=502,
        )

    parsed_response = None
    try:
        parsed_response = json.loads(answer)
    except json.JSONDecodeError:
        parsed_response = None

    analysis = GroqAnalysis.objects.create(
        user=request.user,
        prompt=message,
        response_text=answer,
        response_json=parsed_response,
    )

    return JsonResponse(
        {
            "answer": answer,
            "project": serialize_analysis(analysis),
        }
    )


@require_GET
@login_required
def groq_analysis_detail(request, analysis_id):
    analysis = get_object_or_404(
        GroqAnalysis,
        pk=analysis_id,
        user=request.user,
    )
    return JsonResponse({"project": serialize_analysis(analysis)})
