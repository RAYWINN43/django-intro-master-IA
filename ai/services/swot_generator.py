from groq_client import GroqClient
from pathlib import Path

class SWOTGenerator:

    def __init__(self):
        self.llm = GroqClient()

    def generate(self, project_spec):

        pre_prompt = Path(
                "ai/prompts/swot.md"
            ).read_text()

        prompt = f"""
Projet :

{project_spec}
"""
        return self.llm.chat(pre_prompt, prompt)