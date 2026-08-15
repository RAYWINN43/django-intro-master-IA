from pathlib import Path

from ai.groq_client import GroqClient

SPEECH_SECTION_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "integer"},
        "emoji": {"type": "string"},
        "title": {"type": "string"},
        "time_range": {"type": "string"},
        "content": {"type": "string"},
    },
    "required": ["id", "emoji", "title", "time_range", "content"],
    "additionalProperties": False,
}

SPEECH_SLIDE_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "integer"},
        "title": {"type": "string"},
        "visual_suggestion": {"type": "string"},
    },
    "required": ["id", "title", "visual_suggestion"],
    "additionalProperties": False,
}

SPEECH_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "speech_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "speech": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "estimated_duration": {"type": "string"},
                        "word_count": {"type": "integer"},
                        "sections": {
                            "type": "array",
                            "items": SPEECH_SECTION_SCHEMA,
                            "minItems": 6,
                            "maxItems": 6,
                        },
                        "slide_plan": {
                            "type": "array",
                            "items": SPEECH_SLIDE_SCHEMA,
                            "minItems": 6,
                            "maxItems": 6,
                        },
                        "presentation_tips": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 4,
                            "maxItems": 4,
                        },
                    },
                    "required": [
                        "title",
                        "estimated_duration",
                        "word_count",
                        "sections",
                        "slide_plan",
                        "presentation_tips",
                    ],
                    "additionalProperties": False,
                },
                "quick_preview": {
                    "type": "object",
                    "properties": {
                        "duration": {"type": "string"},
                        "words": {"type": "integer"},
                        "sections": {"type": "integer"},
                    },
                    "required": ["duration", "words", "sections"],
                    "additionalProperties": False,
                },
            },
            "required": ["speech", "quick_preview"],
            "additionalProperties": False,
        },
    },
}


class SpeechGenerator:
    def __init__(self):
        self.llm = GroqClient()

    def generate(self, project_spec):
        pre_prompt = Path("ai/prompts/speech.md").read_text(encoding="utf-8")

        prompt = f"""
Projet :

{project_spec}
"""
        return self.llm.chat(
            pre_prompt,
            prompt,
            max_tokens=3000,
            response_format=SPEECH_RESPONSE_FORMAT,
            temperature=0.4,
        )
