from fastapi import FastAPI

from database import Base, engine
from routes import incidents, equipment, alerts

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CareTrace Backend")

app.include_router(incidents.router)
app.include_router(equipment.router)
app.include_router(alerts.router)


@app.get("/")
def root():
    return {"message": "CareTrace Backend is running!"}