import json

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .llama_service import LlamaService


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
