import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("trialbridge")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.beat_schedule = {
    "daily-matching-run": {
        "task": "apps.matching.tasks.run_daily_matching",
        "schedule": crontab(minute=0, hour=6),
    },
    "daily-trial-sync": {
        "task": "apps.trials.tasks.sync_trial_sources",
        "schedule": crontab(minute=20, hour=5),
    },
}
