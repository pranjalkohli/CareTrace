from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer
from database import Base


class Incident(Base):
    __tablename__ = "incidents"

    incident_id = Column(String, primary_key=True, index=True)
    event_type = Column(String, nullable=False)
    camera_id = Column(String, nullable=False)
    location = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    badge_detected = Column(Boolean, nullable=True)
    badge_id = Column(String, nullable=True)
    obstruction_percentage = Column(Integer, nullable=True)
    timestamp = Column(DateTime, nullable=False)
    snapshot_path = Column(String, nullable=True)
    status = Column(String, nullable=False)


class EquipmentIncident(Base):
    __tablename__ = "equipment_incidents"

    id = Column(String, primary_key=True, index=True)
    equipment_id = Column(String, nullable=False, index=True)
    equipment_name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    image_path = Column(String, nullable=True)
    analysis = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    timestamp = Column(DateTime, nullable=False)