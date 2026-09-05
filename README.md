# CareTrace 🏥
### AI-Powered Hospital Safety & Intelligence System

CareTrace is an AI-powered hospital monitoring and intelligence platform designed to improve patient and staff safety, detect critical incidents, and assist healthcare teams in responding to operational and equipment-related issues.

## 🚨 Core Features

### 1. Restricted Zone Entry Detection

- Detects people entering predefined restricted areas using CCTV footage.
- Uses temporal confirmation to reduce false alerts.
- Correlates detected entries with badge-swipe logs.
- Authorized entry is classified as **LOW** severity.
- Entry without a matching authorized badge is classified as **CRITICAL**.
- Captures evidence snapshots and records incidents with timestamps, camera information, and badge details.

### 2. Emergency Exit Obstruction Detection

- Continuously monitors a predefined emergency exit region.
- Creates a clear-pathway reference from the initial unobstructed footage.
- Detects changes or obstructions within the exit region without requiring object classification.
- Calculates the percentage of the exit area affected.
- Classifies the situation as:
  - 🟢 **NORMAL**
  - 🟡 **WARNING**
  - 🔴 **CRITICAL**
- Uses consecutive-frame confirmation to reduce false alerts.
- Saves evidence snapshots and logs confirmed incidents.

### 3. Equipment Failure Diagnosis

- Helps identify and troubleshoot failures in critical hospital equipment.
- Uses equipment-specific guides and a searchable knowledge base.
- Retrieves relevant technical information based on the reported problem.
- Provides possible causes, diagnostic information, and recommended resolution steps.
- Supports equipment such as:
  - Ventilators
  - ECG machines
  - Infusion pumps
  - Dialysis machines
  - Defibrillators
  - Suction machines
  - X-ray machines
  - Patient monitoring equipment

## 🔄 System Workflow

```text
CCTV Footage / Equipment Issue
              ↓
       AI-Based Detection
              ↓
       Temporal Confirmation
              ↓
      Severity Assessment
              ↓
       Incident / Diagnosis
              ↓
     Evidence & Information
              ↓
      Actionable Response
