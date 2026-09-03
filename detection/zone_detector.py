import cv2
import numpy as np

from ultralytics import YOLO

from datetime import datetime, timedelta
from pathlib import Path

import sys

# ==================================================
# PROJECT ROOT
# ==================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))


# ==================================================
# PROJECT IMPORTS
# ==================================================

from monitoring.incident_logger import save_incident
from access.badge_matcher import find_badge_match
from access.demo_badge_simulator import simulate_authorized_swipe

# ==================================================
# CONFIGURATION
# ==================================================

VIDEO_PATH = "data/video/restricted_zone_demo.mp4"
MODEL_PATH = "yolov8n.pt"

CAMERA_ID = "CAM-01"



# ==================================================
# RESTRICTED ZONE
# ==================================================

ZONE = np.load(
    "config/restricted_zone.npy"
)

ZONE_NAME = "restricted_area"


# ==================================================
# TEMPORAL CONFIRMATION
# ==================================================

TEMPORAL_WINDOW_SECONDS = 1.0
MIN_ZONE_DETECTIONS = 7


# ==================================================
# OUTPUT DIRECTORIES
# ==================================================

SNAPSHOT_DIR = Path(
    "outputs/snapshots"
)

SNAPSHOT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ==================================================
# ZONE CHECK
# ==================================================

def is_inside_zone(point):
    """
    Check whether a point is inside
    the restricted polygon.
    """

    return cv2.pointPolygonTest(
        ZONE,
        point,
        False
    ) >= 0


# ==================================================
# SNAPSHOT CAPTURE
# ==================================================

def save_snapshot(frame, event_time):
    """
    Save the relevant CCTV evidence frame.

    The filename uses the SAME timestamp
    as the incident event.
    """

    timestamp = event_time.strftime(
        "%Y%m%d_%H%M%S_%f"
    )

    filename = (
        SNAPSHOT_DIR
        / f"{CAMERA_ID}_restricted_entry_{timestamp}.jpg"
    )

    success = cv2.imwrite(
        str(filename),
        frame
    )

    if success:

        print(
            f"📸 Evidence saved: {filename}"
        )

        return filename

    print(
        "ERROR: Could not save evidence image."
    )

    return filename


# ==================================================
# BADGE CORRELATION
# ==================================================

def check_badge(event_time):
    """
    Check the latest badge logs for a swipe
    associated with this restricted-zone entry.
    """

    return find_badge_match(
        event_time=event_time,
        zone=ZONE_NAME
    )


# ==================================================
# MAIN MONITORING LOOP
# ==================================================

def main():

    print(
        "Loading YOLO model..."
    )

    model = YOLO(
        MODEL_PATH
    )

    video = cv2.VideoCapture(
        VIDEO_PATH
    )

    if not video.isOpened():

        print(
            "ERROR: Could not open video."
        )

        return


    # ==================================================
    # VIDEO INFORMATION
    # ==================================================

    fps = video.get(
        cv2.CAP_PROP_FPS
    )

    if fps <= 0:
        fps = 30


    print(
        "\nCareFlow Restricted-Zone Monitor Started"
    )

    print(
        f"Camera: {CAMERA_ID}"
    )

    print(
        f"Video FPS: {fps:.2f}"
    )

    print(
        "CCTV footage is being processed."
    )

    print(
        "Badge logs will be checked at event time."
    )

    print(
        "Press Q to stop.\n"
    )


    # ==================================================
    # TEMPORAL STATE
    # ==================================================

    zone_detection_times = []

    alert_active = False

    last_zone_frame = None

    authorized_badge_simulated = False


    # ==================================================
    # MAIN LOOP
    # ==================================================

    while True:

        success, frame = video.read()

        if not success:

            print(
                "\nVideo finished."
            )

            break


        # ==============================================
        # PERSON DETECTION
        # ==============================================

        results = model(
            frame,
            classes=[0],
            verbose=False
        )


        person_inside = False


        # ==============================================
        # PROCESS DETECTED PERSONS
        # ==============================================

        for box in results[0].boxes:

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )


            # ------------------------------------------
            # Bottom-center point of person
            # ------------------------------------------

            center_x = (x1 + x2) // 2
            bottom_y = int(y1 + 0.8 * (y2 - y1))

            inside = is_inside_zone((center_x, bottom_y))


            if inside:

                person_inside = True


            # ------------------------------------------
            # Bounding box
            # ------------------------------------------

            box_color = (
                (0, 0, 255)
                if inside
                else (0, 255, 0)
            )

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                box_color,
                2
            )


            # ------------------------------------------
            # Bottom-center point
            # ------------------------------------------

            cv2.circle(
                frame,
                (
                    center_x,
                    bottom_y
                ),
                5,
                (0, 0, 255),
                -1
            )


        # ==============================================
        # DRAW RESTRICTED ZONE
        # ==============================================

        cv2.polylines(
            frame,
            [ZONE],
            True,
            (0, 0, 255),
            3
        )


        # ==============================================
        # CURRENT REAL TIME
        # ==============================================

        current_time = datetime.now()


        # ==============================================
        # PERSON INSIDE RESTRICTED ZONE
        # ==============================================

        if person_inside:

            # Keep the latest frame where a person
            # was actually inside the restricted zone.

            last_zone_frame = frame.copy()

            zone_detection_times.append(
                current_time
            )


        # ==============================================
        # REMOVE OLD DETECTIONS
        # ==============================================

        cutoff_time = (
            current_time
            - timedelta(
                seconds=TEMPORAL_WINDOW_SECONDS
            )
        )


        zone_detection_times = [
            timestamp
            for timestamp in zone_detection_times
            if timestamp >= cutoff_time
        ]


        # ==============================================
        # TEMPORAL CONFIRMATION
        # ==============================================

        confirmed_breach = (
            len(zone_detection_times)
            >= MIN_ZONE_DETECTIONS
        )


        # ==============================================
        # CREATE INCIDENT
        # ==============================================

        if (
            confirmed_breach
            and not alert_active
        ):

            # ------------------------------------------
            # EVENT TIME
            # ------------------------------------------

            event_time = current_time


            print(
                "\n"
                + "=" * 60
            )

            print(
                "🚨 RESTRICTED ZONE ENTRY CONFIRMED"
            )

            print(
                "=" * 60
            )

            print(
                f"📹 Camera: {CAMERA_ID}"
            )

            print(
                f"⏱ Event time: {event_time}"
            )

            print(
                "🧠 Temporal confirmation: "
                f"{len(zone_detection_times)} detections"
            )


            # ==========================================
            # CAPTURE LAST RELEVANT FRAME
            # ==========================================

            if last_zone_frame is not None:

                evidence_frame = (
                    last_zone_frame.copy()
                )

            else:

                evidence_frame = frame.copy()


            snapshot_path = save_snapshot(
                evidence_frame,
                event_time
            )


            # ==========================================
            # BADGE CORRELATION
            # ==========================================

            # ==========================================
            # SIMULATED ACCESS-CONTROL EVENT
            # ==========================================

            if not authorized_badge_simulated:

                simulate_authorized_swipe(
                    event_time - timedelta(seconds=2)
                )

                authorized_badge_simulated = True

            # ==========================================
            # BADGE CORRELATION
            # ==========================================

            badge = check_badge(
                event_time
            )


            # ==========================================
            # DETERMINE SEVERITY
            # ==========================================

            if badge:

                severity = "LOW"

                badge_detected = True

                badge_id = badge.get(
                    "badge_id"
                )

                print(
                    "\n🟢 BADGE MATCH FOUND"
                )

                print(
                    f"Badge ID: {badge_id}"
                )

                print(
                    f"Badge swipe time: "
                    f"{badge['timestamp']}"
                )

                print(
                    "Priority: LOW"
                )

            else:

                severity = "CRITICAL"

                badge_detected = False

                badge_id = None

                print(
                    "\n🔴 NO BADGE MATCH"
                )

                print(
                    "Status: POSSIBLE "
                    "UNAUTHORIZED ENTRY"
                )

                print(
                    "Priority: CRITICAL"
                )


            # ==========================================
            # CREATE INCIDENT
            # ==========================================

            incident = save_incident(
                event_type="restricted_zone_entry",
                location=ZONE_NAME,
                severity=severity,
                badge_detected=badge_detected,
                badge_id=badge_id,
                snapshot_path=snapshot_path,
                event_time=event_time,
                camera_id=CAMERA_ID
            )


            # ==========================================
            # PRINT INCIDENT
            # ==========================================

            print(
                "\n📋 INCIDENT CREATED"
            )

            print(
                f"Incident ID: "
                f"{incident['incident_id']}"
            )

            print(
                f"Severity: "
                f"{incident['severity']}"
            )

            print(
                f"Status: "
                f"{incident['status']}"
            )

            print(
                f"Snapshot: "
                f"{incident['snapshot']}"
            )

            print(
                "=" * 60
                + "\n"
            )


            # ==========================================
            # MARK ENTRY AS HANDLED
            # ==========================================

            alert_active = True

            zone_detection_times = []


        # ==============================================
        # PERSON HAS LEFT THE ZONE
        # ==============================================

        if not person_inside:

            zone_detection_times = []

            if alert_active:

                alert_active = False

            last_zone_frame = None


        # ==============================================
        # VISUAL STATUS
        # ==============================================

        if alert_active:

            status_text = (
                "RESTRICTED ZONE ENTRY"
            )

            status_color = (
                0,
                0,
                255
            )

        elif person_inside:

            status_text = (
                "PERSON IN RESTRICTED ZONE"
            )

            status_color = (
                0,
                165,
                255
            )

        else:

            status_text = (
                "MONITORING"
            )

            status_color = (
                0,
                255,
                0
            )


        cv2.putText(
            frame,
            status_text,
            (40, 60),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            status_color,
            3
        )


        # ==============================================
        # TEMPORAL STATUS
        # ==============================================

        cv2.putText(
            frame,
            (
                f"Temporal detections: "
                f"{len(zone_detection_times)}"
            ),
            (40, 100),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2
        )


        # ==============================================
        # CAMERA ID
        # ==============================================

        cv2.putText(
            frame,
            CAMERA_ID,
            (40, 135),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2
        )


        # ==============================================
        # CCTV WINDOW
        # ==============================================

        cv2.imshow(
            f"CareFlow - {CAMERA_ID}",
            frame
        )


        # ==============================================
        # QUIT
        # ==============================================

        key = cv2.waitKey(
            max(1, int(1000 / fps))
        ) & 0xFF


        if key == ord("q"):

            break


    # ==================================================
    # CLEANUP
    # ==================================================

    video.release()

    cv2.destroyAllWindows()

    print(
        "\nMonitoring stopped."
    )


# ==================================================
# ENTRY POINT
# ==================================================

if __name__ == "__main__":

    main()