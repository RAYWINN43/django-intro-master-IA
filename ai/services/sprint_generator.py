from pathlib import Path

from ai.groq_client import GroqClient

SPRINT_STORY_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "story": {"type": "string"},
        "points": {"type": "integer", "enum": [1, 2, 3, 5, 8]},
        "priority": {"type": "string", "enum": ["Haute", "Moyenne", "Basse"]},
        "status": {"type": "string", "enum": ["À faire", "En cours", "Terminée"]},
        "progress_percent": {"type": "integer"},
    },
    "required": [
        "id",
        "story",
        "points",
        "priority",
        "status",
        "progress_percent",
    ],
    "additionalProperties": False,
}

SPRINT_TASK_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string"},
        "status": {"type": "string", "enum": ["À faire", "En cours", "Terminée"]},
    },
    "required": ["label", "status"],
    "additionalProperties": False,
}

SPRINT_MEMBER_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "role": {"type": "string"},
    },
    "required": ["name", "role"],
    "additionalProperties": False,
}

SPRINT_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "sprint_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "sprint": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "status": {
                            "type": "string",
                            "enum": ["À faire", "En cours", "Terminée"],
                        },
                        "goal": {"type": "string"},
                        "duration": {"type": "string"},
                        "start_label": {"type": "string"},
                        "end_label": {"type": "string"},
                        "team_capacity_points": {"type": "integer"},
                        "forecast_load_percent": {"type": "integer"},
                        "risk": {
                            "type": "string",
                            "enum": ["Faible", "Moyen", "Élevé"],
                        },
                        "total_points": {"type": "integer"},
                        "planned_points": {"type": "integer"},
                        "progress_percent": {"type": "integer"},
                        "user_stories": {
                            "type": "array",
                            "items": SPRINT_STORY_SCHEMA,
                            "minItems": 6,
                            "maxItems": 6,
                        },
                        "tasks": {
                            "type": "array",
                            "items": SPRINT_TASK_SCHEMA,
                            "minItems": 6,
                            "maxItems": 6,
                        },
                        "team": {
                            "type": "array",
                            "items": SPRINT_MEMBER_SCHEMA,
                            "minItems": 3,
                            "maxItems": 3,
                        },
                    },
                    "required": [
                        "id",
                        "name",
                        "status",
                        "goal",
                        "duration",
                        "start_label",
                        "end_label",
                        "team_capacity_points",
                        "forecast_load_percent",
                        "risk",
                        "total_points",
                        "planned_points",
                        "progress_percent",
                        "user_stories",
                        "tasks",
                        "team",
                    ],
                    "additionalProperties": False,
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "done": {"type": "integer"},
                        "in_progress": {"type": "integer"},
                        "todo": {"type": "integer"},
                    },
                    "required": ["done", "in_progress", "todo"],
                    "additionalProperties": False,
                },
            },
            "required": ["sprint", "summary"],
            "additionalProperties": False,
        },
    },
}


class SprintGenerator:
    def __init__(self):
        self.llm = GroqClient()

    def generate(self, project_spec):
        pre_prompt = Path("ai/prompts/sprint.md").read_text(encoding="utf-8")

        prompt = f"""
Projet :

{project_spec}
"""
        return self.llm.chat(
            pre_prompt,
            prompt,
            max_tokens=3000,
            response_format=SPRINT_RESPONSE_FORMAT,
            temperature=0.4,
        )
