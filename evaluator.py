"""
Module 9: Evaluator
======================

WHAT THIS MODULE DOES
-----------------------
Runs every row of test_cases.csv through the full pipeline (Orchestrator)
and reports how well the system performed, broken down by `difficulty`
and `case_type` (both columns already provided in your test set).

WHY WE NEED IT
---------------
Without this, you're just guessing whether the system works. This gives
you actual numbers: does retrieval correctly broaden for "Unseen-
combination" cases? Does it correctly say "no evidence" for "Low-
evidence" cases instead of hallucinating confidence?

WHAT GOES IN
------------
test_cases.csv (columns: test_id, equipment_type, model, symptom,
error_code, operating_context, expected_root_cause,
expected_diagnostic_steps, expected_action, difficulty, case_type)
+ a built Pipeline (from orchestrator.setup_pipeline())

WHAT COMES OUT
--------------
A pandas DataFrame, one row per test case, with:
  - the original test case columns
  - status (which retrieval stage fired)
  - predicted_fault, confidence (from the LLM, if call_llm=True)
  - semantic_match_score: how close the LLM's predicted fault is in
    MEANING to the expected_root_cause (computed by embedding both and
    measuring cosine similarity -- reusing Module 2 for this)

HOW IT CONNECTS
-----------------
    test_cases.csv  ---\\
    orchestrator.py  ---->--- [THIS MODULE] ---> results DataFrame (+ printed summary)

DESIGN NOTE: `call_llm=False` mode lets you check RETRIEVAL quality alone
(fast, free, no API calls) before spending API credits on the full
pipeline including Gemini calls. Recommended: run with call_llm=False
first, inspect the status distribution, THEN run with call_llm=True.
"""

import numpy as np
import pandas as pd

from orchestrator import diagnose
from embedder import embed_texts
from data_loader import build_query_retrieval_text
from retriever import retrieve_evidence
from context_builder import build_context


def load_test_cases(test_cases_csv_path: str) -> pd.DataFrame:
    """Load test_cases.csv as-is."""
    return pd.read_csv(test_cases_csv_path)


def _cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """Both vectors are already L2-normalized (from embed_texts()), so a
    plain dot product IS the cosine similarity -- same principle used
    throughout Modules 2-4."""
    return float(np.dot(vec_a, vec_b))


def run_evaluation(test_cases_df: pd.DataFrame, pipeline, api_key: str = None,
                    call_llm: bool = True) -> pd.DataFrame:
    """
    Run every test case through the pipeline.

    If call_llm=False: only runs retrieval (Modules 2-5), skips the
    Gemini call entirely. Fast, free, and useful for checking retrieval
    quality alone first.

    If call_llm=True: runs the full pipeline including Gemini, and also
    computes semantic_match_score (predicted fault vs expected_root_cause).
    """
    results = []

    # Pre-embed all expected_root_cause values ONCE (batched), rather than
    # one at a time in the loop -- much faster, same principle as batching
    # in Module 2.
    if call_llm:
        expected_vectors = embed_texts(test_cases_df["expected_root_cause"].tolist())

    for i, row in test_cases_df.reset_index(drop=True).iterrows():
        query_text = build_query_retrieval_text(row["equipment_type"], row["symptom"])

        if call_llm:
            result = diagnose(
                pipeline=pipeline,
                equipment_type=row["equipment_type"],
                symptom_text=row["symptom"],
                api_key=api_key,
                equipment_id=None,   # test_cases.csv has no specific equipment_id
            )
            predicted_fault = result["diagnosis"]["likely_fault"]
            confidence = result["diagnosis"]["confidence"]
            status = result["status"]

            predicted_vector = embed_texts([predicted_fault])[0]
            match_score = _cosine_similarity(predicted_vector, expected_vectors[i])
        else:
            # Retrieval-only path: skip the LLM call entirely.
            from embedder import embed_single_text
            query_vector = embed_single_text(query_text)
            retrieval_result = retrieve_evidence(
                query_vector=query_vector,
                equipment_id=None,
                records_df=pipeline.records_df,
                all_incident_embeddings=pipeline.all_incident_embeddings,
                incident_index=pipeline.incident_index,
                guide_df=pipeline.guides_df,
                guide_index=pipeline.guide_index,
            )
            status = retrieval_result["status"]
            predicted_fault = None
            confidence = None
            match_score = None

        results.append({
            "test_id": row["test_id"],
            "equipment_type": row["equipment_type"],
            "difficulty": row["difficulty"],
            "case_type": row["case_type"],
            "symptom": row["symptom"],
            "expected_root_cause": row["expected_root_cause"],
            "status": status,
            "predicted_fault": predicted_fault,
            "confidence": confidence,
            "semantic_match_score": match_score,
        })

    return pd.DataFrame(results)


def summarize_results(results_df: pd.DataFrame) -> None:
    """
    Print a readable summary: retrieval status distribution broken down
    by difficulty and case_type, plus average semantic_match_score if
    the LLM was called.
    """
    print("=== Retrieval status by difficulty ===")
    print(pd.crosstab(results_df["difficulty"], results_df["status"]))
    print()

    print("=== Retrieval status by case_type ===")
    print(pd.crosstab(results_df["case_type"], results_df["status"]))
    print()

    if results_df["semantic_match_score"].notna().any():
        print("=== Average semantic match score (predicted vs expected root cause) ===")
        print(results_df.groupby("difficulty")["semantic_match_score"].mean())
        print()
        print(results_df.groupby("case_type")["semantic_match_score"].mean())
