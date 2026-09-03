import csv
from datetime import datetime, timedelta


# ==================================================
# CONFIGURATION
# ==================================================

BADGE_LOG_PATH = "data/badge_logs/badge_logs.csv"

# A badge swipe must happen within this many seconds
# BEFORE the person enters the restricted zone.
BADGE_TOLERANCE_SECONDS = 5


# ==================================================
# LOAD BADGE LOGS
# ==================================================

def load_badge_logs():
    """
    Load the latest badge swipe records from CSV.

    Expected CSV format:

    timestamp,badge_id,zone

    Example:

    2026-09-01 23:20:10,B001,restricted_area
    """

    logs = []

    try:
        with open(
            BADGE_LOG_PATH,
            "r",
            newline="",
            encoding="utf-8"
        ) as file:

            reader = csv.DictReader(file)

            for row in reader:

                # Ignore incomplete rows
                if not row.get("timestamp"):
                    continue

                if not row.get("badge_id"):
                    continue

                if not row.get("zone"):
                    continue

                try:
                    row["timestamp"] = datetime.strptime(
                        row["timestamp"],
                        "%Y-%m-%d %H:%M:%S"
                    )

                except ValueError:
                    print(
                        f"⚠️ Invalid badge timestamp: "
                        f"{row['timestamp']}"
                    )
                    continue

                logs.append(row)

    except FileNotFoundError:

        print(
            f"⚠️ Badge log file not found: "
            f"{BADGE_LOG_PATH}"
        )

    except OSError as error:

        print(
            f"⚠️ Could not read badge log: {error}"
        )

    return logs


# ==================================================
# FIND BADGE MATCH
# ==================================================

def find_badge_match(
    event_time,
    zone,
    tolerance_seconds=BADGE_TOLERANCE_SECONDS
):
    """
    Find a badge swipe that occurred shortly BEFORE
    the confirmed CCTV entry.

    Matching rules:

    1. Badge must belong to the same zone.
    2. Badge swipe must happen before the CCTV event.
    3. Badge swipe must be within the tolerance window.

    Returns:
        Matching badge dictionary
        OR
        None if no matching badge exists.
    """

    logs = load_badge_logs()

    if not logs:
        return None

    best_match = None
    smallest_difference = None

    for log in logs:

        # ------------------------------------------
        # CHECK ZONE
        # ------------------------------------------

        if log["zone"] != zone:
            continue

        badge_time = log["timestamp"]

        # ------------------------------------------
        # BADGE MUST BE BEFORE ENTRY
        # ------------------------------------------

        if badge_time > event_time:
            continue

        # ------------------------------------------
        # CALCULATE TIME DIFFERENCE
        # ------------------------------------------

        time_difference = (
            event_time - badge_time
        ).total_seconds()

        # ------------------------------------------
        # CHECK TOLERANCE
        # ------------------------------------------

        if time_difference > tolerance_seconds:
            continue

        # ------------------------------------------
        # KEEP CLOSEST MATCH
        # ------------------------------------------

        if (
            smallest_difference is None
            or time_difference < smallest_difference
        ):

            smallest_difference = time_difference
            best_match = log

    return best_match


# ==================================================
# TEST
# ==================================================

if __name__ == "__main__":

    print("=" * 50)
    print("BADGE MATCHER TEST")
    print("=" * 50)

    test_time = datetime.now()

    print(
        f"\nTesting event time:"
        f" {test_time}"
    )

    match = find_badge_match(
        event_time=test_time,
        zone="restricted_area"
    )

    if match:

        print("\n✅ BADGE MATCH FOUND")

        print(
            f"Badge ID: "
            f"{match['badge_id']}"
        )

        print(
            f"Zone: "
            f"{match['zone']}"
        )

        print(
            f"Swipe time: "
            f"{match['timestamp']}"
        )

    else:

        print(
            "\n❌ NO BADGE MATCH"
        )

    print("\n" + "=" * 50)