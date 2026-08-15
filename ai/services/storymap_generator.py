from pathlib import Path

from ai.groq_client import GroqClient

USER_STORY_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "role": {"type": "string"},
        "action": {"type": "string"},
        "benefit": {"type": "string"},
        "story": {"type": "string"},
        "priority": {"type": "string", "enum": ["Haute", "Moyenne", "Basse"]},
        "points": {"type": "integer", "enum": [1, 2, 3, 5, 8]},
        "epic": {"type": "string"},
        "status": {"type": "string", "enum": ["À faire", "En cours", "Terminée"]},
        "acceptance_criteria": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
    },
    "required": [
        "id",
        "role",
        "action",
        "benefit",
        "story",
        "priority",
        "points",
        "epic",
        "status",
        "acceptance_criteria",
    ],
    "additionalProperties": False,
}

USER_STORY_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "user_stories_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "user_stories": {
                    "type": "array",
                    "items": USER_STORY_SCHEMA,
                    "minItems": 8,
                    "maxItems": 8,
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "total": {"type": "integer"},
                        "high_priority": {"type": "integer"},
                        "medium_priority": {"type": "integer"},
                        "low_priority": {"type": "integer"},
                    },
                    "required": [
                        "total",
                        "high_priority",
                        "medium_priority",
                        "low_priority",
                    ],
                    "additionalProperties": False,
                },
            },
            "required": ["user_stories", "summary"],
            "additionalProperties": False,
        },
    },
}


class StorymapGenerator:

    def __init__(self):
        self.llm = GroqClient()

    def generate(self, project_spec):
        pre_prompt = Path("ai/prompts/storymap.md").read_text(encoding="utf-8")

        prompt = f"""
Projet :

{project_spec}
"""
        return self.llm.chat(
            pre_prompt,
            prompt,
            max_tokens=3000,
            response_format=USER_STORY_RESPONSE_FORMAT,
            temperature=0.4,
        )
