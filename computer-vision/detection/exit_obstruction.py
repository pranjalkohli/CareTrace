import cv2
import numpy as np
from pathlib import Path
from datetime import datetime
import sys


# ==================================================
# PROJECT ROOT
# ==================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJECT_ROOT))


# ==================================================
# INCIDENT LOGGER
# ==================================================

from monitoring.incident_logger import save_incident


# ==================================================
# CONFIGURATION
# ==================================================

VIDEO_PATH = "data/video/exit_obstruction_demo.mp4"

ZONE_PATH = Path(
    "config/exit_zone.npy"
)

CAMERA_ID = "CAM-02"
LOCATION = "Emergency Exit"

SNAPSHOT_DIR = Path(
    "outputs/snapshots"
)

SNAPSHOT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ==================================================
# OBSTRUCTION THRESHOLDS
# ==================================================

NORMAL_THRESHOLD = 20
CRITICAL_THRESHOLD = 30

CONFIRMATION_FRAMES = 8

# First 2.3 seconds = clear pathway
REFERENCE_SECONDS = 2.3

# Pixel difference sensitivity
DIFF_THRESHOLD = 30


# ==================================================
# LOAD EXIT ZONE
# ==================================================

if not ZONE_PATH.exists():

    print("❌ Exit zone not found.")

    print(
        "Run:"
    )

    print(
        "python detection/exit_selector.py"
    )

    sys.exit()


x, y, w, h = np.load(
    ZONE_PATH
).astype(int)


print()
print("✅ Exit zone loaded")

print(
    f"x={x}, y={y}, "
    f"width={w}, height={h}"
)


# ==================================================
# OPEN VIDEO
# ==================================================

cap = cv2.VideoCapture(
    VIDEO_PATH
)

if not cap.isOpened():

    print(
        "❌ Could not open video"
    )

    sys.exit()


fps = cap.get(
    cv2.CAP_PROP_FPS
)

if fps <= 0:
    fps = 30


print(
    f"🎥 Video FPS: {fps:.1f}"
)


# ==================================================
# CREATE CLEAR REFERENCE
# ==================================================

print()
print(
    "⏳ Creating clear pathway reference..."
)

reference_frames = []

reference_frame_count = int(
    fps * REFERENCE_SECONDS
)


for _ in range(
    reference_frame_count
):

    ret, frame = cap.read()

    if not ret:
        break


    exit_area = frame[
        y:y + h,
        x:x + w
    ]


    reference_frames.append(
        exit_area.copy()
    )


if not reference_frames:

    print(
        "❌ Could not create reference"
    )

    cap.release()
    sys.exit()


# ==================================================
# TEMPORAL MEDIAN REFERENCE
# ==================================================

reference_stack = np.stack(
    reference_frames,
    axis=0
)


reference = np.median(
    reference_stack,
    axis=0
).astype(np.uint8)


reference_gray = cv2.cvtColor(
    reference,
    cv2.COLOR_BGR2GRAY
)


reference_gray = cv2.GaussianBlur(
    reference_gray,
    (5, 5),
    0
)


print(
    "✅ Clear pathway reference created"
)


# ==================================================
# RESTART VIDEO
# ==================================================

cap.set(
    cv2.CAP_PROP_POS_FRAMES,
    0
)


# ==================================================
# STATE VARIABLES
# ==================================================

confirmation_frames = 0

current_state = "NORMAL"

warning_logged = False
critical_logged = False


# ==================================================
# MAIN LOOP
# ==================================================

frame_number = 0


while True:

    ret, frame = cap.read()

    if not ret:
        break


    frame_number += 1


    # ==================================================
    # SKIP REFERENCE PERIOD
    # ==================================================

    if frame_number <= reference_frame_count:

        cv2.imshow(
            "Emergency Exit CCTV",
            frame
        )

        if (
            cv2.waitKey(
                max(1, int(1000 / fps))
            ) & 0xFF
            == ord("q")
        ):
            break

        continue


    # ==================================================
    # GET ONLY SELECTED EXIT AREA
    # ==================================================

    exit_area = frame[
        y:y + h,
        x:x + w
    ]


    # ==================================================
    # CURRENT FRAME → GRAYSCALE
    # ==================================================

    current_gray = cv2.cvtColor(
        exit_area,
        cv2.COLOR_BGR2GRAY
    )


    current_gray = cv2.GaussianBlur(
        current_gray,
        (5, 5),
        0
    )


    # ==================================================
    # COMPARE WITH CLEAR PATHWAY
    # ==================================================

    difference = cv2.absdiff(
        reference_gray,
        current_gray
    )


    # ==================================================
    # CREATE OCCUPANCY MASK
    # ==================================================

    _, mask = cv2.threshold(
        difference,
        DIFF_THRESHOLD,
        255,
        cv2.THRESH_BINARY
    )


    # Remove tiny noise
    kernel = np.ones(
        (7, 7),
        np.uint8
    )


    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel
    )


    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel
    )


    # ==================================================
    # CALCULATE COVERAGE
    # ==================================================

    occupied_pixels = cv2.countNonZero(
        mask
    )


    total_pixels = w * h


    obstruction_percentage = (
        occupied_pixels /
        total_pixels
    ) * 100


    # ==================================================
    # DETERMINE STATE
    # ==================================================

    if obstruction_percentage < NORMAL_THRESHOLD:

        severity = "NORMAL"


    elif obstruction_percentage < CRITICAL_THRESHOLD:

        severity = "WARNING"


    else:

        severity = "CRITICAL"


    # ==================================================
    # NORMAL
    # ==================================================

    if severity == "NORMAL":

        confirmation_frames = 0

        current_state = "NORMAL"

        # Completely reset the alert cycle.
        # A new warning/critical event can
        # happen after this.

        warning_logged = False
        critical_logged = False


    # ==================================================
    # WARNING
    # ==================================================

    elif severity == "WARNING":

        # Only count if this is not already
        # an active warning.

        if current_state != "WARNING":

            confirmation_frames = 1

        else:

            confirmation_frames += 1


        current_state = "WARNING"


        # Log warning ONLY ONCE

        if (
            confirmation_frames
            >= CONFIRMATION_FRAMES
            and not warning_logged
        ):

            print()
            print(
                "⚠️ EXIT OBSTRUCTION WARNING"
            )

            print(
                f"Coverage: "
                f"{obstruction_percentage:.1f}%"
            )


            # ------------------------------------------
            # EVENT TIME
            # ------------------------------------------

            event_time = datetime.now()


            # ------------------------------------------
            # SNAPSHOT
            # ------------------------------------------

            timestamp = event_time.strftime(
                "%Y%m%d_%H%M%S"
            )


            snapshot_path = (
                SNAPSHOT_DIR /
                f"CAM-02_exit_warning_"
                f"{timestamp}.jpg"
            )


            snapshot = frame.copy()


            cv2.rectangle(
                snapshot,
                (x, y),
                (x + w, y + h),
                (0, 255, 255),
                3
            )


            cv2.putText(
                snapshot,
                (
                    f"EXIT WARNING: "
                    f"{obstruction_percentage:.1f}%"
                ),
                (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 255, 255),
                2
            )


            cv2.imwrite(
                str(snapshot_path),
                snapshot
            )


            print(
                f"📸 Snapshot saved: "
                f"{snapshot_path}"
            )


            # ------------------------------------------
            # INCIDENT
            # ------------------------------------------

            incident = save_incident(

                event_type="exit_obstruction",

                location=LOCATION,

                severity="WARNING",

                badge_detected=False,

                badge_id=None,

                snapshot_path=snapshot_path,

                event_time=event_time,

                camera_id=CAMERA_ID
            )


            print(
                f"📝 Warning logged: "
                f"{incident['incident_id']}"
            )


            warning_logged = True


        # We are no longer in a critical state
        critical_logged = False


    # ==================================================
    # CRITICAL
    # ==================================================

    else:

        if current_state != "CRITICAL":

            confirmation_frames = 1

        else:

            confirmation_frames += 1


        current_state = "CRITICAL"


        # Log critical ONLY ONCE

        if (
            confirmation_frames
            >= CONFIRMATION_FRAMES
            and not critical_logged
        ):

            print()
            print(
                "🚨 EXIT OBSTRUCTION CRITICAL"
            )

            print(
                f"Coverage: "
                f"{obstruction_percentage:.1f}%"
            )


            # ------------------------------------------
            # EVENT TIME
            # ------------------------------------------

            event_time = datetime.now()


            # ------------------------------------------
            # SNAPSHOT
            # ------------------------------------------

            timestamp = event_time.strftime(
                "%Y%m%d_%H%M%S"
            )


            snapshot_path = (
                SNAPSHOT_DIR /
                f"CAM-02_exit_critical_"
                f"{timestamp}.jpg"
            )


            snapshot = frame.copy()


            cv2.rectangle(
                snapshot,
                (x, y),
                (x + w, y + h),
                (0, 0, 255),
                3
            )


            cv2.putText(
                snapshot,
                (
                    f"EXIT CRITICAL: "
                    f"{obstruction_percentage:.1f}%"
                ),
                (30, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (0, 0, 255),
                2
            )


            cv2.imwrite(
                str(snapshot_path),
                snapshot
            )


            print(
                f"📸 Snapshot saved: "
                f"{snapshot_path}"
            )


            # ------------------------------------------
            # INCIDENT
            # ------------------------------------------

            incident = save_incident(

                event_type="exit_obstruction",

                location=LOCATION,

                severity="CRITICAL",

                badge_detected=False,

                badge_id=None,

                snapshot_path=snapshot_path,

                event_time=event_time,

                camera_id=CAMERA_ID
            )


            print(
                f"📝 Critical logged: "
                f"{incident['incident_id']}"
            )


            critical_logged = True


        # ==================================================
        # IMPORTANT:
        # Once CRITICAL is logged, it stays logged
        # until the exit becomes NORMAL again.
        # ==================================================

        warning_logged = True


    # ==================================================
    # DISPLAY
    # ==================================================

    display = frame.copy()


    # Rectangle colour based on state

    if severity == "NORMAL":

        rectangle_color = (
            0, 255, 0
        )

    elif severity == "WARNING":

        rectangle_color = (
            0, 255, 255
        )

    else:

        rectangle_color = (
            0, 0, 255
        )


    cv2.rectangle(
        display,
        (x, y),
        (x + w, y + h),
        rectangle_color,
        2
    )


    cv2.putText(
        display,
        "EMERGENCY EXIT",
        (
            x,
            max(y - 10, 20)
        ),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        rectangle_color,
        2
    )


    # Percentage

    cv2.putText(
        display,
        (
            f"Obstruction: "
            f"{obstruction_percentage:.1f}%"
        ),
        (30, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )


    # Status

    cv2.putText(
        display,
        f"Status: {severity}",
        (30, 75),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        rectangle_color,
        2
    )


    # Confirmation counter

    if (
        severity != "NORMAL"
        and confirmation_frames
        < CONFIRMATION_FRAMES
    ):

        cv2.putText(
            display,
            (
                f"Confirming: "
                f"{confirmation_frames}/"
                f"{CONFIRMATION_FRAMES}"
            ),
            (30, 110),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            rectangle_color,
            2
        )


    # ==================================================
    # SHOW
    # ==================================================

    cv2.imshow(
        "Emergency Exit CCTV",
        display
    )


    delay = max(
        1,
        int(1000 / fps)
    )


    if (
        cv2.waitKey(delay) & 0xFF
        == ord("q")
    ):

        break


# ==================================================
# CLEANUP
# ==================================================

cap.release()

cv2.destroyAllWindows()


print()
print(
    "✅ Exit obstruction detection finished"
)