import cv2
import numpy as np
from pathlib import Path

VIDEO_PATH = "data/video/exit_obstruction_demo.mp4"
ZONE_PATH = Path("config/exit_zone.npy")

cap = cv2.VideoCapture(VIDEO_PATH)

if not cap.isOpened():
    print("❌ Could not open video")
    exit()

ret, frame = cap.read()

if not ret:
    print("❌ Could not read video")
    cap.release()
    exit()

print("👉 Select the Emergency Exit area")
print("👉 Drag the rectangle around the exit")
print("👉 Press ENTER when done")

roi = cv2.selectROI(
    "Select Emergency Exit",
    frame,
    fromCenter=False,
    showCrosshair=True
)

cv2.destroyAllWindows()
cap.release()

x, y, w, h = roi

if w == 0 or h == 0:
    print("❌ No exit area selected")
    exit()

# Save ROI coordinates
ZONE_PATH.parent.mkdir(parents=True, exist_ok=True)
np.save(ZONE_PATH, np.array([x, y, w, h]))

print("✅ Emergency Exit saved")
print(f"x={x}, y={y}, width={w}, height={h}")
print(f"📁 Saved to: {ZONE_PATH}")