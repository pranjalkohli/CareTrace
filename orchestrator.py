"""
Module 8: Orchestrator
=========================

WHAT THIS MODULE DOES
-----------------------
Ties every other module together into two simple functions:
  1. setup_pipeline()  -- run ONCE at startup: loads data, builds embeddings
                           and FAISS indices for both incidents and guides.
  2. diagnose()         -- run PER QUERY: takes an equipment_id (optional)
                           + symptom text, runs it through retrieval,
                           context building, and the LLM, returns the
                           final structured diagnosis.

WHY WE NEED IT
---------------
Without this, you'd have to manually call 6 different modules in the
right order every single time you want a diagnosis. This is the single
entry point a future UI, API endpoint, or evaluation script would call.

WHAT GOES IN
------------
setup_pipeline(): paths to your CSV files and guides folder
diagnose(): equipment_id (or None), equipment_type, symptom_text,
            the pipeline object from setup_pipeline(), and your Gemini API key

WHAT COMES OUT
--------------
diagnose() returns one dictionary with EVERYTHING:
    {
        "status": "equipment_specific" | "broadened_history" | "guide_only" | "no_relevant_evidence",
        "evidence": [...],              # from Module 4
        "context_text": "...",          # from Module 5
        "diagnosis": {                  # from Module 6
            "likely_fault": ...,
            "reasoning": ...,
            "recommended_action": ...,
            "confidence": ...,
            "evidence_basis": ...,
        }
    }

HOW IT CONNECTS
-----------------
    data_loader.py, guide_loader.py  ---\\
    embedder.py, vector_store.py      ---->--- [THIS MODULE] ---> final diagnosis dict
    retriever.py, context_builder.py  ---/
    llm_client.py                    ---/
"""

from dataclasses import dataclass

from data_loader import build_incident_records, build_query_retrieval_text
from guide_loader import load_guide_chunks
from embedder import embed_texts, embed_single_text
from vector_store import build_index
from retriever import retrieve_evidence
from context_builder import build_context
from llm_client import generate_diagnosis


@dataclass
class Pipeline:
    """
    Holds everything that only needs to be built ONCE (loading data,
    embedding it, building FAISS indices) so diagnose() can be called
    repeatedly and cheaply afterward without redoing that setup work
    every time.
    """
    records_df: object
    guides_df: object
    all_incident_embeddings: object
    incident_index: object
    guide_index: object


def setup_pipeline(equipment_csv_path: str, incidents_csv_path: str, guides_folder_path: str) -> Pipeline:
    """
    Run this ONCE when your program starts. It's the slow step (loading
    data + computing embeddings for ~950 records), so don't call it
    again for every new query -- reuse the returned Pipeline object.
    """
    records_df = build_incident_records(equipment_csv_path, incidents_csv_path).reset_index(drop=True)
    guides_df = load_guide_chunks(guides_folder_path).reset_index(drop=True)

    all_incident_embeddings = embed_texts(records_df["retrieval_text"].tolist())
    all_guide_embeddings = embed_texts(guides_df["retrieval_text"].tolist())

    incident_index = build_index(all_incident_embeddings)
    guide_index = build_index(all_guide_embeddings)

    return Pipeline(
        records_df=records_df,
        guides_df=guides_df,
        all_incident_embeddings=all_incident_embeddings,
        incident_index=incident_index,
        guide_index=guide_index,
    )


def diagnose(pipeline: Pipeline, equipment_type: str, symptom_text: str, api_key: str,
             equipment_id: str = None) -> dict:
    """
    Run one full diagnosis: embed the query, retrieve evidence (with the
    4-stage fallback), build context, and call the LLM.

    equipment_id is OPTIONAL -- pass a real ID (e.g. "EQ-VEN-001") when
    you know the specific unit, or leave it as None when you only know
    the equipment type (this correctly skips straight to the broadened
    search, since there's no specific unit history to check first).
    """
    query_text = build_query_retrieval_text(equipment_type, symptom_text)
    query_vector = embed_single_text(query_text)

    retrieval_result = retrieve_evidence(
        query_vector=query_vector,
        equipment_id=equipment_id,
        records_df=pipeline.records_df,
        all_incident_embeddings=pipeline.all_incident_embeddings,
        incident_index=pipeline.incident_index,
        guide_df=pipeline.guides_df,
        guide_index=pipeline.guide_index,
    )

    # Building the equipment summary row for context_builder.py: if we
    # have a real equipment_id, use its actual record; otherwise build a
    # minimal placeholder row since context_builder expects certain fields.
    if equipment_id is not None:
        equipment_row = pipeline.records_df[pipeline.records_df["equipment_id"] == equipment_id].iloc[0]
    else:
        equipment_row = {
            "equipment_type": equipment_type,
            "manufacturer": "Unknown",
            "model": "Unknown",
            "equipment_id": "Unknown (type-level query)",
            "department": "Unknown",
            "criticality": "Unknown",
            "operating_hours": "Unknown",
        }

    context_text, status = build_context(equipment_row, symptom_text, retrieval_result)

    diagnosis = generate_diagnosis(context_text, status, api_key)

    return {
        "status": status,
        "evidence": retrieval_result["evidence"],
        "context_text": context_text,
        "diagnosis": diagnosis,
    }
