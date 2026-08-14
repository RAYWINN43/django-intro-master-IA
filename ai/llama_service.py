import json
import os
from pathlib import Path
from urllib import error, request


class LlamaService:
    def __init__(self, api_key=None, model=None, base_url=None):
        self._load_env_file()
        self.api_key = (
            api_key
            or os.getenv("GROQ_API_KEY")
            or os.getenv("LLAMA_API_KEY")
            or os.getenv("OPENAI_API_KEY")
        )
        self.model = (
            model
            or os.getenv("GROQ_MODEL")
            or os.getenv("LLAMA_MODEL")
            or "llama-3.3-70b-versatile"
        )
        self.base_url = (
            base_url
            or os.getenv("GROQ_API_BASE_URL")
            or "https://api.groq.com/openai/v1/chat/completions"
        )

        if not self.api_key:
            raise ValueError("No API key found. Set GROQ_API_KEY in the .env file.")

    def _load_env_file(self):
        env_path = Path(__file__).resolve().parent.parent / ".env"
        if not env_path.exists():
            return

        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

    def generate(self, prompt, temperature=0.7, max_tokens=512):
        if not prompt or not str(prompt).strip():
            raise ValueError("A prompt is required.")

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": str(prompt).strip()}],
            "temperature": temperature,
            "max_completion_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        req = request.Request(
            self.base_url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=60) as response:
                body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "ignore")
            raise RuntimeError(f"Groq API error: {exc.code} {detail}") from exc
        except error.URLError as exc:
            raise RuntimeError(f"Unable to reach the Groq API: {exc.reason}") from exc

        data = json.loads(body)
        return data["choices"][0]["message"]["content"].strip()
