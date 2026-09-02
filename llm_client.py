"""
Module 6: Prompt Builder + LLM Client (Gemini)
=================================================

WHAT THIS MODULE DOES
-----------------------
1. Builds the actual instructions sent to the LLM, combining the
   formatted evidence context (Module 5) with rules that change
   depending on how strong that evidence is (the `status` field).
2. Calls the Gemini API (model: gemini-3.7-flash) and parses its
   response into a clean, structured result.

WHY WE NEED IT
---------------
This is the "reasoning" step of the whole pipeline -- where retrieved
evidence actually turns into a diagnosis. The instructions given here
are what prevent the LLM from being falsely confident when evidence is
weak or absent (requirement #9) -- this is arguably the most important
piece of wording in the entire project.

WHAT GOES IN
------------
- context_text: the formatted string from Module 5
- status: "equipment_specific" | "broadened_history" | "guide_only" | "no_relevant_evidence"
- api_key: your Gemini API key

WHAT COMES OUT
--------------
A dictionary:
    {
        "likely_fault": str,
        "reasoning": str,
        "recommended_action": str,
        "confidence": "High" | "Medium" | "Low",
        "evidence_basis": str   -- one-sentence plain-language statement
                                   of what evidence this diagnosis relies on
    }

HOW IT CONNECTS
-----------------
    Module 5 (context_text, status) ---> [THIS MODULE] ---> Final output shown to the user

SETUP NOTE: requires an environment with internet access:
    pip install google-genai pydantic --break-system-packages
Get an API key from https://aistudio.google.com (Google AI Studio).
"""

from google import genai
from google.genai import types
from pydantic import BaseModel
from config import GEMINI_MODEL, LLM_TEMPERATURE

# GEMINI_MODEL and LLM_TEMPERATURE now live in config.py as the single
# source of truth (verified current, GA model name as of testing).


class DiagnosisResult(BaseModel):
    """
    Defines the exact shape we require the LLM's answer to take.
    Passing this class as `response_schema` to the Gemini API forces
    the model to return JSON matching this structure -- no manual
    parsing of loosely-formatted text required.
    """
    likely_fault: str
    reasoning: str
    recommended_action: str
    confidence: str          # "High" | "Medium" | "Low"
    evidence_basis: str      # one-sentence plain statement of what evidence this relies on


# Each status gets its own explicit behavioral RULE for the LLM -- not just
# a description (that's Module 5's job), but an instruction on how to act.
_STATUS_RULES = {
    "equipment_specific": (
        "You have direct historical evidence from THIS SPECIFIC equipment unit. "
        "You may express High or Medium confidence if the cases are clearly similar. "
        "Reference the specific historical case(s) in your reasoning."
    ),
    "broadened_history": (
        "You have historical evidence from OTHER equipment of a similar/related type, "
        "but NOT from this specific unit. Do not claim this exact machine had this exact "
        "issue before. Confidence should generally be Medium, not High, unless the match "
        "is extremely strong."
    ),
    "guide_only": (
        "You have NO historical incident evidence, only official manufacturer guide "
        "references. Be explicit in your reasoning that this is manual-based reasoning, "
        "not evidence of a prior real occurrence. Confidence should generally be Medium "
        "or Low."
    ),
    "no_relevant_evidence": (
        "You have NO relevant historical evidence and NO relevant manual reference. "
        "You MUST clearly state in your reasoning that no historical evidence was found "
        "and that this diagnosis is based on general engineering/clinical-equipment "
        "reasoning alone. Confidence MUST be Low. Do NOT invent or imply historical "
        "support that does not exist."
    ),
}

_BASE_INSTRUCTIONS = """You are assisting hospital biomedical technicians in diagnosing equipment faults.
You will be given retrieved evidence (historical incidents and/or manufacturer guide references)
and a current reported symptom. Use ONLY the evidence provided plus general engineering
reasoning -- do not assume facts not given to you.

Produce:
- likely_fault: your best hypothesis for the underlying fault
- reasoning: your step-by-step reasoning, explicitly referencing which evidence (if any) supports it
- recommended_action: a concrete, actionable next step for the technician
- confidence: High, Medium, or Low
- evidence_basis: one sentence stating what kind of evidence this diagnosis relies on

Be honest and calibrated. Never claim stronger evidence than what was actually provided.
"""


def build_prompt(context_text: str, status: str) -> str:
    """
    Combine the base instructions, the status-specific behavioral rule,
    and the formatted evidence context (from Module 5) into one prompt.
    """
    rule = _STATUS_RULES[status]
    return f"{_BASE_INSTRUCTIONS}\n\nIMPORTANT RULE FOR THIS CASE:\n{rule}\n\n---\n\n{context_text}"


def generate_diagnosis(context_text: str, status: str, api_key: str) -> dict:
    """
    Send the prompt to Gemini and return a structured diagnosis.

    Uses response_schema=DiagnosisResult so Gemini is constrained to
    return valid JSON matching that exact shape -- response.parsed then
    gives us a ready-to-use DiagnosisResult object directly, no manual
    JSON string-cleanup needed.
    """
    prompt = build_prompt(context_text, status)

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=DiagnosisResult,
            temperature=LLM_TEMPERATURE,
        ),
    )

    result: DiagnosisResult = response.parsed
    return result.model_dump()
