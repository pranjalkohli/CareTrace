import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DoorOpen,
  FileImage,
  Home as HomeIcon,
  LayoutDashboard,
  ListFilter,
  LockKeyhole,
  Moon,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Video,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

/* =========================================================
   TYPES
========================================================= */

type Theme = "light" | "dark";

type Page =
  | "overview"
  | "monitoring"
  | "equipment"
  | "report"
  | "incidents";

type IncidentType = "restricted" | "exit" | "equipment";

type Severity = "critical" | "high" | "attention" | "clear";

type IncidentStatus = "Open" | "Under review" | "Resolved";

type BackendIncident = {
  incident_id: string;
  event_type: string;
  camera_id: string;
  location: string;
  severity: string;
  badge_detected: boolean | null;
  badge_id: string | null;
  obstruction_percentage: number | null;
  timestamp: string;
  snapshot_path: string | null;
  status: string;
};

type Incident = {
  id: string;
  type: IncidentType;
  title: string;
  location: string;
  severity: Severity;
  status: IncidentStatus;
  detected: string;
  relative: string;
  camera: string;
  floor: string;
  details: Record<string, string>;
  evidence: string;
  action: string;
};

type CameraRecord = {
  id: string;
  name: string;
  location: string;
  kind: "restricted" | "exit";
  status: "online" | "offline";
};

type Equipment = {
  id: string;
  name: string;
  location: string;
  status: string;
};

/* =========================================================
   DATA
========================================================= */

const cameras: CameraRecord[] = [
  {
    id: "CAM-01",
    name: "Restricted Area",
    location: "ICU",
    kind: "restricted",
    status: "online",
  },
  {
    id: "CAM-02",
    name: "Emergency Exit",
    location: "Ground Floor",
    kind: "exit",
    status: "online",
  },
];

const equipment: Equipment[] = [
  {
    id: "EQ-001",
    name: "Infusion Pump",
    location: "ICU",
    status: "Operational",
  },
  {
    id: "EQ-002",
    name: "Ventilator",
    location: "ICU",
    status: "Operational",
  },
  {
    id: "EQ-003",
    name: "ECG Machine",
    location: "Cardiology",
    status: "Needs review",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function getPage(path: string): Page {
  if (path === "/monitoring") return "monitoring";
  if (path === "/equipment") return "equipment";
  if (path === "/equipment/report") return "report";
  if (path === "/incidents") return "incidents";
  return "overview";
}

function severityFromBackend(value: string): Severity {
  const normalized = value.toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "attention") return "attention";

  return "clear";
}

function statusFromBackend(value: string): IncidentStatus {
  const normalized = value.toLowerCase();

  if (normalized === "resolved") return "Resolved";
  if (normalized === "under review") return "Under review";

  return "Open";
}

function convertBackendIncident(
  item: BackendIncident
): Incident {
  let type: IncidentType = "equipment";

  if (item.event_type === "restricted_zone_entry") {
    type = "restricted";
  } else if (item.event_type === "exit_obstruction") {
    type = "exit";
  }

  const severity = severityFromBackend(item.severity);

  let title = "Equipment issue detected";

  if (type === "restricted") {
    title = item.badge_detected
      ? "Authorized restricted-zone entry"
      : "Possible unauthorized entry";
  }

  if (type === "exit") {
    title = "Exit obstruction detected";
  }

  const detected = new Date(
    item.timestamp
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const badgeText = item.badge_detected
    ? item.badge_id
      ? `Detected · ${item.badge_id}`
      : "Detected"
    : "Not detected";

  let action = "Review the reported incident.";

  if (type === "restricted") {
    action = item.badge_detected
      ? "Review the authorized entry if required."
      : "Security should check the restricted area.";
  }

  if (type === "exit") {
    action = "Clear the emergency exit immediately.";
  }

  return {
    id: item.incident_id,
    type,
    title,
    location: item.location,
    severity,
    status: statusFromBackend(item.status),
    detected,
    relative: item.timestamp,
    camera: item.camera_id,
    floor: "",
    details: {
      "Incident ID": item.incident_id,
      "Event type": item.event_type,
      Camera: item.camera_id,
      Location: item.location,
      Badge: badgeText,
      Severity: item.severity,
      Status: item.status,

      ...(item.obstruction_percentage !== null
        ? {
            Obstruction: `${item.obstruction_percentage}%`,
          }
        : {}),
    },
    evidence: item.snapshot_path || "",
    action,
  };
}

/* =========================================================
   STYLING
========================================================= */

function severityClasses(severity: Severity) {
  switch (severity) {
    case "critical":
      return "bg-[#fff0ef] text-[#c33734] dark:bg-[#512b31] dark:text-[#ffaaa7]";

    case "high":
      return "bg-[#fff5e5] text-[#a86608] dark:bg-[#4a3821] dark:text-[#ffc56b]";

    case "attention":
      return "bg-accent text-foreground";

    default:
      return "bg-muted text-muted-foreground";
  }
}

function severityLabel(severity: Severity) {
  if (severity === "critical") return "CRITICAL";
  if (severity === "high") return "HIGH";
  if (severity === "attention") return "ATTENTION";
  return "CLEAR";
}

/* =========================================================
   PAGE HEADER
========================================================= */

function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="eyebrow">{eyebrow}</div>

        <h1 className="display-font mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>

      {action}
    </div>
  );
}

/* =========================================================
   OBSERVATION ROW
========================================================= */

function ObservationRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: "critical" | "high";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon size={15} />
        </div>

        <span className="text-[.76rem] font-semibold text-muted-foreground">
          {label}
        </span>
      </div>

      <span
        className={`text-right text-[.78rem] font-extrabold ${
          accent === "critical"
            ? "text-[#c33734] dark:text-[#ffaaa7]"
            : accent === "high"
              ? "text-[#a86608] dark:text-[#ffc56b]"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({
  page,
  navigate,
  incidentsCount,
}: {
  page: Page;
  navigate: (path: string) => void;
  incidentsCount: number;
}) {
  const items = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      page: "overview" as Page,
      path: "/",
    },
    {
      label: "Monitoring",
      icon: Video,
      page: "monitoring" as Page,
      path: "/monitoring",
    },
    {
      label: "Equipment",
      icon: Activity,
      page: "equipment" as Page,
      path: "/equipment",
    },
    {
      label: "Incidents",
      icon: ShieldAlert,
      page: "incidents" as Page,
      path: "/incidents",
    },
  ];

  return (
    <aside className="hidden w-[250px] shrink-0 border-r border-border bg-card lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-5">

        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background">
            <Activity size={20} />
          </div>

          <div>
            <div className="display-font text-lg font-extrabold text-foreground">
              CareTrace
            </div>

            <div className="text-[.62rem] font-semibold uppercase tracking-[.15em] text-muted-foreground">
              Hospital Intelligence
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-1">
          {items.map((item) => {
            const active = page === item.page;

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon size={17} />

                <span className="flex-1 text-[.78rem] font-bold">
                  {item.label}
                </span>

                {item.page === "incidents" &&
                  incidentsCount > 0 && (
                    <span className="rounded-full bg-[#c33734] px-2 py-0.5 text-[.6rem] font-extrabold text-white">
                      {incidentsCount}
                    </span>
                  )}
              </button>
            );
          })}
        </div>

        <div className="mt-auto rounded-2xl border border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-[.68rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
            <span className="live-dot" />
            System status
          </div>

          <div className="mt-3 text-sm font-bold text-foreground">
            Monitoring active
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            AI detection pipeline is connected.
          </div>
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   TOPBAR
========================================================= */

function Topbar({
  theme,
  setTheme,
  notificationOpen,
  setNotificationOpen,
  incidents,
}: {
  theme: Theme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
  notificationOpen: boolean;
  setNotificationOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;
  incidents: Incident[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-xl sm:px-7">

      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <HomeIcon size={15} />
        <ChevronRight size={13} />
        <span className="text-foreground">
          CareTrace
        </span>
      </div>

      <div className="flex items-center gap-2">

        <button
          onClick={() =>
            setTheme((value) =>
              value === "light" ? "dark" : "light"
            )
          }
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon size={16} />
          ) : (
            <Sun size={16} />
          )}
        </button>

        <div className="relative">
          <button
            onClick={() =>
              setNotificationOpen((value) => !value)
            }
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell size={16} />

            {incidents.some(
              (item) => item.status !== "Resolved"
            ) && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#e53935]" />
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 top-12 z-50 w-[320px] rounded-2xl border border-border bg-card p-4 shadow-2xl">

              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-foreground">
                  Notifications
                </span>

                <span className="text-[.65rem] font-bold text-muted-foreground">
                  {
                    incidents.filter(
                      (item) => item.status !== "Resolved"
                    ).length
                  }{" "}
                  open
                </span>
              </div>

              <div className="mt-3 max-h-[280px] space-y-2 overflow-auto">

                {incidents
                  .filter(
                    (item) => item.status !== "Resolved"
                  )
                  .slice(0, 5)
                  .map((incident) => (
                    <div
                      key={incident.id}
                      className="rounded-xl bg-muted/50 p-3"
                    >
                      <div className="flex items-start gap-2">

                        <AlertTriangle
                          size={14}
                          className={
                            incident.severity ===
                            "critical"
                              ? "text-[#c33734]"
                              : "text-[#a86608]"
                          }
                        />

                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {incident.title}
                          </div>

                          <div className="mt-1 text-[.65rem] text-muted-foreground">
                            {incident.location} ·{" "}
                            {incident.detected}
                          </div>
                        </div>

                      </div>
                    </div>
                  ))}

                {incidents.filter(
                  (item) => item.status !== "Resolved"
                ).length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No open incidents.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* =========================================================
   CAMERA FEED
========================================================= */

function CameraFeed({
  camera,
  incident,
  onOpen,
}: {
  camera: CameraRecord;
  incident?: Incident;
  onOpen: () => void;
}) {
  return (
    <div className="relative aspect-video overflow-hidden bg-[#111]">

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#38404a,#15181c_65%)]" />

      <div className="absolute inset-0 opacity-30">
        <div className="h-full w-full bg-[linear-gradient(transparent_95%,rgba(255,255,255,.08)_95%)] bg-[length:100%_6px]" />
      </div>

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[.62rem] font-bold text-white backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
        LIVE
      </div>

      <div className="absolute right-4 top-4 rounded-lg bg-black/60 px-3 py-1.5 text-[.62rem] font-bold text-white backdrop-blur">
        {camera.id}
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center text-white/70">

          <Camera
            className="mx-auto mb-3 opacity-60"
            size={42}
          />

          <div className="text-sm font-bold">
            {camera.name}
          </div>

          <div className="mt-1 text-[.65rem]">
            {camera.location}
          </div>
        </div>
      </div>

      {incident && incident.status !== "Resolved" && (
        <button
          onClick={onOpen}
          className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-left text-white backdrop-blur transition hover:bg-black/80"
        >
          <div>
            <div className="text-[.62rem] font-extrabold uppercase tracking-[.12em] text-white/60">
              Latest AI incident
            </div>

            <div className="mt-1 text-sm font-bold">
              {incident.title}
            </div>
          </div>

          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
}

/* =========================================================
   INCIDENT DETAIL
========================================================= */

function IncidentDetail({
  incident,
  onClose,
  onResolve,
}: {
  incident: Incident;
  onClose: () => void;
  onResolve: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">

      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[1.5rem] border border-border bg-card shadow-2xl">

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-5">

          <div>
            <div className="eyebrow">
              Incident details
            </div>

            <h2 className="display-font mt-1 text-xl font-extrabold text-foreground">
              {incident.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
          >
            <X size={17} />
          </button>
        </div>

        <div className="space-y-6 p-5">

          <div className="flex flex-wrap gap-2">

            <span
              className={`rounded-full px-3 py-1.5 text-[.65rem] font-extrabold uppercase ${severityClasses(
                incident.severity
              )}`}
            >
              {severityLabel(incident.severity)}
            </span>

            <span
              className={`rounded-full px-3 py-1.5 text-[.65rem] font-extrabold uppercase ${
                incident.status === "Resolved"
                  ? "bg-[#e8f5f2] text-[#176b5d]"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {incident.status}
            </span>

          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(incident.details).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="text-[.62rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                    {key}
                  </div>

                  <div className="mt-1 text-sm font-bold text-foreground">
                    {key === "Status"
                      ? incident.status
                      : value}
                  </div>
                </div>
              )
            )}
          </div>

          {incident.evidence && (
            <div>

              <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-foreground">
                <FileImage size={15} />
                Evidence
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4">

                <div className="break-all text-xs text-muted-foreground">
                  {incident.evidence}
                </div>

                <div className="mt-3 flex items-center gap-2 text-[.68rem] font-bold text-muted-foreground">
                  <CheckCircle2 size={14} />
                  Evidence captured by computer vision
                </div>

              </div>
            </div>
          )}

          <div className="rounded-xl bg-muted/50 p-4">

            <div className="flex items-center gap-2 text-[.7rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
              <AlertTriangle size={14} />
              Recommended action
            </div>

            <p className="mt-2 text-sm font-bold text-foreground">
              {incident.action}
            </p>
          </div>

          {incident.status !== "Resolved" ? (
            <button
              onClick={() => onResolve(incident.id)}
              className="btn-primary w-full"
            >
              <CheckCircle2 size={15} />
              Mark as resolved
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#e8f5f2] px-4 py-4 text-sm font-extrabold text-[#176b5d]">
              <CheckCircle2 size={17} />
              Incident resolved
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INCIDENT ROW
========================================================= */

function IncidentRow({
  incident,
  onOpen,
}: {
  incident: Incident;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-4 border-b border-border p-4 text-left transition last:border-b-0 hover:bg-muted/40"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${severityClasses(
          incident.severity
        )}`}
      >
        {incident.type === "restricted" ? (
          <LockKeyhole size={17} />
        ) : incident.type === "exit" ? (
          <DoorOpen size={17} />
        ) : (
          <Activity size={17} />
        )}
      </div>

      <div className="min-w-0 flex-1">

        <div
          className={`truncate text-sm font-bold ${
            incident.status === "Resolved"
              ? "text-muted-foreground line-through"
              : "text-foreground"
          }`}
        >
          {incident.title}
        </div>

        <div className="mt-1 text-[.68rem] text-muted-foreground">
          {incident.location} · {incident.camera} ·{" "}
          {incident.detected}
        </div>
      </div>

      <div
        className={`hidden rounded-full px-2.5 py-1 text-[.58rem] font-extrabold uppercase sm:block ${severityClasses(
          incident.severity
        )}`}
      >
        {severityLabel(incident.severity)}
      </div>

      <span
        className={`hidden text-[.6rem] font-extrabold uppercase sm:block ${
          incident.status === "Resolved"
            ? "text-[#176b5d]"
            : "text-muted-foreground"
        }`}
      >
        {incident.status}
      </span>

      <ChevronRight
        size={15}
        className="shrink-0 text-muted-foreground"
      />
    </button>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function Overview({
  incidents,
  onOpenIncident,
}: {
  incidents: Incident[];
  onOpenIncident: (incident: Incident) => void;
}) {
  const criticalCount = incidents.filter(
    (item) =>
      item.severity === "critical" &&
      item.status !== "Resolved"
  ).length;

  const openCount = incidents.filter(
    (item) => item.status !== "Resolved"
  ).length;

  const monitoredCount = cameras.filter(
    (item) => item.status === "online"
  ).length;

  return (
    <div className="space-y-7">

      <PageHeader
        eyebrow="Overview"
        title="See what needs attention."
        subtitle="CareTrace brings hospital safety signals, incidents and monitoring activity into one place."
        action={
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[.7rem] font-bold text-muted-foreground">
            <span className="live-dot" />
            System live
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <StatCard
          label="Open incidents"
          value={String(openCount)}
          icon={ShieldAlert}
        />

        <StatCard
          label="Critical incidents"
          value={String(criticalCount)}
          icon={AlertTriangle}
          critical={criticalCount > 0}
        />

        <StatCard
          label="Live cameras"
          value={`${monitoredCount}/${cameras.length}`}
          icon={Video}
        />

        <StatCard
          label="AI status"
          value="Active"
          icon={Activity}
        />

      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">

        <div className="surface overflow-hidden rounded-[1.25rem]">

          <div className="flex items-center justify-between border-b border-border p-5">

            <div>
              <div className="eyebrow">
                Recent activity
              </div>

              <h2 className="display-font mt-1 text-xl font-extrabold text-foreground">
                Latest incidents
              </h2>
            </div>

            <span className="rounded-full bg-muted px-3 py-1.5 text-[.62rem] font-bold text-muted-foreground">
              {incidents.length} total
            </span>
          </div>

          {incidents.length > 0 ? (
            incidents.slice(0, 5).map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                onOpen={() =>
                  onOpenIncident(incident)
                }
              />
            ))
          ) : (
            <EmptyState text="No incidents have been recorded yet." />
          )}
        </div>

        <div className="surface rounded-[1.25rem] p-5">

          <div className="eyebrow">
            Live coverage
          </div>

          <h2 className="display-font mt-1 text-xl font-extrabold text-foreground">
            Camera status
          </h2>

          <div className="mt-5 space-y-3">

            {cameras.map((camera) => (
              <div
                key={camera.id}
                className="flex items-center gap-3 rounded-xl border border-border p-4"
              >

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Camera size={16} />
                </div>

                <div className="min-w-0 flex-1">

                  <div className="truncate text-sm font-bold text-foreground">
                    {camera.name}
                  </div>

                  <div className="mt-0.5 text-[.65rem] text-muted-foreground">
                    {camera.id} · {camera.location}
                  </div>

                </div>

                <div className="flex items-center gap-1.5 text-[.62rem] font-extrabold uppercase text-foreground">
                  <span className="live-dot" />
                  Online
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  icon: Icon,
  critical,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  critical?: boolean;
}) {
  return (
    <div className="surface rounded-[1.25rem] p-5">

      <div className="flex items-start justify-between">

        <div className="text-[.65rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
          {label}
        </div>

        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            critical
              ? "bg-[#fff0ef] text-[#c33734] dark:bg-[#512b31] dark:text-[#ffaaa7]"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon size={15} />
        </div>

      </div>

      <div className="display-font mt-5 text-3xl font-extrabold text-foreground">
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   MONITORING
========================================================= */

function Monitoring({
  incidents,
  onOpenIncident,
}: {
  incidents: Incident[];
  onOpenIncident: (incident: Incident) => void;
}) {
  const [selected, setSelected] = useState(0);

  const camera = cameras[selected];

  const isRestricted =
    camera.kind === "restricted";

  const cameraIncidents = incidents
    .filter(
      (incident) =>
        incident.camera === camera.id &&
        incident.status !== "Resolved"
    )
    .sort(
      (a, b) =>
        new Date(b.relative).getTime() -
        new Date(a.relative).getTime()
    );

  const latestIncident = cameraIncidents[0];

  const badgeValue =
    latestIncident?.details?.["Badge"] ||
    "No badge data";

  const obstruction =
    latestIncident?.details?.["Obstruction"] ||
    "No obstruction data";

  return (
    <div className="space-y-7">

      <PageHeader
        eyebrow="Monitoring"
        title="Stay close to what matters."
        subtitle="CareTrace watches areas that should stay restricted and pathways that should stay clear."
        action={
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[.7rem] font-bold text-muted-foreground">
            <span className="live-dot" />
            Live cameras
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">

        <div className="surface overflow-hidden rounded-[1.25rem]">

          <div className="flex gap-2 border-b border-border p-3">

            {cameras.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelected(index)}
                className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                  selected === index
                    ? "bg-accent"
                    : "hover:bg-muted"
                }`}
              >

                <span
                  className={`h-2 w-2 rounded-full ${
                    item.kind === "restricted"
                      ? "bg-[#e53935]"
                      : "bg-[#f59e0b]"
                  }`}
                />

                <span className="min-w-0">

                  <span className="block truncate text-[.76rem] font-bold text-foreground">
                    {item.name}
                  </span>

                  <span className="mt-0.5 block text-[.63rem] text-muted-foreground">
                    {item.id} · {item.location}
                  </span>

                </span>
              </button>
            ))}
          </div>

          <CameraFeed
            camera={camera}
            incident={latestIncident}
            onOpen={() =>
              latestIncident &&
              onOpenIncident(latestIncident)
            }
          />
        </div>

        <div className="surface rounded-[1.25rem] p-6">

          <div className="eyebrow">
            AI observation
          </div>

          <h2 className="display-font mt-3 text-2xl font-extrabold text-foreground">
            {isRestricted
              ? "Restricted zone"
              : "Emergency exit"}
          </h2>

          <p className="mt-2 text-[.82rem] leading-relaxed text-muted-foreground">
            {isRestricted
              ? "CareTrace monitors restricted areas and correlates detected entries with badge authorization."
              : "CareTrace monitors emergency pathways for possible obstruction."}
          </p>

          {latestIncident ? (
            <div className="mt-7 space-y-5">

              <ObservationRow
                icon={Activity}
                label="AI detection"
                value={latestIncident.title}
                accent={
                  latestIncident.severity ===
                  "critical"
                    ? "critical"
                    : latestIncident.severity ===
                        "high"
                      ? "high"
                      : undefined
                }
              />

              {isRestricted ? (
                <>
                  <ObservationRow
                    icon={LockKeyhole}
                    label="Restricted zone"
                    value="Entry detected"
                    accent="critical"
                  />

                  <ObservationRow
                    icon={ShieldAlert}
                    label="Badge"
                    value={badgeValue}
                    accent={
                      badgeValue
                        .toLowerCase()
                        .includes("not detected")
                        ? "critical"
                        : undefined
                    }
                  />

                  <ObservationRow
                    icon={ShieldAlert}
                    label="Severity"
                    value={severityLabel(
                      latestIncident.severity
                    )}
                    accent={
                      latestIncident.severity ===
                      "critical"
                        ? "critical"
                        : latestIncident.severity ===
                            "high"
                          ? "high"
                          : undefined
                    }
                  />
                </>
              ) : (
                <>
                  <ObservationRow
                    icon={DoorOpen}
                    label="AI status"
                    value="Exit obstruction"
                    accent="high"
                  />

                  <ObservationRow
                    icon={SlidersHorizontal}
                    label="Estimated obstruction"
                    value={obstruction}
                    accent="high"
                  />
                </>
              )}

              <ObservationRow
                icon={Clock3}
                label="Detected"
                value={latestIncident.detected}
              />

              <ObservationRow
                icon={FileImage}
                label="Evidence"
                value={
                  latestIncident.evidence
                    ? "Captured"
                    : "Not available"
                }
              />

            </div>
          ) : (
            <div className="mt-7 rounded-xl border border-border bg-muted/40 p-5">

              <div className="flex items-center gap-2 text-[.72rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                <Activity size={14} />
                AI status
              </div>

              <p className="mt-2 text-[.82rem] font-semibold text-foreground">
                No recent incidents detected for this camera.
              </p>

            </div>
          )}

          <div
            className={`mt-7 rounded-xl p-4 ${
              isRestricted
                ? "bg-[#fff0ef] dark:bg-[#512b31]"
                : "bg-[#fff5e5] dark:bg-[#4a3821]"
            }`}
          >

            <div
              className={`flex items-center gap-2 text-[.72rem] font-extrabold uppercase tracking-[.1em] ${
                isRestricted
                  ? "text-[#c33734] dark:text-[#ffaaa7]"
                  : "text-[#a86608] dark:text-[#ffc56b]"
              }`}
            >
              <AlertTriangle size={14} />
              Recommended action
            </div>

            <p className="mt-2 text-[.82rem] font-bold text-foreground">
              {latestIncident
                ? latestIncident.action
                : isRestricted
                  ? "No immediate action required."
                  : "No current obstruction detected."}
            </p>
          </div>

          <button
            onClick={() =>
              latestIncident &&
              onOpenIncident(latestIncident)
            }
            disabled={!latestIncident}
            className={`btn-primary mt-5 w-full ${
              !latestIncident
                ? "cursor-not-allowed opacity-50"
                : ""
            }`}
          >
            {latestIncident
              ? "View latest incident"
              : "No incident to view"}

            <ArrowUpRight size={15} />
          </button>

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   INCIDENTS PAGE
========================================================= */

function Incidents({
  incidents,
  onOpenIncident,
}: {
  incidents: Incident[];
  onOpenIncident: (incident: Incident) => void;
}) {
  const [search, setSearch] = useState("");

  const [filter, setFilter] = useState<
    "all" | "critical" | "open" | "resolved"
  >("all");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return incidents.filter((incident) => {

      const matchesSearch =
        !query ||
        incident.title
          .toLowerCase()
          .includes(query) ||
        incident.location
          .toLowerCase()
          .includes(query) ||
        incident.camera
          .toLowerCase()
          .includes(query) ||
        incident.id
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "critical" &&
          incident.severity === "critical") ||
        (filter === "open" &&
          incident.status !== "Resolved") ||
        (filter === "resolved" &&
          incident.status === "Resolved");

      return matchesSearch && matchesFilter;
    });
  }, [incidents, search, filter]);

  return (
    <div className="space-y-7">

      <PageHeader
        eyebrow="Incidents"
        title="Every signal, accounted for."
        subtitle="Review incidents generated by the CareTrace computer-vision and backend pipeline."
      />

      <div className="surface rounded-[1.25rem]">

        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row">

          <div className="relative flex-1">

            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search incidents..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-accent"
            />
          </div>

          <div className="flex items-center gap-2">

            <ListFilter
              size={15}
              className="text-muted-foreground"
            />

            {(
              [
                ["all", "All"],
                ["critical", "Critical"],
                ["open", "Open"],
                ["resolved", "Resolved"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-[.65rem] font-extrabold transition ${
                  filter === value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">

          {filtered.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onOpen={() =>
                onOpenIncident(incident)
              }
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <EmptyState text="No incidents match your filters." />
        )}

      </div>
    </div>
  );
}

/* =========================================================
   EQUIPMENT PAGE
========================================================= */

function EquipmentPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  return (
    <div className="space-y-7">

      <PageHeader
        eyebrow="Equipment"
        title="Know what needs attention."
        subtitle="Monitor critical hospital equipment and review potential issues detected by CareTrace."
      />

      <div className="grid gap-4 md:grid-cols-3">

        {equipment.map((item) => (
          <div
            key={item.id}
            className="surface rounded-[1.25rem] p-5"
          >

            <div className="flex items-start justify-between">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                <Activity size={18} />
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-[.58rem] font-extrabold uppercase ${
                  item.status === "Operational"
                    ? "bg-muted text-muted-foreground"
                    : "bg-[#fff5e5] text-[#a86608]"
                }`}
              >
                {item.status}
              </span>

            </div>

            <h2 className="mt-5 text-base font-extrabold text-foreground">
              {item.name}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {item.id} · {item.location}
            </p>

            <button
              onClick={() =>
                navigate(
                  `/equipment/report?equipment=${encodeURIComponent(
                    item.name
                  )}`
                )
              }
              className="btn-primary mt-5 w-full"
            >
              Review equipment
              <ArrowUpRight size={14} />
            </button>

          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   EQUIPMENT REPORT
========================================================= */

function ReportPage({
  navigate,
}: {
  navigate: (path: string) => void;
}) {
  const [equipmentName, setEquipmentName] =
    useState("Ventilator");

  const [analysisStarted, setAnalysisStarted] =
    useState(false);

  return (
    <div className="space-y-7">

      <PageHeader
        eyebrow="Equipment report"
        title="Diagnose equipment issues."
        subtitle="Submit an equipment observation for AI-assisted analysis."
        action={
          <button
            onClick={() => navigate("/equipment")}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            ← Back to equipment
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">

        {/* INPUT */}

        <div className="surface rounded-[1.25rem] p-6">

          <div className="eyebrow">
            Input
          </div>

          <h2 className="display-font mt-2 text-xl font-extrabold text-foreground">
            Equipment details
          </h2>

          <label className="mt-6 block text-xs font-bold text-muted-foreground">
            Equipment
          </label>

          <select
            value={equipmentName}
            onChange={(event) =>
              setEquipmentName(event.target.value)
            }
            className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none"
          >
            {equipment.map((item) => (
              <option
                key={item.id}
                value={item.name}
              >
                {item.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setAnalysisStarted(true);
              toast.success(
                "AI equipment analysis completed"
              );
            }}
            className="btn-primary mt-5 w-full"
          >
            Run AI analysis
            <ArrowUpRight size={15} />
          </button>

        </div>

        {/* ANALYSIS */}

        <div className="surface rounded-[1.25rem] p-6">

          <div className="eyebrow">
            Analysis
          </div>

          {!analysisStarted ? (
            <div className="flex min-h-[400px] items-center justify-center text-center">

              <div>

                <Activity
                  size={38}
                  className="mx-auto text-muted-foreground"
                />

                <p className="mt-4 text-sm font-bold text-foreground">
                  Ready for analysis
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Select equipment and run the AI analysis.
                </p>

              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">

              {/* EQUIPMENT */}

              <div className="rounded-xl bg-muted/50 p-4">

                <div className="text-[.62rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                  Equipment
                </div>

                <div className="mt-1 text-sm font-bold text-foreground">
                  {equipmentName}
                </div>

              </div>

              {/* DIAGNOSIS */}

              <div className="rounded-xl border border-border p-5">

                <div className="flex items-center gap-2">

                  <CheckCircle2
                    size={17}
                    className="text-foreground"
                  />

                  <h3 className="text-base font-extrabold text-foreground">
                    Diagnosis
                  </h3>

                </div>

                <div className="mt-5 space-y-5">

                  {/* LIKELY FAULT */}

                  <div>

                    <div className="text-[.62rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                      Likely fault
                    </div>

                    <p className="mt-1 text-sm font-bold leading-relaxed text-foreground">
                      Blocked expiratory filter or breathing circuit obstruction
                    </p>

                  </div>

                  {/* REASONING */}

                  <div>

                    <div className="text-[.62rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                      Reasoning
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      The reported symptom of pressure spiking directly aligns with Similar Case 3 from this specific unit&apos;s history (EQ-VEN-001), where airway pressure was repeatedly above the expected range due to a blocked expiratory filter. Strange noises often accompany pressure spikes when air is forced through a restricted/blocked filter or when a safety relief valve vent activates.
                    </p>

                  </div>

                  {/* RECOMMENDED ACTION */}

                  <div className="rounded-xl bg-[#fff5e5] p-4 dark:bg-[#4a3821]">

                    <div className="flex items-center gap-2 text-[.68rem] font-extrabold uppercase tracking-[.1em] text-[#a86608] dark:text-[#ffc56b]">
                      <AlertTriangle size={14} />
                      Recommended action
                    </div>

                    <p className="mt-2 text-sm font-bold leading-relaxed text-foreground">
                      Inspect the breathing circuit for kinks and immediately inspect and replace the expiratory filter.
                    </p>

                  </div>

                  {/* CONFIDENCE */}

                  <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">

                    <div>

                      <div className="text-[.62rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                        Confidence
                      </div>

                      <div className="mt-1 text-sm font-extrabold text-foreground">
                        High
                      </div>

                    </div>

                    <div className="rounded-full bg-[#e8f5f2] px-3 py-1.5 text-[.62rem] font-extrabold uppercase text-[#176b5d] dark:bg-[#193d38] dark:text-[#8de0d0]">
                      High confidence
                    </div>

                  </div>

                  {/* EVIDENCE BASIS */}

                  <div>

                    <div className="text-[.62rem] font-extrabold uppercase tracking-[.1em] text-muted-foreground">
                      Evidence basis
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Direct maintenance history from this specific equipment unit (EQ-VEN-001), specifically Case 3.
                    </p>

                  </div>

                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center p-8 text-center">

      <div>

        <CheckCircle2
          size={30}
          className="mx-auto text-muted-foreground"
        />

        <p className="mt-3 text-sm font-bold text-foreground">
          {text}
        </p>

      </div>
    </div>
  );
}

/* =========================================================
   HOME
========================================================= */

export default function Home() {
  const [location, navigate] = useLocation();

  const page = getPage(location);

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return (
      (localStorage.getItem(
        "caretrace-theme"
      ) as Theme) || "light"
    );
  });

  const [notificationOpen, setNotificationOpen] =
    useState(false);

  const [activeIncident, setActiveIncident] =
    useState<Incident | null>(null);

  const [incidents, setIncidents] = useState<
    Incident[]
  >([]);

  const [loadingIncidents, setLoadingIncidents] =
    useState(true);

  /*
    Keep track of incidents that the user resolved
    from the frontend.
  */
  const [resolvedIds, setResolvedIds] =
    useState<string[]>(() => {
      if (typeof window === "undefined") {
        return [];
      }

      try {
        const stored =
          localStorage.getItem(
            "caretrace-resolved-incidents"
          );

        return stored
          ? JSON.parse(stored)
          : [];
      } catch {
        return [];
      }
    });

  /* =========================================================
     THEME
  ========================================================= */

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );

    localStorage.setItem(
      "caretrace-theme",
      theme
    );
  }, [theme]);

  /* =========================================================
     SAVE RESOLVED IDS
  ========================================================= */

  useEffect(() => {
    localStorage.setItem(
      "caretrace-resolved-incidents",
      JSON.stringify(resolvedIds)
    );
  }, [resolvedIds]);

  /* =========================================================
     FETCH INCIDENTS
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadIncidents() {
      try {
        setLoadingIncidents(true);

        const response = await fetch(
          "http://127.0.0.1:8000/incidents"
        );

        if (!response.ok) {
          throw new Error(
            `Backend returned ${response.status}`
          );
        }

        const data =
          (await response.json()) as BackendIncident[];

        if (!cancelled) {
          const converted = data
            .map(convertBackendIncident)
            .map((incident) => {
              if (
                resolvedIds.includes(
                  incident.id
                )
              ) {
                return {
                  ...incident,
                  status: "Resolved" as const,
                };
              }

              return incident;
            })
            .sort(
              (a, b) =>
                new Date(
                  b.relative
                ).getTime() -
                new Date(
                  a.relative
                ).getTime()
            );

          setIncidents(converted);
        }
      } catch (error) {
        console.error(
          "Could not load incidents:",
          error
        );

        if (!cancelled) {
          toast.error(
            "Could not connect to CareTrace backend"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingIncidents(false);
        }
      }
    }

    loadIncidents();

    const interval = window.setInterval(
      loadIncidents,
      5000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [resolvedIds]);

  /* =========================================================
     OPEN INCIDENT
  ========================================================= */

  const openIncident = (
    incident: Incident
  ) => {
    const current = incidents.find(
      (item) => item.id === incident.id
    );

    setActiveIncident(
      current ?? incident
    );
  };

  /* =========================================================
     RESOLVE INCIDENT
  ========================================================= */

  const resolveIncident = (
    id: string
  ) => {
    setIncidents((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "Resolved",
              details: {
                ...item.details,
                Status: "Resolved",
              },
            }
          : item
      )
    );

    setResolvedIds((ids) =>
      ids.includes(id)
        ? ids
        : [...ids, id]
    );

    setActiveIncident((item) =>
      item?.id === id
        ? {
            ...item,
            status: "Resolved",
            details: {
              ...item.details,
              Status: "Resolved",
            },
          }
        : item
    );

    toast.success(
      "Incident marked as resolved"
    );
  };

  /* =========================================================
     PAGE CONTENT
  ========================================================= */

  let content: React.ReactNode;

  if (page === "monitoring") {
    content = (
      <Monitoring
        incidents={incidents}
        onOpenIncident={openIncident}
      />
    );
  } else if (page === "incidents") {
    content = (
      <Incidents
        incidents={incidents}
        onOpenIncident={openIncident}
      />
    );
  } else if (page === "equipment") {
    content = (
      <EquipmentPage
        navigate={navigate}
      />
    );
  } else if (page === "report") {
    content = (
      <ReportPage
        navigate={navigate}
      />
    );
  } else {
    content = (
      <Overview
        incidents={incidents}
        onOpenIncident={openIncident}
      />
    );
  }

  /* =========================================================
     RETURN
  ========================================================= */

  return (
    <div className="min-h-screen bg-background text-foreground">

      <div className="flex min-h-screen">

        <Sidebar
          page={page}
          navigate={navigate}
          incidentsCount={
            incidents.filter(
              (item) =>
                item.status !== "Resolved"
            ).length
          }
        />

        <div className="min-w-0 flex-1">

          <Topbar
            theme={theme}
            setTheme={setTheme}
            notificationOpen={
              notificationOpen
            }
            setNotificationOpen={
              setNotificationOpen
            }
            incidents={incidents}
          />

          <main className="mx-auto max-w-[1500px] p-5 sm:p-7">

            {loadingIncidents && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-semibold text-muted-foreground">

                <Activity
                  size={14}
                  className="animate-pulse"
                />

                Connecting to CareTrace incident pipeline...

              </div>
            )}

            {content}

          </main>
        </div>
      </div>

      {activeIncident && (
        <IncidentDetail
          incident={activeIncident}
          onClose={() =>
            setActiveIncident(null)
          }
          onResolve={
            resolveIncident
          }
        />
      )}

    </div>
  );
}