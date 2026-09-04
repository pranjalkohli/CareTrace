from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import uuid
import os
import shutil

from database import get_db
import models
from schemas import IncidentCreate, IncidentResponse
from services.incident_service import determine_severity


router = APIRouter(prefix="/incidents", tags=["Incidents"])


UPLOAD_DIR_INCIDENTS = "uploads/incidents"
os.makedirs(UPLOAD_DIR_INCIDENTS, exist_ok=True)


# =========================================================
# CREATE INCIDENT
# =========================================================

@router.post("", response_model=IncidentResponse)
def create_incident(
    incident: IncidentCreate,
    db: Session = Depends(get_db)
):
    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"

    calculated_severity = determine_severity(
        db=db,
        badge_detected=incident.badge_detected,
        badge_id=incident.badge_id
    )

    new_incident = models.Incident(
        incident_id=incident_id,
        event_type=incident.event_type,
        camera_id=incident.camera_id,
        location=incident.location,
        severity=calculated_severity,
        badge_detected=incident.badge_detected,
        badge_id=incident.badge_id,
        obstruction_percentage=incident.obstruction_percentage,
        timestamp=incident.timestamp,
        snapshot_path=incident.snapshot_path,
        status=incident.status
    )

    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    return new_incident


# =========================================================
# GET ALL INCIDENTS
# =========================================================

@router.get("", response_model=list[IncidentResponse])
def get_incidents(db: Session = Depends(get_db)):
    return db.query(models.Incident).all()


# =========================================================
# GET SINGLE INCIDENT
# =========================================================

@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db)
):
    incident = (
        db.query(models.Incident)
        .filter(
            models.Incident.incident_id == incident_id
        )
        .first()
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    return incident


# =========================================================
# MARK INCIDENT AS RESOLVED
# =========================================================

@router.post(
    "/{incident_id}/resolve",
    response_model=IncidentResponse
)
def resolve_incident(
    incident_id: str,
    db: Session = Depends(get_db)
):
    incident = (
        db.query(models.Incident)
        .filter(
            models.Incident.incident_id == incident_id
        )
        .first()
    )

    if not incident:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    # Update status
    incident.status = "RESOLVED"

    db.commit()
    db.refresh(incident)

    return incident


# =========================================================
# UPLOAD INCIDENT SNAPSHOT
# =========================================================

@router.post("/upload")
def upload_incident_snapshot(
    file: UploadFile = File(...)
):
    filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"

    filepath = os.path.join(
        UPLOAD_DIR_INCIDENTS,
        filename
    ).replace("\\", "/")

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(
            file.file,
            buffer
        )

    return {
        "snapshot_path": filepath
    }