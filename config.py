"""
config.py -- Single Source of Truth for Tunable Settings
============================================================

WHY THIS FILE EXISTS
----------------------
Every setting that might need tuning as you learn more about your data
(embedding model choice, similarity threshold, model names) lives here,
in ONE place, with the reasoning documented next to it. No other file
should hardcode these values -- they should all import from here.
"""

# ---------------------------------------------------------------------------
# EMBEDDING SETTINGS
# ---------------------------------------------------------------------------
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
# Chosen for: runs locally (no API cost/latency), 384-dim vectors,
# good balance of speed/quality for a dataset this size (~1000 records).

# ---------------------------------------------------------------------------
# RETRIEVAL SETTINGS
# ---------------------------------------------------------------------------
TOP_K = 5
# How many candidate matches to retrieve at each search stage.

SIMILARITY_THRESHOLD = 0.60
# STARTING POINT ONLY. This is a cosine similarity cutoff (range -1 to 1,
# but in practice symptom-text similarities land between 0 and 1).
# A retrieved match scoring BELOW this is treated as "not relevant enough"
# and gets discarded -- this is what allows the system to honestly say
# "no evidence found" instead of forcing a weak match.
#
# TO TUNE THIS: run retrieval on real queries, print the actual scores
# you get back, and look at whether 0.60 is separating genuinely similar
# cases from unrelated ones on YOUR data. Raise it if weak matches are
# slipping through; lower it if good matches are being discarded.

# ---------------------------------------------------------------------------
# LLM SETTINGS
# ---------------------------------------------------------------------------
GEMINI_MODEL = "gemini-3.6-flash"
LLM_TEMPERATURE = 0.2
# Low temperature: this is a diagnostic tool, not a creative one -- we want
# consistent, cautious reasoning rather than varied/creative phrasing.
