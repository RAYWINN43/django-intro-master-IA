from pathlib import Path

from ai.groq_client import GroqClient


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
            max_tokens=4000,
            response_format={"type": "json_object"},
            temperature=0.7,
        )
