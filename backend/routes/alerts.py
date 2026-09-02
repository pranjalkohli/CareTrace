from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import models
from schemas import IncidentResponse

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[IncidentResponse])
def get_active_alerts(db: Session = Depends(get_db)):
    """
    Returns CRITICAL incidents that are still OPEN.
    This is what the dashboard should poll to show live alerts.
    """
    return db.query(models.Incident).filter(
        models.Incident.severity == "CRITICAL",
        models.Incident.status == "OPEN"
    ).all()