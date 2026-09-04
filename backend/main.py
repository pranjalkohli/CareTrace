from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import sys
import os
from dotenv import load_dotenv

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from orchestrator import setup_pipeline

from database import Base, engine
from routes import incidents, equipment, alerts



# =========================================================
# CREATE FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="CareTrace Backend"
)
load_dotenv(os.path.join(ROOT_DIR, ".env"))

@app.on_event("startup")
def startup_event():
    app.state.pipeline = setup_pipeline(
        equipment_csv_path=os.path.join(ROOT_DIR, "equipment.csv"),
        incidents_csv_path=os.path.join(ROOT_DIR, "incidents.csv"),
        guides_folder_path=ROOT_DIR,
    )

# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# DATABASE
# =========================================================

Base.metadata.create_all(
    bind=engine
)


# =========================================================
# API ROUTES
# =========================================================

app.include_router(
    incidents.router
)

app.include_router(
    equipment.router
)

app.include_router(
    alerts.router
)


# =========================================================
# ROOT ENDPOINT
# =========================================================

@app.get("/")
def root():
    return {
        "message": "CareTrace Backend is running!"
    }