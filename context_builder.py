"""
Module 5: Context Builder
============================

WHAT THIS MODULE DOES
-----------------------
Takes whatever Module 4 (Retriever) found -- a status + a list of
evidence dicts -- and turns it into a clean, readable block of text
that will be inserted into the LLM prompt.

WHY WE NEED IT
---------------
An LLM reads text, not Python dictionaries or DataFrame rows. More
importantly: the WORDING here is what tells the LLM how much to trust
the evidence. "Here's an exact historical match from this same machine"
and "No history was found; here's a general manual reference" should
read very differently -- that difference in wording is what prevents
the LLM from being overconfident when evidence is actually thin
(your requirement #9).

WHAT GOES IN
------------
- The current equipment's info (a row from records_df or equipment_df)
- The current symptom text (what the user just reported)
- The dict returned by Module 4's retrieve_evidence():
    {"status": ..., "evidence": [...]}

WHAT COMES OUT
--------------
A single formatted string (the "context") ready to be inserted into
the LLM prompt, PLUS the status string passed through unchanged (Module
7 needs this too, to decide how cautiously to instruct the LLM).

HOW IT CONNECTS
-----------------
    Module 4 (retrieve_evidence output) ---> [THIS MODULE] ---> Module 6 (Prompt Builder + LLM Client)
                                                              ---> Module 7 (Fallback Handler) also reads `status`
"""


def _format_equipment_summary(equipment_row) -> str:
    """
    Build a short header describing the equipment itself -- helps the
    LLM ground its reasoning (e.g. a Critical-criticality machine with
    high operating_hours might warrant a more cautious tone).
    """
    return (
        f"Equipment: {equipment_row['equipment_type']} "
        f"({equipment_row['manufacturer']} {equipment_row['model']}), "
        f"ID: {equipment_row['equipment_id']}, "
        f"Department: {equipment_row['department']}, "
        f"Criticality: {equipment_row['criticality']}, "
        f"Operating hours: {equipment_row['operating_hours']}"
    )


def _format_incident_evidence(evidence_list: list[dict]) -> str:
    """
    Format a list of historical-incident evidence dicts (from Module 4)
    into numbered, readable blocks.
    """
    blocks = []
    for i, e in enumerate(evidence_list, 1):
        blocks.append(
            f"Similar Case {i} (equipment: {e['equipment_id']}, "
            f"date: {e['incident_date']}, similarity: {e['similarity_score']:.2f})\n"
            f"  Symptom reported: {e['symptom']}\n"
            f"  Error code: {e['error_code']}\n"
            f"  Diagnostic actions taken: {e['diagnostic_actions']}\n"
            f"  Root cause identified: {e['root_cause']}\n"
            f"  Corrective action taken: {e['corrective_action']}"
        )
    return "\n\n".join(blocks)


def _format_guide_evidence(evidence_list: list[dict]) -> str:
    """
    Format a list of guide-chunk evidence dicts (from Module 4) into
    numbered, readable blocks.
    """
    blocks = []
    for i, e in enumerate(evidence_list, 1):
        blocks.append(
            f"Manual Reference {i} (fault code: {e['fault_code']}, "
            f"similarity: {e['similarity_score']:.2f})\n"
            f"  Fault: {e['fault_title']}\n"
            f"  Possible causes: {e['possible_causes']}\n"
            f"  Diagnostic procedure: {e['diagnostic_procedure']}\n"
            f"  Corrective action: {e['corrective_action']}"
        )
    return "\n\n".join(blocks)


# Each status gets its own honest framing sentence -- this is the single
# most important piece of wording in the whole pipeline, since it's what
# calibrates the LLM's (and eventually the reader's) trust in the evidence.
_STATUS_INTROS = {
    "equipment_specific": (
        "The following cases are from THIS SPECIFIC piece of equipment's own "
        "maintenance history. This is the strongest available evidence."
    ),
    "broadened_history": (
        "No sufficiently similar case was found in this equipment's own history. "
        "The following cases are from OTHER equipment of the same or related type. "
        "Treat this as moderately strong evidence, not a confirmed match to this "
        "specific machine."
    ),
    "guide_only": (
        "No sufficiently similar case was found in ANY historical incident records "
        "(neither this equipment nor others). The following are official "
        "manufacturer troubleshooting guide references that appear relevant. "
        "Treat this as general reference knowledge, not confirmed historical evidence."
    ),
    "no_relevant_evidence": (
        "No sufficiently similar historical incidents or manual references were "
        "found. There is NO retrieved evidence to base a diagnosis on. Any "
        "diagnosis must be based on general engineering/clinical-equipment "
        "reasoning, and this must be stated clearly and explicitly."
    ),
}


def build_context(equipment_row, symptom_text: str, retrieval_result: dict) -> tuple[str, str]:
    """
    The main function of this module. Combines the equipment summary,
    the new symptom, and the retrieved evidence (formatted according to
    its status) into one context string.

    Returns:
        context_text: the full formatted string for the LLM prompt
        status: passed through unchanged, for Module 7 to use
    """
    status = retrieval_result["status"]
    evidence = retrieval_result["evidence"]

    parts = [
        _format_equipment_summary(equipment_row),
        f"\nCurrent reported symptom: {symptom_text}\n",
        _STATUS_INTROS[status],
    ]

    if status in ("equipment_specific", "broadened_history"):
        parts.append("\n" + _format_incident_evidence(evidence))
    elif status == "guide_only":
        parts.append("\n" + _format_guide_evidence(evidence))
    # status == "no_relevant_evidence" -> no evidence block to add

    return "\n".join(parts), status
