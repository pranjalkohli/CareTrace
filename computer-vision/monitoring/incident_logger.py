import json
import requests
from datetime import datetime
from pathlib import Path


# ==================================================
# CONFIGURATION
# ==================================================

INCIDENT_FILE = Path("outputs/incidents.json")

BACKEND_URL = "http://127.0.0.1:8000"


# ==================================================
# LOAD INCIDENTS
# ==================================================

def load_incidents():
    """
    Load existing incidents from the JSON file.
    """

    if not INCIDENT_FILE.exists():
        return []

    try:
        with open(
            INCIDENT_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

        if isinstance(data, list):
            return data

        return []

    except (
        json.JSONDecodeError,
        FileNotFoundError,
        OSError
    ):
        return []


# ==================================================
# SAVE INCIDENT
# ==================================================

def save_incident(
    event_type,
    location,
    severity,
    badge_detected=False,
    badge_id=None,
    snapshot_path=None,
    event_time=None,
    camera_id="CAM-01"
):
    """
    Save an incident locally and send it to the
    CareTrace backend.
    """

    incidents = load_incidents()

    # ==================================================
    # EVENT TIME
    # ==================================================

    if event_time is None:
        event_time = datetime.now()


    # ==================================================
    # VALID EVENT TYPES
    # ==================================================

    valid_event_types = [
        "restricted_zone_entry",
        "exit_obstruction"
    ]

    if event_type not in valid_event_types:
        raise ValueError(
            f"Unsupported event type: {event_type}"
        )


    # ==================================================
    # GENERATE LOCAL INCIDENT ID
    # ==================================================

    incident_number = len(incidents) + 1

    incident_id = f"INC-{incident_number:04d}"


    # ==================================================
    # CREATE INCIDENT
    # ==================================================

    incident = {

        "incident_id": incident_id,

        "camera_id": camera_id,

        "event_type": event_type,

        "location": location,

        "severity": severity,

        "badge_detected": badge_detected,

        "badge_id": badge_id,

        "snapshot": (
            str(snapshot_path)
            if snapshot_path
            else None
        ),

        "timestamp": event_time.strftime(
            "%Y-%m-%d %H:%M:%S"
        ),

        "status": "OPEN"
    }


    # ==================================================
    # SAVE LOCALLY
    # ==================================================

    incidents.append(incident)

    INCIDENT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        INCIDENT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            incidents,
            file,
            indent=4
        )


    print(
        f"📝 Incident saved locally: {incident_id}"
    )


    # ==================================================
    # SEND TO BACKEND
    # ==================================================

    backend_incident = {

        "event_type": event_type,

        "camera_id": camera_id,

        "location": location,

        "severity": severity,

        "badge_detected": badge_detected,

        "badge_id": badge_id,

        "obstruction_percentage": None,

        "timestamp": event_time.isoformat(),

        "snapshot_path": (
            str(snapshot_path)
            if snapshot_path
            else None
        ),

        "status": "OPEN"
    }


    try:

        response = requests.post(
            f"{BACKEND_URL}/incidents",
            json=backend_incident,
            timeout=5
        )

        if response.status_code == 200:

            print(
                "✅ Incident sent to backend successfully"
            )

        else:

            print(
                f"❌ Backend rejected incident: "
                f"{response.status_code} - "
                f"{response.text}"
            )

    except requests.RequestException as error:

        print(
            f"❌ Could not connect to backend: "
            f"{error}"
        )


    return incident