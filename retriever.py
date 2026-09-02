"""
Module 4: Retriever
=====================

WHAT THIS MODULE DOES
-----------------------
Implements the actual decision logic your project spec calls for:
    1. Search ONLY this equipment's own history first.
    2. If nothing relevant found, broaden to ALL equipment's history.
    3. If still nothing relevant, fall back to official guide knowledge.
    4. If even that has nothing relevant, say so honestly -- don't
       pretend evidence exists.

WHY WE NEED IT
---------------
Modules 2/3 can find "the most similar things" -- but "most similar"
isn't the same as "similar ENOUGH to trust." A best match with score
0.15 is still the "best" match, but it's noise, not evidence. This
module is where "similarity search" becomes "is this evidence
actually good enough to use," which is the core intelligence of a
trustworthy fault-diagnosis system.

WHAT GOES IN
------------
- A query vector (already embedded by Module 2)
- equipment_id (to check equipment-specific history first)
- The incident records DataFrame + its precomputed embeddings
- The incident FAISS index (built over ALL incidents, for broadened search)
- The guide chunks DataFrame + its FAISS index

WHAT COMES OUT
--------------
A single dictionary:
    {
        "status": "equipment_specific" | "broadened_history" | "guide_only" | "no_relevant_evidence",
        "evidence": [ {...one dict per matched record, with a similarity_score...} ]
    }

HOW IT CONNECTS
-----------------
    Module 2 (query embedding) ---\
    Module 3 (FAISS indices)    ---->--- [THIS MODULE] ---> Module 5 (Context Builder)
    Module 1 (records_df)       ---/                        formats "evidence" into LLM-ready text
    Module 1b (guide_df)       ---/
"""

import numpy as np
from vector_store import search
from config import TOP_K, SIMILARITY_THRESHOLD

# NOTE: TOP_K and SIMILARITY_THRESHOLD now live in config.py as the single
# source of truth. Import them from there rather than redefining locally,
# so every module agrees on the same values.


def _filter_by_threshold(scores: np.ndarray, positions: np.ndarray, threshold: float):
    """
    Keep only the (score, position) pairs that meet the similarity
    threshold. Both scores and positions come pre-sorted best-first (from
    either FAISS or our manual numpy search), so we can stop as soon as
    we hit one below threshold -- but for clarity (and because the list is
    always short: top-5), we just filter the whole thing plainly.
    """
    kept_scores = []
    kept_positions = []
    for score, position in zip(scores, positions):
        if score >= threshold:
            kept_scores.append(score)
            kept_positions.append(position)
    return kept_scores, kept_positions


def _search_equipment_specific(query_vector: np.ndarray, records_df, all_incident_embeddings: np.ndarray,
                                 equipment_id: str, k: int, threshold: float):
    """
    Search ONLY the rows belonging to one equipment_id.

    We do this with plain numpy instead of a FAISS index, because the
    subset is tiny (10-18 rows per your dataset) -- building/searching a
    FAISS index for such a small set adds complexity with no speed
    benefit. A single matrix multiplication (dot product) against ~15
    rows is effectively instant.

    If equipment_id is None (e.g. during evaluation against test_cases.csv,
    which only specifies equipment_type, not a specific unit), this stage
    is skipped entirely -- there is no "this specific machine's history"
    to search, so we go straight to the broadened search.
    """
    if equipment_id is None:
        return [], []

    mask = (records_df["equipment_id"] == equipment_id).to_numpy()
    subset_positions = np.where(mask)[0]   # original row positions where mask is True

    if len(subset_positions) == 0:
        return [], []   # this equipment_id has no history at all

    subset_embeddings = all_incident_embeddings[subset_positions]

    # Since embeddings are L2-normalized (done in Module 2), a plain dot
    # product IS the cosine similarity -- same math FAISS's IndexFlatIP uses.
    similarities = subset_embeddings @ query_vector

    # Sort descending, take top-k
    order = np.argsort(similarities)[::-1][:k]
    top_scores = similarities[order]
    top_original_positions = subset_positions[order]   # map back to full-df positions

    return _filter_by_threshold(top_scores, top_original_positions, threshold)


def _search_all_incidents(query_vector: np.ndarray, incident_index, k: int, threshold: float):
    """Search the FULL incident FAISS index (all equipment, not just one)."""
    scores, positions = search(incident_index, query_vector, k=k)
    return _filter_by_threshold(scores, positions, threshold)


def _search_guides(query_vector: np.ndarray, guide_index, k: int, threshold: float):
    """Search the guide-chunk FAISS index (official troubleshooting knowledge)."""
    scores, positions = search(guide_index, query_vector, k=k)
    return _filter_by_threshold(scores, positions, threshold)


def _build_incident_evidence(records_df, scores, positions) -> list[dict]:
    """
    Convert raw (score, position) pairs into clean evidence dictionaries,
    pulling in the metadata fields that were deliberately EXCLUDED from
    embedding (root_cause, corrective_action) -- this is where that
    historical answer information finally re-enters the pipeline, safely,
    as retrieved context rather than as something the search itself saw.
    """
    evidence = []
    for score, position in zip(scores, positions):
        row = records_df.iloc[position]
        evidence.append({
            "source_type": "incident",
            "similarity_score": float(score),
            "equipment_id": row["equipment_id"],
            "equipment_type": row["equipment_type"],
            "incident_date": row["incident_date"],
            "symptom": row["symptom"],
            "error_code": row["error_code"],
            "root_cause": row["root_cause"],
            "corrective_action": row["corrective_action"],
            "diagnostic_actions": row["diagnostic_actions"],
        })
    return evidence


def _build_guide_evidence(guide_df, scores, positions) -> list[dict]:
    """Same idea as _build_incident_evidence(), but for guide chunks."""
    evidence = []
    for score, position in zip(scores, positions):
        row = guide_df.iloc[position]
        evidence.append({
            "source_type": "guide",
            "similarity_score": float(score),
            "equipment_type": row["equipment_type"],
            "fault_title": row["fault_title"],
            "fault_code": row["fault_code"],
            "possible_causes": row["possible_causes"],
            "diagnostic_procedure": row["diagnostic_procedure"],
            "corrective_action": row["corrective_action"],
        })
    return evidence


def retrieve_evidence(query_vector: np.ndarray, equipment_id, records_df, all_incident_embeddings: np.ndarray,
                       incident_index, guide_df, guide_index, k: int = TOP_K,
                       threshold: float = SIMILARITY_THRESHOLD) -> dict:
    """
    The main orchestrator function for this module -- implements the
    exact fallback chain from your project requirements.

    equipment_id may be None (skips straight to broadened search) --
    used when you only know the equipment TYPE, not a specific unit
    (e.g. during evaluation against test_cases.csv).

    Tries, in order, until one stage finds relevant evidence:
        1. equipment_specific : this exact equipment_id's own history
        2. broadened_history  : all equipment's incident history
        3. guide_only         : official troubleshooting guide knowledge
        4. no_relevant_evidence : none of the above cleared the threshold

    Stopping at the FIRST stage that finds evidence (rather than always
    running all three and merging) is a deliberate choice: it means
    equipment-specific history, when it exists, is trusted as the
    strongest evidence and isn't diluted by weaker matches from
    unrelated equipment.
    """
    # Stage 1: equipment-specific history
    scores, positions = _search_equipment_specific(
        query_vector, records_df, all_incident_embeddings, equipment_id, k, threshold
    )
    if len(scores) > 0:
        return {
            "status": "equipment_specific",
            "evidence": _build_incident_evidence(records_df, scores, positions),
        }

    # Stage 2: broadened to all equipment
    scores, positions = _search_all_incidents(query_vector, incident_index, k, threshold)
    if len(scores) > 0:
        return {
            "status": "broadened_history",
            "evidence": _build_incident_evidence(records_df, scores, positions),
        }

    # Stage 3: official guide knowledge
    scores, positions = _search_guides(query_vector, guide_index, k, threshold)
    if len(scores) > 0:
        return {
            "status": "guide_only",
            "evidence": _build_guide_evidence(guide_df, scores, positions),
        }

    # Stage 4: genuinely nothing relevant found
    return {
        "status": "no_relevant_evidence",
        "evidence": [],
    }
