from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import os
import shutil

from database import get_db
import models
from schemas import EquipmentReport, EquipmentResponse

router = APIRouter(prefix="/equipment", tags=["Equipment"])

UPLOAD_DIR_EQUIPMENT = "uploads/equipment"
os.makedirs(UPLOAD_DIR_EQUIPMENT, exist_ok=True)


@router.post("/upload")
def upload_equipment_image(file: UploadFile = File(...)):
    filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR_EQUIPMENT, filename).replace("\\", "/")

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"image_path": filepath}


@router.post("/report", response_model=EquipmentResponse)
def report_equipment(report: EquipmentReport, db: Session = Depends(get_db)):
    equipment_incident_id = f"EQ-{uuid.uuid4().hex[:8].upper()}"

    new_report = models.EquipmentIncident(
        id=equipment_incident_id,
        equipment_id=report.equipment_id,
        equipment_name=report.equipment_name,
        description=report.description,
        image_path=report.image_path,
        analysis=None,
        recommendation=None,
        timestamp=datetime.utcnow()
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return new_report


@router.get("/{equipment_id}/history", response_model=list[EquipmentResponse])
def get_equipment_history(equipment_id: str, db: Session = Depends(get_db)):
    return db.query(models.EquipmentIncident).filter(
        models.EquipmentIncident.equipment_id == equipment_id
    ).all()


@router.post("/analyze")
def analyze_equipment(equipment_id: str, db: Session = Depends(get_db)):
    equipment = db.query(models.EquipmentIncident).filter(
        models.EquipmentIncident.equipment_id == equipment_id
    ).first()

    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    return {
        "equipment_id": equipment_id,
        "analysis": "pending AI/ML integration",
        "recommendation": "pending AI/ML integration"
    }