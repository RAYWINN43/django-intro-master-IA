import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_intro.settings")

app = Celery("django_intro")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
