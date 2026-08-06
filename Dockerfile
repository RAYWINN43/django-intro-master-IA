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

ENV PATH="/opt/venv/bin:$PATH"
COPY --from=builder /opt/venv /opt/venv

COPY . .

RUN addgroup -S django && adduser -S -G django django \
    && chown -R django:django /app

USER django

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py seed_users && gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 django_intro.wsgi:application"]
