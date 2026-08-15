import json
from uuid import uuid4

from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse
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
from ai.services.pptx_generator import build_speech_pptx
from ai.services.speech_generator import SpeechGenerator
from ai.services.sprint_generator import SprintGenerator
from ai.services.storymap_generator import StorymapGenerator
from ai.services.swot_generator import SWOTGenerator

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

        raise ValueError("La réponse IA n'est pas un JSON valide.") from error


def clean_list(value):
    if not isinstance(value, list):
        return []

    return [str(item).strip() for item in value if str(item).strip()]


GENERATED_SECTION_KEYS = {
    "personas",
    "user_stories",
    "backlog",
    "business_model",
    "swot",
    "speech",
    "sprint",
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


def normalize_percent(value, default=0):
    try:
        percent = int(value)
    except (TypeError, ValueError):
        percent = default

    return min(max(percent, 0), 100)


def normalize_sprint_status(value):
    status = str(value or "").strip().lower()
    if "cours" in status or status in {"progress", "in_progress"}:
        return "En cours"
    if "termin" in status or status in {"done", "complete", "completed"}:
        return "Terminé"
    return "À faire"


def normalize_sprint_priority(value):
    priority = str(value or "").strip().lower()
    if "haut" in priority or "high" in priority or priority == "p0":
        return "Haute"
    if "bas" in priority or "low" in priority or priority == "p2":
        return "Basse"
    return "Moyenne"


def normalize_sprint_risk(value):
    risk = str(value or "").strip().lower()
    if "elev" in risk or "élev" in risk or "high" in risk:
        return "Élevé"
    if "faible" in risk or "low" in risk:
        return "Faible"
    return "Moyen"


def normalize_sprint_story(story, index):
    story = story if isinstance(story, dict) else {}
    story_text = str(story.get("story") or story.get("title") or "").strip()
    if not story_text:
        story_text = "En tant qu'utilisateur, je souhaite utiliser la fonctionnalite."

    return {
        "id": str(story.get("id") or f"US-{index + 1:02d}"),
        "story": story_text,
        "points": normalize_points(story.get("points")),
        "priority": normalize_sprint_priority(story.get("priority")),
        "status": normalize_sprint_status(story.get("status")),
        "progress_percent": normalize_percent(story.get("progress_percent")),
    }


def normalize_sprint_task(task, index):
    if not isinstance(task, dict):
        task = {"label": task}

    return {
        "label": str(task.get("label") or f"Tache {index + 1}").strip(),
        "status": normalize_sprint_status(task.get("status")),
    }


def normalize_sprint_member(member, index):
    if not isinstance(member, dict):
        member = {"name": member}

    return {
        "name": str(member.get("name") or f"Membre {index + 1}").strip(),
        "role": str(member.get("role") or "Equipe projet").strip(),
    }


def summarize_sprint_statuses(stories):
    summary = {"done": 0, "in_progress": 0, "todo": 0}
    for story in stories:
        status = story.get("status")
        if status == "Terminé":
            summary["done"] += 1
        elif status == "En cours":
            summary["in_progress"] += 1
        else:
            summary["todo"] += 1
    return summary


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

    if not isinstance(stories, list) or len(stories) < 8:
        raise ValueError("La réponse IA doit contenir 8 user stories.")

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

    if not isinstance(backlog, list) or len(backlog) < 8:
        raise ValueError("La réponse IA doit contenir un backlog complet.")

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


def normalize_speech_section(section, index):
    section = section if isinstance(section, dict) else {}
    default_titles = [
        "Introduction",
        "Le problème",
        "Notre solution",
        "Démonstration",
        "Valeur ajoutée",
        "Conclusion",
    ]
    default_times = [
        "0:00 - 0:30",
        "0:30 - 1:00",
        "1:00 - 2:00",
        "2:00 - 3:00",
        "3:00 - 3:30",
        "3:30 - 3:45",
    ]
    content = section.get("content") or ""
    if isinstance(content, list):
        content = "\n".join(str(item).strip() for item in content if str(item).strip())

    return {
        "id": normalize_word_count(section.get("id")) or index + 1,
        "emoji": str(section.get("emoji") or "🎤").strip(),
        "title": str(section.get("title") or default_titles[index % 6]).strip(),
        "time_range": str(
            section.get("time_range") or default_times[index % 6]
        ).strip(),
        "content": str(content).strip(),
    }


def normalize_speech_slide(slide, index, sections):
    slide = slide if isinstance(slide, dict) else {}
    fallback_title = (
        sections[index]["title"] if index < len(sections) else f"Slide {index + 1}"
    )
    return {
        "id": normalize_word_count(slide.get("id")) or index + 1,
        "title": str(slide.get("title") or fallback_title).strip(),
        "visual_suggestion": str(slide.get("visual_suggestion") or "").strip(),
    }


def normalize_word_count(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def normalize_speech_payload(raw_response):
    payload = coerce_payload(raw_response)
    if not isinstance(payload, dict):
        raise TypeError("La réponse IA doit contenir un speech.")

    speech = payload.get("speech", payload)
    if not isinstance(speech, dict):
        raise TypeError("La réponse IA doit contenir un speech.")

    raw_sections = speech.get("sections", [])
    if not isinstance(raw_sections, list) or len(raw_sections) < 6:
        raise ValueError("La réponse IA doit contenir 6 sections de speech.")

    sections = [
        normalize_speech_section(section, index)
        for index, section in enumerate(raw_sections[:6])
    ]
    raw_slides = speech.get("slide_plan", [])
    raw_slides = raw_slides if isinstance(raw_slides, list) else []
    slide_plan = [
        normalize_speech_slide(slide, index, sections)
        for index, slide in enumerate(raw_slides[:6])
    ]
    if not slide_plan:
        slide_plan = [
            normalize_speech_slide({}, index, sections)
            for index in range(len(sections))
        ]

    quick_preview = payload.get("quick_preview", {})
    quick_preview = quick_preview if isinstance(quick_preview, dict) else {}
    word_count = normalize_word_count(speech.get("word_count"))

    return {
        "title": str(speech.get("title") or "Speech / Pitch").strip(),
        "estimated_duration": str(
            speech.get("estimated_duration")
            or quick_preview.get("duration")
            or "3:45 min"
        ).strip(),
        "word_count": word_count,
        "sections": sections,
        "slide_plan": slide_plan[:6],
        "presentation_tips": clean_list(speech.get("presentation_tips"))[:4],
        "quick_preview": {
            "duration": str(
                quick_preview.get("duration")
                or speech.get("estimated_duration")
                or "3:45 min"
            ).strip(),
            "words": normalize_word_count(quick_preview.get("words")) or word_count,
            "sections": normalize_word_count(quick_preview.get("sections"))
            or len(sections),
        },
    }


def normalize_sprint_payload(raw_response):
    payload = coerce_payload(raw_response)
    if not isinstance(payload, dict):
        raise TypeError("La rÃ©ponse IA doit contenir un sprint.")

    sprint = payload.get("sprint", payload)
    if not isinstance(sprint, dict):
        raise TypeError("La rÃ©ponse IA doit contenir un sprint.")

    raw_stories = sprint.get("user_stories", [])
    if not isinstance(raw_stories, list) or len(raw_stories) < 1:
        raise ValueError("La rÃ©ponse IA doit contenir des user stories de sprint.")

    stories = [
        normalize_sprint_story(story, index)
        for index, story in enumerate(raw_stories[:6])
    ]
    raw_tasks = sprint.get("tasks", [])
    raw_tasks = raw_tasks if isinstance(raw_tasks, list) else []
    tasks = [
        normalize_sprint_task(task, index) for index, task in enumerate(raw_tasks[:6])
    ]
    if not tasks:
        tasks = [normalize_sprint_task("Preparer le socle du projet", 0)]

    raw_team = sprint.get("team", [])
    raw_team = raw_team if isinstance(raw_team, list) else []
    team = [
        normalize_sprint_member(member, index)
        for index, member in enumerate(raw_team[:3])
    ]
    if not team:
        team = [
            normalize_sprint_member({"name": "Product Owner", "role": "Cadrage"}, 0)
        ]

    total_points = sum(story["points"] for story in stories)
    summary = payload.get("summary", {})
    summary = summary if isinstance(summary, dict) else {}
    normalized_summary = summarize_sprint_statuses(stories)

    return {
        "sprint": {
            "id": str(sprint.get("id") or "sprint_1"),
            "name": str(sprint.get("name") or "Sprint 1").strip(),
            "status": normalize_sprint_status(sprint.get("status")),
            "goal": str(
                sprint.get("goal") or "Lancer les fondations du projet."
            ).strip(),
            "duration": str(sprint.get("duration") or "2 semaines").strip(),
            "start_label": str(sprint.get("start_label") or "Semaine 1").strip(),
            "end_label": str(sprint.get("end_label") or "Semaine 2").strip(),
            "team_capacity_points": normalize_word_count(
                sprint.get("team_capacity_points")
            )
            or 40,
            "forecast_load_percent": normalize_percent(
                sprint.get("forecast_load_percent"),
                default=85,
            ),
            "risk": normalize_sprint_risk(sprint.get("risk")),
            "total_points": normalize_word_count(sprint.get("total_points"))
            or total_points,
            "planned_points": normalize_word_count(sprint.get("planned_points"))
            or total_points,
            "progress_percent": normalize_percent(sprint.get("progress_percent")),
            "user_stories": stories,
            "tasks": tasks,
            "team": team,
        },
        "summary": {
            "done": normalize_word_count(summary.get("done"))
            or normalized_summary["done"],
            "in_progress": normalize_word_count(summary.get("in_progress"))
            or normalized_summary["in_progress"],
            "todo": normalize_word_count(summary.get("todo"))
            or normalized_summary["todo"],
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


@csrf_exempt
@require_POST
@login_required
def groq_project_swot(request, analysis_id):
    return generate_project_artifact(
        request,
        analysis_id,
        {
            "cache_key": "swot",
            "response_key": "swot",
            "section_label": "SWOT",
            "previous_context_key": "previous_swot_to_avoid",
            "regeneration_instruction": (
                "Genere une nouvelle analyse SWOT. Change les angles "
                "strategiques, les risques, les opportunites et les "
                "recommandations, sans sortir du projet."
            ),
            "generator": SWOTGenerator,
            "normalizer": normalize_swot_payload,
        },
    )


@csrf_exempt
@require_POST
@login_required
def groq_project_speech(request, analysis_id):
    return generate_project_artifact(
        request,
        analysis_id,
        {
            "cache_key": "speech",
            "response_key": "speech",
            "section_label": "Speech / Pitch",
            "previous_context_key": "previous_speech_to_avoid",
            "regeneration_instruction": (
                "Genere une nouvelle version du speech. Change l'accroche, "
                "les formulations, les exemples, la demonstration et le "
                "call-to-action, tout en gardant le meme projet."
            ),
            "generator": SpeechGenerator,
            "normalizer": normalize_speech_payload,
        },
    )


@csrf_exempt
@require_POST
@login_required
def groq_project_sprint(request, analysis_id):
    return generate_project_artifact(
        request,
        analysis_id,
        {
            "cache_key": "sprint",
            "response_key": "sprint",
            "section_label": "Sprint Planning",
            "previous_context_key": "previous_sprint_to_avoid",
            "regeneration_instruction": (
                "Genere une nouvelle version du Sprint 1. Change la selection "
                "des user stories, les taches, les risques ou les estimations, "
                "tout en gardant un premier sprint realiste."
            ),
            "generator": SprintGenerator,
            "normalizer": normalize_sprint_payload,
        },
    )


@csrf_exempt
@require_POST
@login_required
def groq_project_speech_slides(request, analysis_id):
    analysis = get_object_or_404(
        GroqAnalysis,
        pk=analysis_id,
        user=request.user,
    )

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON invalide."}, status=400)

    speech = None
    client_speech = payload.get("speech")
    if client_speech:
        try:
            speech = normalize_speech_payload({"speech": client_speech})
        except (TypeError, ValueError):
            speech = None

    if speech is None:
        speech = get_cached_project_artifact(
            analysis,
            "speech",
            normalize_speech_payload,
        )

    if speech is None:
        return JsonResponse(
            {"error": "Aucun speech disponible pour generer les slides."},
            status=400,
        )

    pptx_content = build_speech_pptx(speech)
    response = HttpResponse(
        pptx_content,
        content_type=(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ),
    )
    response["Content-Disposition"] = (
        f'attachment; filename="speech-project-{analysis.pk}.pptx"'
    )
    return response
