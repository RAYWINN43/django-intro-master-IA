from pathlib import Path

from ai.groq_client import GroqClient

BACKLOG_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "priority": {"type": "string", "enum": ["P0", "P1", "P2"]},
        "title": {"type": "string"},
        "story": {"type": "string"},
        "description": {"type": "string"},
        "points": {"type": "integer", "enum": [1, 2, 3, 5, 8]},
        "status": {"type": "string", "enum": ["À faire", "En cours", "Terminée"]},
        "epic": {"type": "string"},
        "assignee": {"type": "string"},
        "acceptance_criteria": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 5,
            "maxItems": 5,
        },
        "notes": {"type": "string"},
    },
    "required": [
        "id",
        "priority",
        "title",
        "story",
        "description",
        "points",
        "status",
        "epic",
        "assignee",
        "acceptance_criteria",
        "notes",
    ],
    "additionalProperties": False,
}

BACKLOG_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "backlog_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "backlog": {
                    "type": "array",
                    "items": BACKLOG_ITEM_SCHEMA,
                    "minItems": 12,
                    "maxItems": 12,
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "total_items": {"type": "integer"},
                        "todo": {"type": "integer"},
                        "in_progress": {"type": "integer"},
                        "done": {"type": "integer"},
                        "total_points": {"type": "integer"},
                    },
                    "required": [
                        "total_items",
                        "todo",
                        "in_progress",
                        "done",
                        "total_points",
                    ],
                    "additionalProperties": False,
                },
            },
            "required": ["backlog", "summary"],
            "additionalProperties": False,
        },
    },
}


class BacklogGenerator:

    def __init__(self):
        self.llm = GroqClient()

    def generate(self, project_spec):
        pre_prompt = Path("ai/prompts/backlog.md").read_text(encoding="utf-8")

        prompt = f"""
Projet :

{project_spec}
"""
        return self.llm.chat(
            pre_prompt,
            prompt,
            max_tokens=3000,
            response_format=BACKLOG_RESPONSE_FORMAT,
            temperature=0.4,
        )
