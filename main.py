"""
main.py -- Runnable Entry Point
================================

Sets up the hospital equipment troubleshooting pipeline and allows
the user to enter an equipment type, optional equipment ID, and
symptom interactively.

It also runs the retrieval-only evaluation on test_cases.csv.
"""

import os
from dotenv import load_dotenv          # <-- add this line

from orchestrator import setup_pipeline, diagnose
from evaluator import load_test_cases, run_evaluation, summarize_results

load_dotenv()                            # <-- add this line, before reading the key

# -------------------------------------------------------------------
# File paths
# -------------------------------------------------------------------
EQUIPMENT_CSV = "equipment.csv"
...


# -------------------------------------------------------------------
# File paths
# -------------------------------------------------------------------

EQUIPMENT_CSV = "equipment.csv"
INCIDENTS_CSV = "incidents.csv"
GUIDES_FOLDER = "knowledge_base"


# -------------------------------------------------------------------
# Gemini API key
# -------------------------------------------------------------------

# Set GEMINI_API_KEY in your environment instead of hardcoding it.
API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError(
        "GEMINI_API_KEY is not set. "
        "Please set your Gemini API key as an environment variable."
    )


# -------------------------------------------------------------------
# Main program
# -------------------------------------------------------------------

if __name__ == "__main__":

    # --- Set up pipeline ---
    print(
        "Setting up pipeline "
        "(loading data, building embeddings + FAISS indices)..."
    )

    pipeline = setup_pipeline(
        EQUIPMENT_CSV,
        INCIDENTS_CSV,
        GUIDES_FOLDER
    )

    print(
        f"Ready. {len(pipeline.records_df)} incidents, "
        f"{len(pipeline.guides_df)} guide chunks indexed.\n"
    )

    # ----------------------------------------------------------------
    # Interactive diagnosis
    # ----------------------------------------------------------------

    print("=== Hospital Equipment Troubleshooting System ===")
    print()

    equipment_type = input("Enter equipment type: ").strip()

    equipment_id = input(
        "Enter equipment ID (press Enter if unknown): "
    ).strip()

    symptom_text = input(
        "Describe the problem: "
    ).strip()

    # Empty equipment ID means that the exact machine is unknown.
    if equipment_id == "":
        equipment_id = None

    # Run diagnosis
    result = diagnose(
        pipeline=pipeline,
        equipment_type=equipment_type,
        symptom_text=symptom_text,
        api_key=API_KEY,
        equipment_id=equipment_id,
    )

          #equipment_type="Ventilator",
          #smptom_text="unusual noise"
          #equipment_id="EQ-VEN-001"

    # ----------------------------------------------------------------
    # Display diagnosis
    # ----------------------------------------------------------------

    print("\nStatus:", result["status"])

    print("\nDiagnosis:")

    for key, value in result["diagnosis"].items():
        print(f"  {key}: {value}")

    # ----------------------------------------------------------------
    # Evaluate the pipeline on test cases
    # ----------------------------------------------------------------

    print("\nRunning retrieval evaluation on test cases...")

    test_cases = load_test_cases("test_cases.csv")

    # call_llm=False means the evaluation does NOT make Gemini calls.
    # It only evaluates the retrieval system.
    results = run_evaluation(
        test_cases_df=test_cases,
        pipeline=pipeline,
        api_key=API_KEY,
        call_llm=False,
    )

    summarize_results(results)

    results.to_csv(
        "evaluation_results.csv",
        index=False
    )

    print(
        "\nEvaluation results saved to evaluation_results.csv"
    )

