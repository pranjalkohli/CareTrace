import csv
from pathlib import Path


BADGE_LOG_PATH = Path("data/badge_logs/badge_logs.csv")

AUTHORIZED_BADGE_ID = "BADGE-001"
AUTHORIZED_ZONE = "restricted_area"


def simulate_authorized_swipe(event_time):
    """
    Simulates an access-control system recording
    the authorized person's badge swipe.

    The badge ID is fixed.
    The timestamp comes from the actual CCTV event time.
    """

    BADGE_LOG_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with open(
        BADGE_LOG_PATH,
        "a",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.writer(file)

        # Add header if the file is empty
        if BADGE_LOG_PATH.stat().st_size == 0:
            writer.writerow(
                ["timestamp", "badge_id", "zone"]
            )

        writer.writerow(
            [
                event_time.strftime("%Y-%m-%d %H:%M:%S"),
                AUTHORIZED_BADGE_ID,
                AUTHORIZED_ZONE
            ]
        )

    print(
        f"🎫 Simulated badge swipe: "
        f"{AUTHORIZED_BADGE_ID} "
        f"at {event_time.strftime('%H:%M:%S')}"
    )

    return {
        "badge_id": AUTHORIZED_BADGE_ID,
        "zone": AUTHORIZED_ZONE,
        "timestamp": event_time
    }