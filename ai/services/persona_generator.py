from pathlib import Path

from ai.groq_client import GroqClient

PERSONA_FIELDS = [
    "id",
    "card_color",
    "name",
    "age",
    "type",
    "portrait",
    "location",
    "job",
    "social_background",
    "situation",
    "tech_level",
    "summary",
    "quote",
    "objectives",
    "needs",
    "frustrations",
    "behaviors",
    "scenario",
    "expectations",
]

PERSONA_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "card_color": {"type": "string", "enum": ["green", "violet", "orange"]},
        "name": {"type": "string"},
        "age": {"type": "string"},
        "type": {"type": "string"},
        "portrait": {"type": "string"},
        "location": {"type": "string"},
        "job": {"type": "string"},
        "social_background": {"type": "string"},
        "situation": {"type": "string"},
        "tech_level": {"type": "string"},
        "summary": {"type": "string"},
        "quote": {"type": "string"},
        "objectives": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
        "needs": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
        "frustrations": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
        "behaviors": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
        "scenario": {"type": "string"},
        "expectations": {"type": "string"},
    },
    "required": PERSONA_FIELDS,
    "additionalProperties": False,
}

PERSONA_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "personas_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "personas": {
                    "type": "array",
                    "items": PERSONA_SCHEMA,
                    "minItems": 3,
                    "maxItems": 3,
                }
            },
            "required": ["personas"],
            "additionalProperties": False,
        },
    },
}


class PersonaGenerator:
    def __init__(self):
        self.llm = GroqClient()

    def generate(self, project_spec):

        pre_prompt = Path("ai/prompts/persona.md").read_text(encoding="utf-8")

        prompt = f"""
Projet :

{project_spec}
"""
        return self.llm.chat(
            pre_prompt,
            prompt,
            max_tokens=2600,
            response_format=PERSONA_RESPONSE_FORMAT,
            temperature=0.4,
        )
