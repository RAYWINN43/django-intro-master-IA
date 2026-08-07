from django.conf import settings


class GroqConfigurationError(RuntimeError):
    pass


def ask_groq(message):
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

    client = Groq(api_key=settings.GROQ_API_KEY)
    completion = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": "Tu es un assistant utile, clair et concis.",
            },
            {
                "role": "user",
                "content": message,
            },
        ],
    )

    return completion.choices[0].message.content or ""
