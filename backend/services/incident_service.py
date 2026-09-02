from sqlalchemy.orm import Session
import models


def determine_severity(db: Session, badge_detected: bool, badge_id: str | None) -> str:
    """
    Priority rules:
    - No badge detected -> CRITICAL
    - Matching badge + this is the only entry so far -> LOW
    - Matching badge + multiple entries already exist -> CRITICAL
    """
    if not badge_detected or not badge_id:
        return "CRITICAL"

    existing_count = db.query(models.Incident).filter(
        models.Incident.badge_id == badge_id
    ).count()

    if existing_count == 0:
        return "LOW"
    else:
        return "CRITICAL"