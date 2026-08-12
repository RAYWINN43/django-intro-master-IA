import json
from uuid import uuid4

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.decorators.http import require_GET, require_POST
from groq import GroqError

from ai.groq_client import GroqConfigurationError
from ai.langgraph import ask_groq
from ai.services.persona_generator import PersonaGenerator
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


def extract_json_payload(raw_response):
    cleaned_response = str(raw_response or "").strip()

    if cleaned_response.startswith("```"):
        lines = cleaned_response.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned_response = "\n".join(lines).strip()

    try:
        return json.loads(cleaned_response)
    except json.JSONDecodeError as error:
        for start_marker, end_marker in (("{", "}"), ("[", "]")):
            start_index = cleaned_response.find(start_marker)
            end_index = cleaned_response.rfind(end_marker)

            if start_index == -1 or end_index == -1 or end_index <= start_index:
                continue

            try:
                return json.loads(cleaned_response[start_index : end_index + 1])
            except json.JSONDecodeError:
                continue

        raise ValueError(
            "La réponse IA des personas n'est pas un JSON valide."
        ) from error


def clean_list(value):
    if not isinstance(value, list):
        return []

    return [str(item).strip() for item in value if str(item).strip()]


def normalize_persona(persona, index):
    colors = ["green", "violet", "orange"]
    persona = persona if isinstance(persona, dict) else {}

    return {
        "id": str(persona.get("id") or f"persona_{index + 1}"),
        "card_color": colors[index % len(colors)],
        "name": str(persona.get("name") or f"Persona {index + 1}"),
        "age": str(persona.get("age") or ""),
        "type": str(persona.get("type") or "Profil utilisateur"),
        "portrait": str(persona.get("portrait") or "👤"),
        "location": str(persona.get("location") or ""),
        "job": str(persona.get("job") or ""),
        "social_background": str(persona.get("social_background") or ""),
        "situation": str(persona.get("situation") or ""),
        "tech_level": str(persona.get("tech_level") or persona.get("tech") or ""),
        "summary": str(persona.get("summary") or ""),
        "quote": str(persona.get("quote") or ""),
        "objectives": clean_list(persona.get("objectives"))[:4],
        "needs": clean_list(persona.get("needs"))[:4],
        "frustrations": clean_list(persona.get("frustrations"))[:4],
        "behaviors": clean_list(persona.get("behaviors"))[:4],
        "scenario": str(persona.get("scenario") or ""),
        "expectations": str(persona.get("expectations") or ""),
    }


def normalize_personas_payload(raw_response):
    payload = extract_json_payload(raw_response)

    if isinstance(payload, list):
        personas = payload
    else:
        personas = payload.get("personas", []) if isinstance(payload, dict) else []

    if len(personas) != 3:
        raise ValueError("La réponse IA doit contenir exactement 3 personas.")

    return [normalize_persona(persona, index) for index, persona in enumerate(personas)]


def get_cached_personas(analysis):
    if not isinstance(analysis.response_json, dict):
        return None

    personas = analysis.response_json.get("personas")
    if not isinstance(personas, list) or len(personas) != 3:
        return None

    return [normalize_persona(persona, index) for index, persona in enumerate(personas)]


def cache_personas(analysis, personas):
    response_json = (
        analysis.response_json if isinstance(analysis.response_json, dict) else {}
    )
    response_json["personas"] = personas
    analysis.response_json = response_json
    analysis.save(update_fields=["response_json", "updated_at"])


def get_project_specification(analysis):
    if not isinstance(analysis.response_json, dict):
        return analysis.response_text

    project_specification = analysis.response_json.copy()
    project_specification.pop("personas", None)
    return project_specification


def summarize_previous_personas(personas):
    return [
        {
            "name": persona.get("name"),
            "age": persona.get("age"),
            "type": persona.get("type"),
            "location": persona.get("location"),
            "job": persona.get("job"),
            "social_background": persona.get("social_background"),
        }
        for persona in personas or []
    ]


def build_persona_project_context(
    analysis,
    force_generation=False,
    previous_personas=None,
):
    context = {
        "project_id": analysis.pk,
        "initial_user_idea": analysis.prompt,
        "project_specification": get_project_specification(analysis),
    }

    if force_generation:
        context["generation_mode"] = "regeneration"
        context["regeneration_nonce"] = uuid4().hex
        context["regeneration_instruction"] = (
            "Génère 3 nouveaux personas différents des précédents. "
            "Change les prénoms, les métiers, les lieux, les profils sociaux, "
            "les objectifs et les frustrations, tout en restant cohérent avec le projet."
        )
        if previous_personas:
            context["previous_personas_to_avoid"] = summarize_previous_personas(
                previous_personas
            )

    return json.dumps(
        context,
        ensure_ascii=False,
        indent=2,
    )


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
        answer = str(ask_groq(message))
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


@require_POST
@login_required
def groq_project_personas(request, analysis_id):
    analysis = get_object_or_404(
        GroqAnalysis,
        pk=analysis_id,
        user=request.user,
    )

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON invalide."}, status=400)

    force_generation = bool(payload.get("force"))
    cached_personas = get_cached_personas(analysis)

    if cached_personas and not force_generation:
        return JsonResponse({"personas": cached_personas, "cached": True})

    try:
        raw_personas = PersonaGenerator().generate(
            build_persona_project_context(
                analysis,
                force_generation=force_generation,
                previous_personas=cached_personas,
            )
        )
        personas = normalize_personas_payload(raw_personas)
    except GroqConfigurationError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    except GroqError as exc:
        error_message = str(exc)
        if "rate_limit" in error_message or "Rate limit" in error_message:
            error_message = "Quota Groq atteint. Réessayez dans quelques minutes."
        return JsonResponse({"error": error_message}, status=502)
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    cache_personas(analysis, personas)

    return JsonResponse({"personas": personas, "cached": False})
