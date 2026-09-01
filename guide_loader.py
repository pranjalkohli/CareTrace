"""
Module 1b: Knowledge Base Loader (Guide Parser)
=================================================

WHAT THIS MODULE DOES
----------------------
Parses the manufacturer troubleshooting guide markdown files (one per
equipment type) into a table of "chunks" -- one chunk per fault-code
section (e.g. "Flow rate lower than configured (FL-104)").

WHY WE NEED IT
--------------
Your incidents.csv only has ~10-18 records per piece of equipment. For
brand-new or rare symptoms, historical incident data may simply not exist
yet. The guides give the system a second source of evidence: official
troubleshooting knowledge that exists independent of whether it has ever
actually happened before at your hospital. This is what lets the system
say "no similar historical case, but the manual suggests X" instead of
just "no evidence" (your requirement #9).

WHAT GOES IN
------------
A folder of *_guide.md files, each structured as:
    # <Equipment> Troubleshooting and Maintenance Guide
    ## <Fault description> (<CODE>)
    ### Possible causes
    ### Diagnostic procedure
    ### Corrective action
    ### Escalation

WHAT COMES OUT
---------------
A pandas DataFrame, one row per fault-code section, with:
  - equipment_type       (e.g. "Infusion Pump")
  - fault_title          (e.g. "Flow rate lower than configured")
  - fault_code           (e.g. "FL-104")
  - possible_causes, diagnostic_procedure, corrective_action  (metadata)
  - retrieval_text       (the string Module 2 will embed)

HOW IT CONNECTS
-----------------
    *_guide.md files ---> [THIS MODULE] ---> guide_chunks_df ---> Module 2 (Embedder, second index)
                                                               ---> Module 5 (Context Builder)

DESIGN NOTE (consistent with data_loader.py):
retrieval_text = equipment_type + fault_title ONLY.
possible_causes is essentially a diagnosis/hypothesis (like root_cause in
incidents.csv) -- so, same rule as before: we don't embed the "answer,"
we only embed the symptom-like description, and keep the rest as
retrieved metadata.
"""

import os
import re
import pandas as pd


# Guide filenames don't always title-case cleanly (e.g. "ecg" -> "ECG",
# not "Ecg"; "x-ray" -> "X-ray", not "X-Ray"). Mapping explicitly avoids
# guessing wrong and silently breaking equipment_type matching against
# equipment.csv / incidents.csv later.
_FILENAME_TO_EQUIPMENT_TYPE = {
    "blood_analyzer_guide.md": "Blood Analyzer",
    "defibrillator_guide.md": "Defibrillator",
    "dialysis_machine_guide.md": "Dialysis Machine",
    "ecg_machine_guide.md": "ECG Machine",
    "infusion_pump_guide.md": "Infusion Pump",
    "x-ray_machine_guide.md": "X-ray Machine",
    "ventilator_guide.md": "Ventilator",
    "patient_monitor_guide.md": "Patient Monitor",
    "suction_machine_guide.md": "Suction Machine",
}

# This exact heading appears in every guide but contains no fault-specific
# information (it's generic safety boilerplate) -- we skip it so it doesn't
# become a meaningless chunk.
_SECTION_TO_SKIP = "Safety and escalation"


def _split_into_fault_sections(markdown_text: str) -> list[str]:
    """
    Split a guide's raw text on '## ' headings, which mark each fault-code
    section boundary. Returns a list of section blocks (heading + body),
    excluding the "Safety and escalation" boilerplate section.
    """
    # "\n## " ensures we split on section headings only, not any stray
    # line starting with ## inside body text.
    raw_sections = re.split(r"\n## ", markdown_text)

    sections = []
    for block in raw_sections:
        if block.strip().startswith("#"):
            # This is the very first block: "# <Title>\n\nApplicable models..."
            # It's the document header, not a fault section -- skip it.
            continue
        if block.startswith(_SECTION_TO_SKIP):
            continue
        if block.strip():
            sections.append(block)
    return sections


def _parse_fault_section(section_text: str) -> dict:
    """
    Parse one fault section block into its structured parts.

    Input example (section_text):
        "Flow rate lower than configured (FL-104)
        ### Possible causes
        - Partial occlusion in tubing
        - Related connection...
        ### Diagnostic procedure
        1. Inspect tubing path.
        ...
        ### Corrective action
        Replace obstructed tubing if required.
        ### Escalation
        ..."
    """
    lines = section_text.strip().split("\n")
    heading_line = lines[0].strip()

    # Heading format: "<Title> (<CODE>)" -- extract both parts.
    match = re.match(r"^(.*)\((.*)\)\s*$", heading_line)
    if match:
        fault_title = match.group(1).strip()
        fault_code = match.group(2).strip()
    else:
        fault_title = heading_line
        fault_code = "Unknown"

    def _extract_subsection(name: str) -> str:
        """Pull the text under '### <name>' up to the next '###' heading."""
        pattern = rf"### {name}\n(.*?)(?=\n### |\Z)"
        found = re.search(pattern, section_text, re.DOTALL)
        if not found:
            return ""
        # Clean up markdown list markers ("- ", "1. ") into plain text.
        text = found.group(1).strip()
        text = re.sub(r"^[-\d]+\.?\s*", "", text, flags=re.MULTILINE)
        return " ".join(text.split("\n"))

    return {
        "fault_title": fault_title,
        "fault_code": fault_code,
        "possible_causes": _extract_subsection("Possible causes"),
        "diagnostic_procedure": _extract_subsection("Diagnostic procedure"),
        "corrective_action": _extract_subsection("Corrective action"),
    }


def load_guide_chunks(guides_folder_path: str) -> pd.DataFrame:
    """
    Parse every *_guide.md file in the given folder into one row per
    fault-code section.

    This is the main function other modules will call.
    """
    all_chunks = []

    for filename, equipment_type in _FILENAME_TO_EQUIPMENT_TYPE.items():
        file_path = os.path.join(guides_folder_path, filename)
        if not os.path.exists(file_path):
            continue

        with open(file_path, "r") as f:
            markdown_text = f.read()

        sections = _split_into_fault_sections(markdown_text)

        for section in sections:
            parsed = _parse_fault_section(section)
            parsed["equipment_type"] = equipment_type
            parsed["source_file"] = filename
            all_chunks.append(parsed)

    chunks_df = pd.DataFrame(all_chunks)

    # Same principle as build_incident_records(): one formula, used
    # consistently, that never includes the "answer" fields.
    chunks_df["retrieval_text"] = (
        chunks_df["equipment_type"] + ": " + chunks_df["fault_title"]
    )

    return chunks_df
