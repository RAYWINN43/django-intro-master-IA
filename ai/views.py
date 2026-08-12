import json
from uuid import uuid4

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from groq import GroqError

from ai.groq_client import GroqConfigurationError
from ai.langgraph import ask_groq
from ai.services.backlog_generator import BacklogGenerator
from ai.services.business_model_generator import BusinessModelGenerator
from ai.services.persona_generator import PersonaGenerator
from ai.services.storymap_generator import StorymapGenerator

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


GENERATED_SECTION_KEYS = {
    "personas",
    "user_stories",
    "backlog",
    "business_model",
}


def coerce_payload(raw_response):
    if isinstance(raw_response, str):
        return extract_json_payload(raw_response)
    return raw_response


def normalize_points(value, default=3):
    try:
        points = int(value)
    except (TypeError, ValueError):
        return default

    return points if points in {1, 2, 3, 5, 8} else default


def normalize_story_priority(value):
    priority = str(value or "").strip().lower()
    if "haut" in priority or "high" in priority or priority == "p0":
        return "Haute"
    if "bas" in priority or "low" in priority or priority == "p2":
        return "Basse"
    return "Moyenne"


def normalize_backlog_priority(value, index=0):
    priority = str(value or "").strip().upper()
    if priority in {"P0", "P1", "P2"}:
        return priority
    if "HAUT" in priority or "HIGH" in priority:
        return "P0"
    if "BAS" in priority or "LOW" in priority:
        return "P2"
    return "P0" if index < 2 else "P1"


def normalize_status(value):
    status = str(value or "").strip().lower()
    if "cours" in status or status == "progress":
        return "En cours"
    if "termin" in status or status == "done":
        return "Terminée"
    return "À faire"


def normalize_user_story(story, index):
    story = story if isinstance(story, dict) else {}
    role = str(story.get("role") or "utilisateur").strip()
    action = str(story.get("action") or "utiliser la fonctionnalité").strip()
    benefit = str(
        story.get("benefit") or story.get("purpose") or "répondre à son besoin"
    ).strip()
    story_text = str(story.get("story") or "").strip()
    if not story_text:
        story_text = f"En tant que {role}, je souhaite {action} afin de {benefit}."

    return {
        "id": str(story.get("id") or f"US-{index + 1:02d}"),
        "role": role,
        "action": action,
        "benefit": benefit,
        "story": story_text,
        "priority": normalize_story_priority(story.get("priority")),
        "points": normalize_points(story.get("points")),
        "epic": str(story.get("epic") or "Produit").strip(),
        "status": normalize_status(story.get("status")),
        "acceptance_criteria": clean_list(story.get("acceptance_criteria"))[:5],
    }


def normalize_user_stories_payload(raw_response):
    payload = coerce_payload(raw_response)
    stories = payload.get("user_stories", []) if isinstance(payload, dict) else payload

    if not isinstance(stories, list) or len(stories) < 1:
        raise ValueError("La réponse IA doit contenir des user stories.")

    return [
        normalize_user_story(story, index) for index, story in enumerate(stories[:8])
    ]


def normalize_backlog_item(item, index):
    item = item if isinstance(item, dict) else {}
    title = str(
        item.get("title") or item.get("story") or f"User story {index + 1}"
    ).strip()

    return {
        "id": str(item.get("id") or f"US-{index + 1:02d}"),
        "priority": normalize_backlog_priority(item.get("priority"), index),
        "title": title,
        "story": str(item.get("story") or title).strip(),
        "description": str(item.get("description") or "").strip(),
        "points": normalize_points(item.get("points")),
        "status": normalize_status(item.get("status")),
        "epic": str(item.get("epic") or "Produit").strip(),
        "assignee": str(item.get("assignee") or "Non assigné").strip(),
        "acceptance_criteria": clean_list(item.get("acceptance_criteria"))[:5],
        "notes": str(item.get("notes") or "").strip(),
    }


def normalize_backlog_payload(raw_response):
    payload = coerce_payload(raw_response)
    backlog = payload.get("backlog", []) if isinstance(payload, dict) else payload

    if not isinstance(backlog, list) or len(backlog) < 1:
        raise ValueError("La réponse IA doit contenir un backlog.")

    return [
        normalize_backlog_item(item, index) for index, item in enumerate(backlog[:12])
    ]


def normalize_swot_payload(raw_response):
    payload = coerce_payload(raw_response)
    if not isinstance(payload, dict):
        raise TypeError("La réponse IA doit contenir une SWOT.")

    swot = payload.get("swot", {})
    if not isinstance(swot, dict):
        raise TypeError("La réponse IA doit contenir une SWOT.")

    summary = payload.get("summary", {})
    summary = summary if isinstance(summary, dict) else {}

    return {
        "swot": {
            "strengths": clean_list(swot.get("strengths"))[:4],
            "weaknesses": clean_list(swot.get("weaknesses"))[:4],
            "opportunities": clean_list(swot.get("opportunities"))[:4],
            "threats": clean_list(swot.get("threats"))[:4],
        },
        "recommendations": clean_list(payload.get("recommendations"))[:4],
        "summary": {
            "main_strength": str(summary.get("main_strength") or "").strip(),
            "main_risk": str(summary.get("main_risk") or "").strip(),
            "priority_action": str(summary.get("priority_action") or "").strip(),
        },
    }


def normalize_business_model_payload(raw_response):
    payload = coerce_payload(raw_response)
    if not isinstance(payload, dict):
        raise TypeError("La réponse IA doit contenir un Business Model.")

    canvas = payload.get("business_model_canvas", {})
    if not isinstance(canvas, dict):
        raise TypeError("La réponse IA doit contenir un Business Model Canvas.")

    metrics = payload.get("metrics", {})
    metrics = metrics if isinstance(metrics, dict) else {}
    canvas_keys = [
        "key_partners",
        "key_activities",
        "key_resources",
        "value_propositions",
        "customer_relationships",
        "channels",
        "customer_segments",
        "cost_structure",
        "revenue_streams",
    ]

    return {
        "business_model_canvas": {
            key: clean_list(canvas.get(key))[:4] for key in canvas_keys
        },
        "metrics": {
            "market_potential": str(metrics.get("market_potential") or "Moyen").strip(),
            "complexity": str(metrics.get("complexity") or "Moyenne").strip(),
            "initial_investment": str(
                metrics.get("initial_investment") or "Moyen"
            ).strip(),
            "launch_time": str(metrics.get("launch_time") or "3 - 6 mois").strip(),
            "estimated_profitability": str(
                metrics.get("estimated_profitability") or "Moyenne"
            ).strip(),
        },
        "notes": str(payload.get("notes") or "").strip(),
    }


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


def get_cached_project_artifact(analysis, cache_key, normalizer):
    if not isinstance(analysis.response_json, dict):
        return None

    artifact = analysis.response_json.get(cache_key)
    if artifact is None:
        return None

    try:
        return normalizer(artifact)
    except (TypeError, ValueError):
        return None


def cache_project_artifact(analysis, cache_key, artifact):
    response_json = (
        analysis.response_json if isinstance(analysis.response_json, dict) else {}
    )
    response_json[cache_key] = artifact
    analysis.response_json = response_json
    analysis.save(update_fields=["response_json", "updated_at"])


def get_project_specification(analysis):
    if not isinstance(analysis.response_json, dict):
        return analysis.response_text

    project_specification = analysis.response_json.copy()
    for section_key in GENERATED_SECTION_KEYS:
        project_specification.pop(section_key, None)
    return project_specification


def get_related_generated_sections(analysis, excluded_key):
    if not isinstance(analysis.response_json, dict):
        return {}

    return {
        key: value
        for key, value in analysis.response_json.items()
        if key in GENERATED_SECTION_KEYS and key != excluded_key and value
    }


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


def build_section_project_context(
    analysis,
    section_key,
    section_label,
    previous_context_key,
    regeneration_instruction,
    force_generation=False,
    previous_artifact=None,
):
    context = {
        "project_id": analysis.pk,
        "initial_user_idea": analysis.prompt,
        "requested_section": section_label,
        "project_specification": get_project_specification(analysis),
    }

    related_sections = get_related_generated_sections(analysis, section_key)
    if related_sections:
        context["already_generated_sections"] = related_sections

    if force_generation:
        context["generation_mode"] = "regeneration"
        context["regeneration_nonce"] = uuid4().hex
        context["regeneration_instruction"] = regeneration_instruction
        if previous_artifact:
            context[previous_context_key] = previous_artifact

    return json.dumps(
        context,
        ensure_ascii=False,
        indent=2,
    )


def build_groq_error_response(error):
    error_message = str(error)
    if "rate_limit" in error_message or "Rate limit" in error_message:
        error_message = "Quota Groq atteint. Réessayez dans quelques minutes."
    return JsonResponse({"error": error_message}, status=502)


def generate_project_artifact(request, analysis_id, config):
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
    client_previous_artifact = payload.get("current_artifact")
    cached_artifact = get_cached_project_artifact(
        analysis,
        config["cache_key"],
        config["normalizer"],
    )

    if cached_artifact and not force_generation:
        return JsonResponse(
            {
                config["response_key"]: cached_artifact,
                "cached": True,
            }
        )

    try:
        raw_artifact = config["generator"]().generate(
            build_section_project_context(
                analysis,
                section_key=config["cache_key"],
                section_label=config["section_label"],
                previous_context_key=config["previous_context_key"],
                regeneration_instruction=config["regeneration_instruction"],
                force_generation=force_generation,
                previous_artifact=cached_artifact or client_previous_artifact,
            )
        )
        artifact = config["normalizer"](raw_artifact)
    except GroqConfigurationError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    except GroqError as exc:
        return build_groq_error_response(exc)
    except (TypeError, ValueError) as exc:
        return JsonResponse({"error": str(exc)}, status=502)

    cache_project_artifact(analysis, config["cache_key"], artifact)

    return JsonResponse(
        {
            config["response_key"]: artifact,
            "cached": False,
        }
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
@ensure_csrf_cookie
def groq_analysis_detail(request, analysis_id):
    analysis = get_object_or_404(
        GroqAnalysis,
        pk=analysis_id,
        user=request.user,
    )
    get_token(request)
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


@csrf_exempt
@require_POST
@login_required
def groq_project_user_stories(request, analysis_id):
    return generate_project_artifact(
        request,
        analysis_id,
        {
            "cache_key": "user_stories",
            "response_key": "user_stories",
            "section_label": "User Story",
            "previous_context_key": "previous_user_stories_to_avoid",
            "regeneration_instruction": (
                "Genere une nouvelle version des user stories. Change les roles, "
                "les actions, les benefices, les priorites ou les criteres "
                "d'acceptation, tout en gardant le meme projet."
            ),
            "generator": StorymapGenerator,
            "normalizer": normalize_user_stories_payload,
        },
    )


@csrf_exempt
@require_POST
@login_required
def groq_project_backlog(request, analysis_id):
    return generate_project_artifact(
        request,
        analysis_id,
        {
            "cache_key": "backlog",
            "response_key": "backlog",
            "section_label": "Backlog",
            "previous_context_key": "previous_backlog_to_avoid",
            "regeneration_instruction": (
                "Genere une nouvelle version du backlog. Change l'ordre, les "
                "decoupages, les intitules, les estimations ou les criteres, "
                "tout en restant coherent avec les user stories du projet."
            ),
            "generator": BacklogGenerator,
            "normalizer": normalize_backlog_payload,
        },
    )


@csrf_exempt
@require_POST
@login_required
def groq_project_business_model(request, analysis_id):
    return generate_project_artifact(
        request,
        analysis_id,
        {
            "cache_key": "business_model",
            "response_key": "business_model",
            "section_label": "Business Model Canvas",
            "previous_context_key": "previous_business_model_to_avoid",
            "regeneration_instruction": (
                "Genere une nouvelle version du Business Model Canvas. Change "
                "les hypotheses economiques, les segments, les canaux ou les "
                "sources de revenus, tout en gardant un modele realiste."
            ),
            "generator": BusinessModelGenerator,
            "normalizer": normalize_business_model_payload,
        },
    )
