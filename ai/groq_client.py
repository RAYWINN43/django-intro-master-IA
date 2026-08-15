import re
import time

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
            from groq import BadRequestError, Groq, RateLimitError
        except ImportError as error:
            raise GroqConfigurationError(
                "Le package groq n'est pas installe. Relance docker compose up --build."
            ) from error

        self.client = Groq(api_key=settings.GROQ_API_KEY)
        self.bad_request_error = BadRequestError
        self.rate_limit_error = RateLimitError

    def _rate_limit_wait_seconds(self, error):
        match = re.search(r"try again in ([0-9.]+)s", str(error), re.IGNORECASE)
        if not match:
            return 5

        return min(max(float(match.group(1)) + 1, 1), 30)

    def _is_json_validation_error(self, error):
        error_message = str(error)
        return (
            "json_validate_failed" in error_message
            or "Failed to validate JSON" in error_message
        )

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

        max_tokens = min(max_tokens, settings.GROQ_MAX_TOKENS)
        retries = settings.GROQ_RATE_LIMIT_RETRIES

        for attempt in range(retries + 1):
            try:
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
            except self.rate_limit_error as error:
                if attempt >= retries:
                    raise

                time.sleep(self._rate_limit_wait_seconds(error))
            except self.bad_request_error as error:
                if response_format and self._is_json_validation_error(error):
                    response_format = None
                    request_options.pop("response_format", None)
                    user_prompt = (
                        f"{user_prompt}\n\n"
                        "Rappel strict : retourne uniquement un objet JSON valide, "
                        "sans Markdown et sans texte avant ou après."
                    )
                    continue

                raise

        return ""


def get_groq_client():
    return GroqClient()
