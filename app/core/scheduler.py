import logging
from apscheduler.schedulers.background import BackgroundScheduler
from app.services.polling_service import execute_polling_job

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def start_scheduler():
    """Start the background scheduler for periodic polling"""
    # Run polling job every 2 minutes
    scheduler.add_job(
        execute_polling_job,
        'interval',
        minutes=2,
        id='polling_job',
        name='Execute polling job every 2 minutes',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started - polling job will run every 2 minutes")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
