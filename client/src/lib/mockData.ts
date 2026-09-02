// CareTrace clinical editorial system: structured mock data only; presentation components consume these records.

export type Severity = "critical" | "high" | "attention" | "clear";
export type IncidentType = "restricted" | "exit" | "equipment";

export type Camera = {
  id: string;
  name: string;
  location: string;
  kind: "restricted" | "exit";
  status: "alert" | "blocked" | "clear";
  statusLabel: string;
  description: string;
  image: string;
  overlay: "restricted" | "exit";
  metadata: string[];
};

export type Incident = {
  id: string;
  type: IncidentType;
  title: string;
  location: string;
  floor: string;
  detected: string;
  relative: string;
  severity: Severity;
  status: "Open" | "Under review" | "Resolved";
  evidence: string;
  camera?: string;
  action: string;
  details: Record<string, string>;
};

export type Equipment = {
  id: string;
  name: string;
  location: string;
  department: string;
  status: "attention" | "normal";
  issue: string;
  image: string;
  incidents: { date: string; issue: string; resolution?: string }[];
  insight: string;
  recommendation: string;
};

export const generatedAssets = {
  corridor: "/careTrace-storage/caretrace-corridor-reference_bb95e733.jpg",
  exit: "/careTrace-storage/caretrace-exit-fallback_db77e43d.jpg",
  equipment: "/careTrace-storage/caretrace-equipment-fallback_c3a69eae.jpg",
  evidence: "/careTrace-storage/caretrace-evidence-detail_8178c253.jpg",
  mark: "/careTrace-storage/caretrace-mark_87557427.png",
};

export const cameras: Camera[] = [
  {
    id: "CAM-01",
    name: "Restricted Zone",
    location: "ICU Service Corridor",
    kind: "restricted",
    status: "alert",
    statusLabel: "Restricted area entered",
    description: "Person detected inside restricted area.",
    image: generatedAssets.corridor,
    overlay: "restricted",
    metadata: ["13:42:18", "Badge not detected", "Unauthorized"],
  },
  {
    id: "CAM-02",
    name: "Emergency Exit",
    location: "East Wing · Floor 2",
    kind: "exit",
    status: "blocked",
    statusLabel: "Exit blocked",
    description: "Emergency pathway appears obstructed.",
    image: generatedAssets.exit,
    overlay: "exit",
    metadata: ["67% obstruction", "13:46:02", "Evidence captured"],
  },
];

export const incidents: Incident[] = [
  {
    id: "INC-1042",
    type: "restricted",
    title: "Restricted area entered",
    location: "ICU Service Corridor",
    floor: "Floor 3",
    detected: "13:42:18",
    relative: "2 min ago",
    severity: "critical",
    status: "Open",
    evidence: generatedAssets.evidence,
    camera: "CAM-01",
    action: "Security should check the restricted area.",
    details: { "What happened": "A person was detected inside a restricted area.", Badge: "Not detected", Authorization: "Unauthorized" },
  },
  {
    id: "INC-1041",
    type: "exit",
    title: "Exit blocked",
    location: "East Wing",
    floor: "Floor 2",
    detected: "13:46:02",
    relative: "8 min ago",
    severity: "high",
    status: "Open",
    evidence: generatedAssets.exit,
    camera: "CAM-02",
    action: "Clear the exit immediately.",
    details: { "What happened": "The emergency pathway appears obstructed.", Obstruction: "67%", Evidence: "Captured" },
  },
  {
    id: "INC-1040",
    type: "equipment",
    title: "Equipment issue detected",
    location: "MRI Room 204",
    floor: "Floor 2 · Radiology",
    detected: "13:52:11",
    relative: "21 min ago",
    severity: "attention",
    status: "Under review",
    evidence: generatedAssets.equipment,
    action: "Consider inspecting the cooling system.",
    details: { "What happened": "Temperature abnormality detected.", Equipment: "MRI Scanner", Pattern: "4 similar incidents" },
  },
  {
    id: "INC-1039",
    type: "equipment",
    title: "Temperature rising again",
    location: "MRI Room 204",
    floor: "Floor 2 · Radiology",
    detected: "Yesterday · 16:20",
    relative: "Yesterday",
    severity: "attention",
    status: "Resolved",
    evidence: generatedAssets.equipment,
    action: "Cooling system inspected.",
    details: { "What happened": "Temperature rose above the usual operating range.", Resolution: "Cooling system inspected", Pattern: "Recurring" },
  },
];

export const equipment: Equipment[] = [
  {
    id: "MRI-204",
    name: "MRI Scanner",
    location: "Room 204 · Floor 2",
    department: "Radiology",
    status: "attention",
    issue: "Temperature rising",
    image: generatedAssets.equipment,
    incidents: [
      { date: "12 Aug", issue: "Overheating detected", resolution: "Cooling system inspected" },
      { date: "19 Aug", issue: "Temperature abnormality", resolution: "Filter replaced" },
      { date: "29 Aug", issue: "Temperature rising again" },
    ],
    insight: "Similar problems have happened before.",
    recommendation: "Consider a deeper inspection of the cooling system.",
  },
  {
    id: "VENT-112",
    name: "Ventilator",
    location: "ICU Bay 12 · Floor 3",
    department: "ICU",
    status: "normal",
    issue: "No issue reported",
    image: generatedAssets.equipment,
    incidents: [],
    insight: "No recurring issues in the recent history.",
    recommendation: "Continue regular visual checks.",
  },
  {
    id: "XRAY-08",
    name: "X-Ray Machine",
    location: "Imaging 08 · Floor 2",
    department: "Radiology",
    status: "normal",
    issue: "No issue reported",
    image: generatedAssets.equipment,
    incidents: [],
    insight: "No recurring issues in the recent history.",
    recommendation: "Continue regular visual checks.",
  },
];

export const notifications = incidents.slice(0, 3);
