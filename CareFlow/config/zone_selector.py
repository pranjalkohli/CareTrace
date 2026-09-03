import cv2
import numpy as np
from pathlib import Path


# ==================================================
# CONFIGURATION
# ==================================================

VIDEO_PATH = "data/video/restricted_zone_demo.mp4"

OUTPUT_FILE = Path(
    "config/restricted_zone.npy"
)


# ==================================================
# GLOBAL STATE
# ==================================================

points = []


# ==================================================
# MOUSE CALLBACK
# ==================================================

def select_point(event, x, y, flags, param):
    """
    Capture mouse clicks and store the selected
    restricted-zone coordinates.
    """

    if event == cv2.EVENT_LBUTTONDOWN:

        points.append((x, y))

        print(
            f"Point {len(points)}: ({x}, {y})"
        )


# ==================================================
# MAIN
# ==================================================

def main():

    video = cv2.VideoCapture(VIDEO_PATH)

    if not video.isOpened():

        print(
            "ERROR: Could not open video."
        )

        return

    # Read first frame
    success, frame = video.read()

    video.release()

    if not success:

        print(
            "ERROR: Could not read video frame."
        )

        return

    print("\n" + "=" * 50)
    print("CAREFLOW - RESTRICTED ZONE SELECTOR")
    print("=" * 50)

    print("\nClick the corners of the restricted area.")
    print("Use at least 3 points.")
    print("Press ENTER when finished.")
    print("Press R to reset.")
    print("Press Q to quit.\n")

    cv2.namedWindow(
        "CareFlow - Zone Selector"
    )

    cv2.setMouseCallback(
        "CareFlow - Zone Selector",
        select_point
    )

    while True:

        display = frame.copy()

        # ------------------------------------------
        # DRAW SELECTED POINTS
        # ------------------------------------------

        for i, point in enumerate(points):

            cv2.circle(
                display,
                point,
                6,
                (0, 255, 255),
                -1
            )

            cv2.putText(
                display,
                str(i + 1),
                (
                    point[0] + 8,
                    point[1] - 8
                ),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 255),
                2
            )

        # ------------------------------------------
        # DRAW LINES BETWEEN POINTS
        # ------------------------------------------

        if len(points) >= 2:

            cv2.polylines(
                display,
                [
                    np.array(
                        points,
                        dtype=np.int32
                    )
                ],
                False,
                (0, 255, 255),
                2
            )

        # ------------------------------------------
        # CLOSE POLYGON
        # ------------------------------------------

        if len(points) >= 3:

            cv2.polylines(
                display,
                [
                    np.array(
                        points,
                        dtype=np.int32
                    )
                ],
                True,
                (0, 0, 255),
                3
            )

        # ------------------------------------------
        # INSTRUCTIONS
        # ------------------------------------------

        cv2.putText(
            display,
            "Click corners | ENTER: Save | R: Reset | Q: Quit",
            (20, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )

        cv2.imshow(
            "CareFlow - Zone Selector",
            display
        )

        key = cv2.waitKey(1) & 0xFF

        # ------------------------------------------
        # SAVE ZONE
        # ------------------------------------------

        if key == 13:  # ENTER

            if len(points) < 3:

                print(
                    "\nERROR: Select at least "
                    "3 points."
                )

                continue

            zone = np.array(
                points,
                dtype=np.int32
            )

            OUTPUT_FILE.parent.mkdir(
                parents=True,
                exist_ok=True
            )

            np.save(
                OUTPUT_FILE,
                zone
            )

            print(
                "\n✅ Restricted zone saved!"
            )

            print(
                f"File: {OUTPUT_FILE}"
            )

            print(
                f"Coordinates: {points}"
            )

            break

        # ------------------------------------------
        # RESET
        # ------------------------------------------

        elif key == ord("r"):

            points.clear()

            print(
                "\n🔄 Zone selection reset."
            )

        # ------------------------------------------
        # QUIT
        # ------------------------------------------

        elif key == ord("q"):

            print(
                "\nZone selection cancelled."
            )

            break

    cv2.destroyAllWindows()


# ==================================================
# ENTRY POINT
# ==================================================

if __name__ == "__main__":
    main()