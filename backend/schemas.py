from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class IncidentCreate(BaseModel):
    event_type: str
    camera_id: str
    location: str
    severity: str
    badge_detected: Optional[bool] = None
    badge_id: Optional[str] = None
    obstruction_percentage: Optional[int] = None
    timestamp: datetime
    snapshot_path: Optional[str] = None
    status: Optional[str] = "OPEN"


class IncidentResponse(IncidentCreate):
    incident_id: str

    class Config:
        from_attributes = True

class EquipmentReport(BaseModel):
    equipment_id: str
    equipment_name: str
    description: str
    image_path: Optional[str] = None


class EquipmentResponse(EquipmentReport):
    id: str
    analysis: Optional[str] = None
    recommendation: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True