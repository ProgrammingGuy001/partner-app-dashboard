import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.attendance_autoclose import run_auto_close
from app.services.visit_notifications import run_visit_notifications
from app.utils.attendance_policy import ATTENDANCE_TIMEZONE

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

# Just past midnight IST, close any check-in the IP never closed. Timezone is
# explicit because BackgroundScheduler otherwise uses the host's local time.
scheduler.add_job(
    run_auto_close,
    CronTrigger(hour=0, minute=5, timezone=ATTENDANCE_TIMEZONE),
    id='attendance_auto_close',
    name='Auto clock-out open check-ins at midnight IST',
    replace_existing=True
)

# Customer WhatsApp notices: a visit scheduled outside a request (a job assigned its
# IP) and the hour-before reminder. Five minutes is fine either way — the reminder
# fires as soon as the slot is within the hour, and each entry is claimed once attempted.
scheduler.add_job(
    run_visit_notifications,
    CronTrigger(minute='*/5', timezone=ATTENDANCE_TIMEZONE),
    id='visit_notifications',
    name='Customer visit notices and hour-before reminders',
    replace_existing=True
)
