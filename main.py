"""
main.py -- Runnable Entry Point
==================================

This is the file you actually run. It sets up the pipeline once, then
lets you diagnose a symptom.

SETUP (one time, in an environment WITH internet access):
    pip install sentence-transformers faiss-cpu google-genai pydantic --break-system-packages

Then get a free Gemini API key from https://aistudio.google.com
and paste it in below (or better: set it as an environment variable
GEMINI_API_KEY and read it with os.environ, rather than hardcoding it
in a file you might accidentally share/commit).
"""

import os
from orchestrator import setup_pipeline, diagnose

# Put your CSVs and guide .md files in the same folder as this script,
# or update these paths.
EQUIPMENT_CSV = "equipment.csv"
INCIDENTS_CSV = "incidents.csv"
GUIDES_FOLDER = "knowledge_base"   # folder containing the *_guide.md files

API_KEY = os.environ.get("GEMINI_API_KEY", "PASTE_YOUR_KEY_HERE")


if __name__ == "__main__":
    print("Setting up pipeline (loading data, building embeddings + FAISS indices)...")
    pipeline = setup_pipeline(EQUIPMENT_CSV, INCIDENTS_CSV, GUIDES_FOLDER)
    print(f"Ready. {len(pipeline.records_df)} incidents, {len(pipeline.guides_df)} guide chunks indexed.\n")

    # --- Example diagnosis, with a known equipment_id ---
    result = diagnose(
        pipeline=pipeline,
        equipment_type="Ventilator",
        symptom_text="strange noise and pressure keeps spiking",
        api_key=API_KEY,
        equipment_id="EQ-VEN-001",   # set to None if you only know the equipment TYPE
    )

    print("Status:", result["status"])
    print()
    print("Diagnosis:")
    for key, value in result["diagnosis"].items():
        print(f"  {key}: {value}")
