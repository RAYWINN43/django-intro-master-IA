from django.conf import settings


class GroqConfigurationError(RuntimeError):
    pass


class GroqClient:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if getattr(self, "client", None):
            return

        if not settings.GROQ_API_KEY:
            raise GroqConfigurationError(
                "La variable GROQ_API_KEY est manquante dans le .env."
            )

        try:
            from groq import Groq
        except ImportError as error:
            raise GroqConfigurationError(
                "Le package groq n'est pas installe. Relance docker compose up --build."
            ) from error

        self.client = Groq(api_key=settings.GROQ_API_KEY)

    def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens=1600,
        response_format=None,
        temperature=0.2,
    ):
        request_options = {}
        if response_format:
            request_options["response_format"] = response_format

        completion = self.client.chat.completions.create(
            model=settings.GROQ_MODEL,
            temperature=temperature,
            top_p=1,
            max_tokens=max_tokens,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
            **request_options,
        )

        return completion.choices[0].message.content or ""


def get_groq_client():
    return GroqClient()
