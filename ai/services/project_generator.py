from pathlib import Path

from ai.groq_client import GroqClient


class ProjectGenerator:
    def __init__(self):
        self.llm = GroqClient()

    def generate(self, idea: str):
        pre_prompt = Path("ai/prompts/project.md").read_text()

        return self.llm.chat(pre_prompt, idea)
