from ai.groq_client import GroqClient
from pathlib import Path


class ProjectGenerator:

    def __init__(self):
        self.llm = GroqClient()

    def generate(self, idea: str):

        pre_prompt = Path(
                "ai/prompts/project.md"
            ).read_text()

        response = self.llm.chat(
            pre_prompt,
            idea,
        )

        return response