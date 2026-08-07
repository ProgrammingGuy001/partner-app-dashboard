import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.attendance_autoclose import run_auto_close
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
