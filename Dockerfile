FROM python:3.13-alpine AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml uv.lock* ./
COPY README.md .
COPY src ./src

# Install dependencies using uv
RUN uv pip install --no-cache .

FROM python:3.13-alpine AS production

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=builder /opt/venv /opt/venv

COPY . .

RUN python manage.py collectstatic --noinput \
    && sed -i 's/\r$//' /app/docker/entrypoint.sh \
    && chmod +x /app/docker/entrypoint.sh \
    && addgroup -S django \
    && adduser -S -G django django \
    && chown -R django:django /app

USER django

EXPOSE 8000

ENTRYPOINT ["/app/docker/entrypoint.sh"]

CMD ["gunicorn", "django_intro.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4"]
