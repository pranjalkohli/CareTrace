"""
Module 1: Data Loader
======================

WHAT THIS MODULE DOES
----------------------
Loads the raw CSV files (equipment.csv, incidents.csv) and produces one
clean, merged table where each row = one historical incident, enriched
with static equipment info (install date, criticality, etc).

WHY WE NEED IT
--------------
Every other module (embedding, retrieval, context building) depends on
having one reliable, clean table to read from. If we clean/merge data
in five different places, we get five different bugs. This module is
the single source of truth for "what does one historical record look
like."

WHAT GOES IN
------------
Paths to equipment.csv and incidents.csv

WHAT COMES OUT
--------------
A single pandas DataFrame, one row per incident, with:
  - equipment identity + static info (type, manufacturer, model,
    department, criticality, install date, operating hours)
  - incident details (symptom, error_code, root_cause, corrective_action, etc)
  - a `retrieval_text` column: the exact string that Module 2
    (Embedding Generator) will turn into a vector.

HOW IT CONNECTS
----------------
    equipment.csv ---\
                       >--- [THIS MODULE] ---> clean incidents_df ---> Module 2 (Embedder)
    incidents.csv  ---/                                           ---> Module 5 (Context Builder)
"""

import pandas as pd


# ---------------------------------------------------------------------------
# Columns that exist in BOTH equipment.csv and incidents.csv.
# We trust incidents.csv's own copy of these (it's recorded per-incident),
# so we drop them from equipment.csv before merging to avoid _x/_y suffixes.
# ---------------------------------------------------------------------------
_DUPLICATE_COLUMNS = ["equipment_type", "manufacturer", "model", "department"]

# Columns where a missing value is a normal, expected real-world event
# (not a data-loading bug) -- we fill these with an explicit label instead
# of leaving NaN, because NaN breaks string concatenation later
# (e.g. f"{equipment_type}: {symptom}" would literally become "nan" if
# symptom-related text were missing).
_FILL_VALUES = {
    "error_code": "Not recorded",
    "additional_observations": "None noted",
    "parts_replaced": "None",
}


def load_equipment(equipment_csv_path: str) -> pd.DataFrame:
    """Load equipment.csv as-is. One row per physical equipment unit."""
    return pd.read_csv(equipment_csv_path)


def load_incidents(incidents_csv_path: str) -> pd.DataFrame:
    """
    Load incidents.csv and fill known-missing columns with explicit labels.

    Why fillna here and not later? Because "missing" is a property of the
    raw data itself, not of any particular downstream use of it. Fixing it
    once, here, means every module after this one can assume clean strings.
    """
    incidents = pd.read_csv(incidents_csv_path)
    incidents = incidents.fillna(_FILL_VALUES)
    return incidents


def load_maintenance(maintenance_csv_path: str) -> pd.DataFrame:
    """Load maintenance.csv. Kept separate from incidents (different schema,
    different granularity -- maintenance is routine, incidents are faults)."""
    maintenance = pd.read_csv(maintenance_csv_path)
    maintenance = maintenance.fillna({"components_replaced": "None"})
    return maintenance


def build_incident_records(equipment_csv_path: str, incidents_csv_path: str) -> pd.DataFrame:
    """
    Build the main table this whole project is built on: one row per
    historical incident, enriched with static equipment info.

    Steps:
      1. Load both CSVs.
      2. Drop the columns from `equipment` that already exist in `incidents`
         (avoids the _x/_y duplicate-column problem).
      3. Merge on equipment_id (left join: every incident must have a match,
         since equipment_id is a required field in incidents.csv).
      4. Build the `retrieval_text` column -- the exact text that will later
         be converted into an embedding vector for semantic search.

    IMPORTANT: retrieval_text intentionally does NOT include root_cause or
    corrective_action. Embedding those would let the retrieval step "see"
    the answer it's supposed to help predict for a NEW symptom -- a subtle
    form of data leakage. root_cause/corrective_action stay as metadata,
    retrieved alongside a match but never influencing the match itself.
    """
    equipment = load_equipment(equipment_csv_path)
    incidents = load_incidents(incidents_csv_path)

    # Keep equipment_id (join key) + only the columns unique to equipment.csv
    equipment_static_cols = ["equipment_id"] + [
        col for col in equipment.columns
        if col not in _DUPLICATE_COLUMNS and col != "equipment_id"
    ]
    equipment_slim = equipment[equipment_static_cols]

    merged = incidents.merge(equipment_slim, on="equipment_id", how="left")

    # This is the single formula used everywhere: indexing historical
    # records AND embedding a new incoming query must use this same format,
    # or semantic search compares apples to oranges.
    merged["retrieval_text"] = merged["equipment_type"] + ": " + merged["symptom"]

    return merged


def get_equipment_history(records_df: pd.DataFrame, equipment_id: str) -> pd.DataFrame:
    """
    Return all historical incidents for one specific equipment_id.

    Used by Module 4 (Retriever) for the FIRST search pass: "does this
    exact piece of equipment have relevant history?" before broadening
    to other equipment of the same type.
    """
    return records_df[records_df["equipment_id"] == equipment_id].copy()


def build_query_retrieval_text(equipment_type: str, symptom_text: str) -> str:
    """
    Build the retrieval text for a NEW incoming query, using the exact
    same format as build_incident_records() uses for historical data.

    This function existing separately (instead of duplicating the string
    format inline wherever it's needed) is what guarantees consistency
    between "how historical records were embedded" and "how a new query
    gets embedded." If these two ever drift apart, semantic search breaks
    silently (it'll still run, just return bad matches) -- so keep every
    reference to this format pointed at this one function.
    """
    return f"{equipment_type}: {symptom_text}"
