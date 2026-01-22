import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal

logger = logging.getLogger(__name__)


def execute_polling_job():
    db: Session = SessionLocal()
    try:
        logger.info(f"[POLLING] Job polling started at {datetime.now()}")
        logger.info(f"[POLLING] Job polling completed successfully at {datetime.now()}")
        
    except Exception as e:
        logger.error(f"[POLLING] Error during polling: {str(e)}")
    finally:
        db.close()


def trigger_polling_on_crud():
    """
    Trigger polling immediately after CRUD operations
    Can be called as a background task
    """
    logger.info("[POLLING] Polling triggered by CRUD operation")
    execute_polling_job()
