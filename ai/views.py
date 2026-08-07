import json

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .llama_service import LlamaService


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
