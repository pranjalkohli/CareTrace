// CareTrace clinical editorial system: observation-first shell, plain-language states, and only three safety pillars.
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Clock3,
  CloudUpload,
  DoorOpen,
  Eye,
  FileImage,
  Filter,
  History,
  Home as HomeIcon,
  Info,
  LockKeyhole,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeft,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Thermometer,
  UploadCloud,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { cameras, equipment, incidents as seedIncidents, notifications, type Camera as CameraRecord, type Equipment, type Incident, type IncidentType, type Severity, generatedAssets } from "@/lib/mockData";

type Theme = "light" | "dark";
type Page = "overview" | "monitoring" | "equipment" | "report" | "incidents";

const navItems: { label: string; path: Page; icon: typeof HomeIcon }[] = [
  { label: "Overview", path: "overview", icon: HomeIcon },
  { label: "Monitoring", path: "monitoring", icon: Radio },
  { label: "Equipment", path: "equipment", icon: Wrench },
  { label: "Incidents", path: "incidents", icon: History },
];

const severityCopy: Record<Severity, string> = { critical: "Critical", high: "High", attention: "Attention", clear: "Clear" };
const typeCopy: Record<IncidentType, string> = { restricted: "Restricted Zone", exit: "Exit Obstruction", equipment: "Equipment" };
const severityClass: Record<Severity, string> = { critical: "critical", high: "high", attention: "attention", clear: "clear" };

function getPage(path: string): Page {
  if (path.startsWith("/monitoring")) return "monitoring";
  if (path.startsWith("/equipment/report")) return "report";
  if (path.startsWith("/equipment")) return "equipment";
  if (path.startsWith("/incidents")) return "incidents";
  return "overview";
}

function formatNow() {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date(2026, 7, 30));
}

function StatusPill({ severity, children }: { severity: Severity; children?: React.ReactNode }) {
  const dotClass = severity === "critical" ? "alert-dot" : severity === "high" || severity === "attention" ? "warning-dot" : "live-dot";
  return <span className={`status-pill ${severityClass[severity]}`}><span className={`live-dot ${dotClass}`} />{children ?? severityCopy[severity]}</span>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 ${
        compact ? "justify-center" : ""
      }`}
    >
      {/* Logo icon */}
      <div className="flex h-16 w-16 shrink-0 items-center justify-center bg-transparent">
        <img
          src="/careTraceLogo.png"
          alt="CareTrace"
          className="h-16 w-16 object-contain"
          onError={(e) => {
            console.error("Logo failed to load:", e.currentTarget.src);
          }}
        />
      </div>

      {/* Text */}
      <div className="brand-copy min-w-0">
        <div className="display-font text-[1.05rem] font-extrabold tracking-[-.05em] text-foreground">
          careTrace
        </div>

        <div className="mt-0.5 text-[.64rem] font-semibold uppercase tracking-[.16em] text-muted-foreground">
          Hospital safety
        </div>
      </div>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`} onClick={onToggle} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-[#49B8C4] hover:text-foreground">
      {theme === "light" ? <Moon size={16} strokeWidth={1.8} /> : <Sun size={16} strokeWidth={1.8} />}
    </button>
  );
}

function Sidebar({ page, navigate, theme, onToggle }: { page: Page; navigate: (path: string) => void; theme: Theme; onToggle: () => void }) {
  return (
    <aside className="sidebar-rail fixed inset-y-0 left-0 z-30 flex w-[242px] flex-col border-r border-border bg-card px-5 py-6 transition-colors duration-200">
      <Logo />
      <div className="mt-12 rail-caption eyebrow pl-3">Safety console</div>
      <nav className="mt-3 space-y-1.5" aria-label="Primary navigation">
        {navItems.map(({ label, path, icon: Icon }) => (
          <button key={path} onClick={() => navigate(`/${path === "overview" ? "" : path}`)} className={`nav-link w-full text-left ${page === path ? "active" : ""}`} aria-current={page === path ? "page" : undefined}>
            <Icon size={17} strokeWidth={page === path ? 2.2 : 1.8} />
            <span className="nav-label">{label}</span>
            {path === "incidents" && <span className="nav-label ml-auto rounded-full bg-[#fff0ef] px-2 py-0.5 text-[.62rem] font-bold text-[#b83b36]">3</span>}
          </button>
        ))}
      </nav>
      <div className="mt-auto">
        <div className="mb-5 rounded-2xl bg-[color-mix(in_srgb,var(--signal-cyan)_11%,transparent)] p-3.5 signal-rule">
          <div className="flex items-center gap-2 text-[.72rem] font-bold text-foreground"><span className="live-dot" />System online</div>
          <p className="mt-2 rail-caption text-[.7rem] leading-relaxed text-muted-foreground">Two cameras are watching. Equipment history is ready.</p>
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dff4f5] text-[.78rem] font-extrabold text-[#238f9b] dark:bg-[#23464e] dark:text-[#b6f0f1]">AD</div>
          <div className="admin-copy min-w-0 flex-1"><div className="text-[.78rem] font-bold text-foreground">Admin</div><div className="truncate text-[.68rem] text-muted-foreground">Safety operations</div></div>
          <ThemeToggle theme={theme} onToggle={onToggle} />
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  page,
  onNotifications,
  notificationOpen,
  theme,
  onToggle,
  navigate,
}: {
  page: Page;
  onNotifications: () => void;
  notificationOpen: boolean;
  theme: Theme;
  onToggle: () => void;
  navigate: (path: string) => void;
}) {
  const label =
    navItems.find((item) => item.path === page)?.label ?? "Overview";

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border bg-background/90 px-7 backdrop-blur-xl lg:px-10">
      <div className="mobile-topbar hidden items-center gap-3">
        <button
          aria-label="Open navigation"
          className="btn-secondary h-9 w-9 p-0"
        >
          <Menu size={16} />
        </button>
      </div>

      <div className="topbar-meta flex items-center gap-3 text-[.73rem] font-semibold text-muted-foreground">
        <span className="text-foreground">Safety console</span>
        <span className="text-border">/</span>
        <span>{label}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="topbar-meta hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[.7rem] font-bold text-muted-foreground sm:flex">
          <span className="live-dot" />
          All systems online
        </div>

        <div className="relative">
          <button
            aria-label="Open notifications"
            onClick={onNotifications}
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl border bg-card text-muted-foreground transition hover:border-[#49B8C4] hover:text-foreground ${
              notificationOpen
                ? "border-[#49B8C4]"
                : "border-border"
            }`}
          >
            <Bell size={16} strokeWidth={1.8} />
            <span className="absolute right-[7px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#E53935]" />
          </button>

          {notificationOpen && (
            <NotificationPopover navigate={navigate} />
          )}
        </div>

        <ThemeToggle theme={theme} onToggle={onToggle} />

        <div className="hidden items-center gap-2 pl-1 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dff4f5] text-[.68rem] font-extrabold text-[#238f9b] dark:bg-[#23464e] dark:text-[#b6f0f1]">
            AD
          </div>

          <span className="text-[.78rem] font-bold text-foreground">
            Admin
          </span>

          <ChevronDown
            size={14}
            className="text-muted-foreground"
          />
        </div>
      </div>
    </header>
  );
}

function NotificationPopover({ navigate }: { navigate: (path: string) => void }) {
  return <div className="surface absolute right-0 top-12 z-50 w-[310px] rounded-2xl p-3 fade-up">
    <div className="flex items-center justify-between px-2 py-1"><div className="display-font text-[.9rem] font-extrabold">Notifications</div><span className="text-[.68rem] font-semibold text-muted-foreground">3 new</span></div>
    <div className="mt-2 space-y-1">
      {notifications.map((incident) => <button key={incident.id} onClick={() => navigate("/incidents")} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition hover:bg-accent"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${incident.severity === "critical" ? "bg-[#E53935]" : incident.severity === "high" ? "bg-[#F59E0B]" : "bg-[#e5bf16]"}`} /><span className="min-w-0"><span className="block text-[.76rem] font-bold text-foreground">{incident.title}</span><span className="mt-0.5 block text-[.68rem] text-muted-foreground">{incident.location} · {incident.relative}</span></span></button>)}
    </div>
    <button onClick={() => navigate("/incidents")} className="mt-2 flex w-full items-center justify-center gap-2 border-t border-border pt-3 text-[.72rem] font-bold text-[#238f9b]">View incident history <ArrowRight size={13} /></button>
  </div>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="flex flex-col justify-between gap-5 border-b border-border pb-7 md:flex-row md:items-end"><div><div className="eyebrow">{eyebrow}</div><h1 className="display-font mt-3 text-[clamp(1.8rem,3vw,2.8rem)] font-extrabold leading-[1.02] text-foreground">{title}</h1><p className="mt-3 max-w-[560px] text-[.92rem] leading-relaxed text-muted-foreground">{subtitle}</p></div>{action}</div>;
}

function CameraFeed({ camera, onOpen }: { camera: CameraRecord; onOpen: (incidentId: string) => void }) {
  const incidentId = camera.kind === "restricted" ? "INC-1042" : "INC-1041";
  const isRestricted = camera.kind === "restricted";
  return <article className={`surface surface-hover overflow-hidden rounded-[1.25rem] ${camera.status !== "clear" ? "soft-pulse" : ""}`}>
    <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5"><div className="flex min-w-0 items-start gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isRestricted ? "bg-[#e9f8f8] text-[#238f9b] dark:bg-[#23464e]" : "bg-[#fff5e5] text-[#b66b0e] dark:bg-[#4a3821]"}`}>{isRestricted ? <LockKeyhole size={17} /> : <DoorOpen size={17} />}</div><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-[.93rem] font-extrabold text-foreground">{camera.name}</h2><span className="eyebrow hidden sm:inline">{camera.id}</span></div><p className="mt-1 truncate text-[.74rem] text-muted-foreground">{camera.location}</p></div></div><span className="flex shrink-0 items-center gap-1.5 text-[.68rem] font-bold uppercase tracking-[.12em] text-[#df4b47]"><span className="live-dot alert-dot" />Live</span></div>
    <button onClick={() => onOpen(incidentId)} className="camera-frame scan-lines group block aspect-[16/9] w-full text-left" aria-label={`Open ${camera.name} incident`}><img src={camera.image} alt={`${camera.name} hospital camera feed`} className="h-full w-full object-cover" /><div className="video-vignette absolute inset-0" />{isRestricted ? <><div className="absolute left-[45%] top-[24%] h-[47%] w-[21%] rounded-md border border-[#f15252] bg-[#e53935]/10 shadow-[0_0_0_1px_rgba(229,57,53,.18)]"><span className="absolute -top-6 left-0 rounded bg-[#e53935] px-2 py-1 text-[.58rem] font-bold text-white">Person · unauthorized</span></div><div className="absolute bottom-4 left-4 rounded-lg border border-white/35 bg-[#0e3036]/75 px-2.5 py-1.5 text-[.62rem] font-bold text-white backdrop-blur-sm">Restricted zone boundary</div></> : <><div className="absolute bottom-[17%] left-[12%] right-[12%] h-[33%] rounded-lg border border-[#f59e0b] bg-[#f59e0b]/10" /><div className="absolute bottom-4 left-4 rounded-lg border border-white/35 bg-[#0e3036]/75 px-2.5 py-1.5 text-[.62rem] font-bold text-white backdrop-blur-sm">Protected exit area · 67% occupied</div></>}{<span className="absolute right-4 top-4 rounded-full border border-white/30 bg-[#0e3036]/65 px-2.5 py-1 text-[.6rem] font-semibold text-white backdrop-blur-sm">13:4{isRestricted ? "2:18" : "6:02"}</span>}</button>
    <div className="px-5 pb-5 pt-4"><div className="flex items-center justify-between gap-3"><div><div className={`text-[.88rem] font-extrabold ${isRestricted ? "text-[#c33734] dark:text-[#ffaaa7]" : "text-[#a86608] dark:text-[#ffc56b]"}`}>{camera.statusLabel}</div><div className="mt-1 text-[.73rem] text-muted-foreground">{camera.description}</div></div><ArrowUpRight size={17} className="shrink-0 text-muted-foreground transition group-hover:text-foreground" /></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">{camera.metadata.map((meta) => <div key={meta} className="min-w-0"><div className="truncate text-[.68rem] font-bold text-foreground">{meta}</div><div className="mt-1 text-[.61rem] uppercase tracking-[.1em] text-muted-foreground">{meta.includes(":") ? "Detected" : meta.includes("Badge") ? "Badge" : meta.includes("Author") ? "Decision" : meta.includes("obstruction") ? "Estimate" : "Evidence"}</div></div>)}</div></div>
  </article>;
}

function CameraStatusCard({ icon: Icon, title, description, severity, onClick }: { icon: typeof ShieldAlert; title: string; description: string; severity: Severity; onClick: () => void }) {
  return <button onClick={onClick} className="surface surface-hover flex min-h-[116px] w-full flex-col justify-between rounded-2xl p-4 text-left"><div className="flex items-start justify-between gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${severity === "critical" ? "bg-[#fff0ef] text-[#e53935] dark:bg-[#512b31]" : severity === "high" ? "bg-[#fff5e5] text-[#bb720f] dark:bg-[#4a3821]" : "bg-[#eaf9f0] text-[#1c9853] dark:bg-[#214934]"}`}><Icon size={16} /></div><ArrowUpRight size={15} className="text-muted-foreground" /></div><div className="mt-4 flex items-end justify-between gap-2"><div><div className="text-[.82rem] font-extrabold text-foreground">{title}</div><div className="mt-1 text-[.68rem] text-muted-foreground">{description}</div></div><span className={`text-[.65rem] font-bold uppercase tracking-[.1em] ${severity === "critical" ? "text-[#df4b47]" : severity === "high" ? "text-[#b66b0e]" : "text-[#168448]"}`}>{severity === "critical" ? "Alert" : severity === "high" ? "Blocked" : "Normal"}</span></div></button>;
}

function IncidentRow({ incident, onOpen }: { incident: Incident; onOpen: (incident: Incident) => void }) {
  return <button onClick={() => onOpen(incident)} className="group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-accent"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${incident.severity === "critical" ? "bg-[#fff0ef] text-[#e53935] dark:bg-[#512b31]" : incident.severity === "high" ? "bg-[#fff5e5] text-[#b66b0e] dark:bg-[#4a3821]" : "bg-[#fff8d8] text-[#aa8400] dark:bg-[#4a4221]"}`}>{incident.type === "restricted" ? <LockKeyhole size={14} /> : incident.type === "exit" ? <DoorOpen size={14} /> : <Thermometer size={14} />}</div><div className="min-w-0 flex-1"><div className="truncate text-[.77rem] font-bold text-foreground">{incident.title}</div><div className="mt-0.5 truncate text-[.68rem] text-muted-foreground">{incident.location} · {incident.relative}</div></div><span className={`hidden text-[.64rem] font-bold uppercase tracking-[.08em] sm:inline ${incident.severity === "critical" ? "text-[#df4b47]" : incident.severity === "high" ? "text-[#b66b0e]" : "text-[#aa8400]"}`}>{severityCopy[incident.severity]}</span><ArrowRight size={14} className="text-border transition group-hover:translate-x-0.5 group-hover:text-muted-foreground" /></button>;
}

function Overview({ navigate, onOpenIncident }: { navigate: (path: string) => void; onOpenIncident: (incident: Incident) => void }) {
  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">{formatNow()} · Live overview</div><h1 className="display-font mt-3 text-[clamp(2rem,3.6vw,3.35rem)] font-extrabold leading-[.98] text-foreground">Good evening, Admin<span className="text-[#49B8C4]">.</span></h1><p className="mt-4 text-[.96rem] text-muted-foreground">A clearer view of what needs attention across the hospital.</p></div><div className="flex items-center gap-2 rounded-xl border border-[#bde9e9] bg-[#ecfaf9] px-3.5 py-2.5 text-[.72rem] font-bold text-[#237d84] dark:border-[#356568] dark:bg-[#1c383d] dark:text-[#a6e7e6]"><CheckCircle2 size={15} /> All monitoring systems are online</div></div>
    <div className="grid gap-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Live observation</div><h2 className="display-font mt-2 text-xl font-extrabold text-foreground">Two places worth watching</h2></div><button onClick={() => navigate("/monitoring")} className="btn-secondary">Open monitoring <ArrowRight size={14} /></button></div><div className="camera-grid grid grid-cols-2 gap-5"><CameraFeed camera={cameras[0]} onOpen={() => onOpenIncident(seedIncidents[0])} /><CameraFeed camera={cameras[1]} onOpen={() => onOpenIncident(seedIncidents[1])} /></div></div>
    <section><div className="eyebrow">At a glance</div><h2 className="display-font mt-2 text-xl font-extrabold text-foreground">Three safety signals</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><CameraStatusCard icon={ShieldAlert} title="Restricted zone" description="Unauthorized entry detected" severity="critical" onClick={() => navigate("/monitoring")} /><CameraStatusCard icon={DoorOpen} title="Exit safety" description="Clear the pathway" severity="high" onClick={() => navigate("/monitoring")} /><CameraStatusCard icon={Wrench} title="Equipment intelligence" description="1 item needs attention" severity="attention" onClick={() => navigate("/equipment")} /></div></section>
    <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="surface rounded-2xl p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Remember</div><h2 className="display-font mt-2 text-xl font-extrabold text-foreground">Recent incidents</h2></div><button onClick={() => navigate("/incidents")} className="text-[.73rem] font-bold text-[#238f9b]">View all <ArrowRight className="ml-1 inline" size={13} /></button></div><div className="mt-4 space-y-1">{seedIncidents.slice(0, 3).map((incident) => <IncidentRow key={incident.id} incident={incident} onOpen={onOpenIncident} />)}</div></div><div className="relative overflow-hidden rounded-2xl bg-[#16353d] p-6 text-white shadow-[0_14px_42px_rgba(22,53,61,.16)]"><div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border-[22px] border-[#49B8C4]/15" /><div className="absolute -bottom-24 -left-12 h-52 w-52 rounded-full border-[26px] border-[#7DDDE5]/10" /><div className="relative"><div className="flex items-center gap-2 text-[.68rem] font-bold uppercase tracking-[.16em] text-[#a4e3e4]"><Eye size={14} /> The CareTrace way</div><h2 className="display-font mt-10 max-w-[260px] text-[1.75rem] font-extrabold leading-[1.08]">See it.<br />Understand it.<br /><span className="text-[#7DDDE5]">Remember it.</span></h2><p className="mt-5 max-w-[270px] text-[.8rem] leading-relaxed text-[#c4dadd]">One focused system for the moments that keep a hospital moving safely.</p></div></div></section>
  </div>;
}

function Monitoring({ onOpenIncident }: { onOpenIncident: (incident: Incident) => void }) {
  const [selected, setSelected] = useState(0);
  const camera = cameras[selected];
  const isRestricted = camera.kind === "restricted";
  return <div className="space-y-7"><PageHeader eyebrow="Monitoring" title="Stay close to what matters." subtitle="CareTrace watches areas that should stay restricted and pathways that should stay clear." action={<div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[.7rem] font-bold text-muted-foreground"><span className="live-dot" /> Live cameras</div>} /><div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="surface overflow-hidden rounded-[1.25rem]"><div className="flex gap-2 border-b border-border p-3">{cameras.map((item, index) => <button key={item.id} onClick={() => setSelected(index)} className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-left transition ${selected === index ? "bg-accent" : "hover:bg-muted"}`}><span className={`h-2 w-2 rounded-full ${item.kind === "restricted" ? "bg-[#e53935]" : "bg-[#f59e0b]"}`} /><span className="min-w-0"><span className="block truncate text-[.76rem] font-bold text-foreground">{item.name}</span><span className="mt-0.5 block text-[.63rem] text-muted-foreground">{item.id} · {item.location}</span></span></button>)}</div><CameraFeed camera={camera} onOpen={() => onOpenIncident(seedIncidents[isRestricted ? 0 : 1])} /></div><div className="surface rounded-[1.25rem] p-6"><div className="eyebrow">AI observation</div><h2 className="display-font mt-3 text-2xl font-extrabold text-foreground">{isRestricted ? "Restricted zone" : "Emergency exit"}</h2><p className="mt-2 text-[.82rem] leading-relaxed text-muted-foreground">{isRestricted ? "CareTrace watches areas that should stay restricted." : "Keep emergency pathways clear."}</p><div className="mt-7 space-y-5">{isRestricted ? <><ObservationRow icon={Activity} label="AI detection" value="Person detected" accent="critical" /><ObservationRow icon={LockKeyhole} label="Restricted zone" value="Entered" accent="critical" /><ObservationRow icon={ShieldAlert} label="Badge" value="Not detected" /><ObservationRow icon={ShieldAlert} label="Authorization" value="Unauthorized" accent="critical" /><ObservationRow icon={FileImage} label="Evidence" value="Captured" /></> : <><ObservationRow icon={DoorOpen} label="AI status" value="Exit blocked" accent="high" /><ObservationRow icon={SlidersHorizontal} label="Estimated obstruction" value="67%" accent="high" /><ObservationRow icon={Clock3} label="Detected" value="13:46:02" /><ObservationRow icon={FileImage} label="Evidence" value="Captured" /></>}</div><div className={`mt-7 rounded-xl p-4 ${isRestricted ? "bg-[#fff0ef] dark:bg-[#512b31]" : "bg-[#fff5e5] dark:bg-[#4a3821]"}`}><div className={`flex items-center gap-2 text-[.72rem] font-extrabold uppercase tracking-[.1em] ${isRestricted ? "text-[#c33734] dark:text-[#ffaaa7]" : "text-[#a86608] dark:text-[#ffc56b]"}`}><AlertTriangle size={14} /> Recommended action</div><p className="mt-2 text-[.82rem] font-bold text-foreground">{isRestricted ? "Security should check the restricted area." : "Clear the exit immediately."}</p></div><button onClick={() => onOpenIncident(seedIncidents[isRestricted ? 0 : 1])} className="btn-primary mt-5 w-full">View incident <ArrowUpRight size={15} /></button></div></div></div>;
}

function ObservationRow({ icon: Icon, label, value, accent }: { icon: typeof Activity; label: string; value: string; accent?: "critical" | "high" }) { return <div className="flex items-center justify-between gap-4 border-b border-border pb-3"><div className="flex items-center gap-2 text-[.75rem] text-muted-foreground"><Icon size={14} />{label}</div><div className={`text-right text-[.78rem] font-extrabold ${accent === "critical" ? "text-[#df4b47] dark:text-[#ffaaa7]" : accent === "high" ? "text-[#b66b0e] dark:text-[#ffc56b]" : "text-foreground"}`}>{value}</div></div>; }

function Equipment({ navigate, onOpenIncident }: { navigate: (path: string) => void; onOpenIncident: (incident: Incident) => void }) {
  const [selected, setSelected] = useState(equipment[0]);
  return <div className="space-y-7"><PageHeader eyebrow="Equipment intelligence" title="Remember what happened before." subtitle="Understand today’s problem using the patterns CareTrace has already seen." action={<button onClick={() => navigate("/equipment/report")} className="btn-primary"><CloudUpload size={16} /> Report an issue</button>} /><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="space-y-3">{equipment.map((item) => <button key={item.id} onClick={() => setSelected(item)} className={`surface surface-hover flex w-full items-center gap-3 rounded-2xl p-4 text-left ${selected.id === item.id ? "signal-rule" : ""}`}><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e9f8f8] dark:bg-[#23464e]"><img src={item.image} alt="" className="h-full w-full object-cover opacity-90" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-[.83rem] font-extrabold text-foreground">{item.name}</span>{item.status === "attention" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />}</div><div className="mt-1 truncate text-[.7rem] text-muted-foreground">{item.location} · {item.department}</div></div><ArrowRight size={15} className="text-muted-foreground" /></button>)}<button onClick={() => navigate("/equipment/report")} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#a9dfe1] px-4 py-4 text-[.74rem] font-bold text-[#238f9b] transition hover:bg-accent"><CloudUpload size={16} /> Report equipment issue</button></div><EquipmentHistory item={selected} onOpenIncident={onOpenIncident} /></div></div>;
}

function EquipmentHistory({ item, onOpenIncident }: { item: Equipment; onOpenIncident: (incident: Incident) => void }) {
  const firstEquipmentIncident = seedIncidents.find((incident) => incident.type === "equipment");
  return <div className="surface overflow-hidden rounded-[1.25rem]"><div className="flex flex-col justify-between gap-5 border-b border-border p-6 sm:flex-row sm:items-start"><div><div className="eyebrow">Equipment history · {item.id}</div><h2 className="display-font mt-2 text-2xl font-extrabold text-foreground">{item.name}</h2><p className="mt-1 text-[.76rem] text-muted-foreground">{item.location} · {item.department}</p></div><StatusPill severity={item.status === "attention" ? "attention" : "clear"}>{item.status === "attention" ? "Attention required" : "Normal"}</StatusPill></div><div className="grid gap-6 p-6 md:grid-cols-[.8fr_1.2fr]"><div><div className="eyebrow">Current issue</div><div className="mt-2 text-[1.2rem] font-extrabold text-foreground">{item.issue}</div><div className="mt-6 rounded-xl bg-accent p-4"><div className="flex items-center gap-2 text-[.71rem] font-extrabold text-[#238f9b]"><Info size={14} /> CareTrace insight</div><p className="mt-2 text-[.8rem] leading-relaxed text-foreground">{item.insight}</p></div><div className="mt-4 rounded-xl border border-[#bde9e9] bg-[#f0fbfb] p-4 dark:border-[#356568] dark:bg-[#1c383d]"><div className="eyebrow text-[#238f9b]">Recommendation</div><p className="mt-2 text-[.8rem] font-bold leading-relaxed text-foreground">{item.recommendation}</p></div></div><div><div className="eyebrow">Past incidents · {item.incidents.length || "none"}</div>{item.incidents.length ? <div className="trace-line mt-4 space-y-5">{item.incidents.map((past) => <div key={past.date} className="relative flex gap-4"><div className="trace-node mt-1 shrink-0" /><div><div className="text-[.7rem] font-bold text-[#238f9b]">{past.date}</div><div className="mt-1 text-[.8rem] font-extrabold text-foreground">{past.issue}</div>{past.resolution && <div className="mt-1 text-[.7rem] text-muted-foreground">Resolution: {past.resolution}</div>}</div></div>)}</div> : <div className="mt-4 rounded-xl bg-muted p-4 text-[.78rem] leading-relaxed text-muted-foreground">No previous equipment problems have been recorded.</div>}{firstEquipmentIncident && item.status === "attention" && <button onClick={() => onOpenIncident(firstEquipmentIncident)} className="btn-secondary mt-6">Open latest incident <ArrowUpRight size={14} /></button>}</div></div></div>;
}

function EquipmentReport({ navigate }: { navigate: (path: string) => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [equipmentType, setEquipmentType] = useState("MRI Scanner");
  const [floor, setFloor] = useState("Floor 2");
  const [room, setRoom] = useState("204");
  const [department, setDepartment] = useState("Radiology");
  const [description, setDescription] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (analysisStage > 0 && analysisStage < 4) { const timer = window.setTimeout(() => setAnalysisStage((stage) => stage + 1), 850); return () => window.clearTimeout(timer); } }, [analysisStage]);
  const chooseFile = (selected: File | undefined) => { if (!selected) return; if (!selected.type.startsWith("image/")) { toast.error("Please choose a JPG, PNG, or WEBP image."); return; } const reader = new FileReader(); reader.onload = () => setFile(String(reader.result)); reader.readAsDataURL(selected); setFileName(selected.name); };
  const analyze = () => { if (!description.trim()) { toast.error("Tell us what you noticed first."); return; } setAnalysisStage(1); };
  if (analysisStage === 4) return <AnalysisResult file={file} equipmentType={equipmentType} floor={floor} room={room} department={department} navigate={navigate} onReset={() => setAnalysisStage(0)} />;
  return <div className="space-y-7"><PageHeader eyebrow="Equipment report" title="Something not quite right?" subtitle="Show us what you noticed, and CareTrace will help you understand it." action={<img src={generatedAssets.equipment} alt="Soft illustration of a medical scanner" className="hidden h-[84px] w-[130px] rounded-2xl object-cover shadow-sm sm:block" />} />{analysisStage > 0 && <div className="surface rounded-2xl p-4"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-[#238f9b]"><Activity size={16} className="animate-pulse" /></div><div><div className="text-[.78rem] font-extrabold text-foreground">{analysisStage === 1 ? "CareTrace is taking a look…" : analysisStage === 2 ? "Checking what happened before…" : "Looking for similar problems…"}</div><div className="mt-1 text-[.68rem] text-muted-foreground">This usually takes a few seconds.</div></div></div><div className="flex gap-1.5">{[1, 2, 3].map((stage) => <span key={stage} className={`h-1.5 w-8 rounded-full ${analysisStage >= stage ? "bg-[#49B8C4]" : "bg-muted"}`} />)}</div></div></div>}
    <div className="surface mx-auto max-w-[820px] rounded-[1.35rem] p-5 sm:p-8"><div className="flex items-center gap-3 border-b border-border pb-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-[#238f9b]"><Wrench size={17} /></div><div><div className="text-[.92rem] font-extrabold text-foreground">Help us understand the issue</div><div className="mt-1 text-[.71rem] text-muted-foreground">A few simple details are enough.</div></div></div><div className="mt-7 space-y-8"><div><StepLabel number="01" title="Show us the problem" /><button onClick={() => fileRef.current?.click()} className={`mt-4 flex min-h-[190px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed ${file ? "border-[#49B8C4] bg-accent" : "border-[#a9dfe1] bg-[#f7fcfc] dark:bg-[#1c383d]"} p-6 text-center transition hover:bg-accent`}>{file ? <><img src={file} alt="Equipment issue preview" className="max-h-[150px] rounded-xl object-contain" /><span className="mt-3 text-[.7rem] font-bold text-[#238f9b]">{fileName}</span></> : <><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#49B8C4] shadow-sm dark:bg-[#23464e]"><UploadCloud size={22} /></div><div className="mt-4 text-[.85rem] font-extrabold text-foreground">Drop a picture here</div><div className="mt-1 text-[.75rem] text-muted-foreground">or <span className="font-bold text-[#238f9b]">choose a picture from your device</span></div><div className="mt-3 text-[.65rem] text-muted-foreground">JPG · PNG · WEBP</div></>}</button><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />{file && <div className="mt-2 flex gap-2"><button onClick={() => fileRef.current?.click()} className="btn-secondary">Change picture</button><button onClick={() => { setFile(null); setFileName(""); }} className="btn-secondary text-[#c33734]">Remove</button></div>}</div><div><StepLabel number="02" title="What equipment is it?" /><select value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)} className="mt-4 h-11 w-full rounded-xl border border-border bg-card px-3 text-[.8rem] font-semibold text-foreground"><option>MRI Scanner</option><option>CT Scanner</option><option>Ventilator</option><option>Patient Monitor</option><option>X-Ray Machine</option><option>Infusion Pump</option><option>Other</option><option>Not sure</option></select></div><div><StepLabel number="03" title="Where is it?" /><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-[.7rem] font-bold text-muted-foreground">Floor<select value={floor} onChange={(event) => setFloor(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-[.78rem] font-semibold text-foreground"><option>Floor 1</option><option>Floor 2</option><option>Floor 3</option><option>Ground floor</option></select></label><label className="text-[.7rem] font-bold text-muted-foreground">Room<input value={room} onChange={(event) => setRoom(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-[.78rem] font-semibold text-foreground" placeholder="204" /></label><label className="text-[.7rem] font-bold text-muted-foreground">Department<select value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-[.78rem] font-semibold text-foreground"><option>Radiology</option><option>ICU</option><option>Emergency</option><option>Surgery</option><option>Cardiology</option><option>Other</option></select></label></div></div><div><StepLabel number="04" title="What did you notice?" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-4 min-h-[128px] w-full resize-y rounded-xl border border-border bg-card p-3 text-[.8rem] text-foreground placeholder:text-muted-foreground" placeholder="Tell us what seems wrong…" /><p className="mt-2 text-[.68rem] leading-relaxed text-muted-foreground">Strange noise, overheating, unusual display, warning light, damaged part, or anything else you noticed.</p></div><div className="border-t border-border pt-4"><button onClick={() => setShowOptional((value) => !value)} className="flex items-center gap-2 text-[.76rem] font-bold text-foreground"><ChevronDown size={15} className={`transition ${showOptional ? "rotate-180" : ""}`} />Add more details <span className="font-normal text-muted-foreground">(optional)</span></button>{showOptional && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-[.7rem] font-bold text-muted-foreground">When did you first notice it?<input type="datetime-local" className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-[.78rem] text-foreground" /></label><label className="text-[.7rem] font-bold text-muted-foreground">Currently being used?<select className="mt-2 h-11 w-full rounded-xl border border-border bg-card px-3 text-[.78rem] text-foreground"><option>Yes</option><option>No</option></select></label></div>}</div><div className="rounded-xl bg-accent p-4"><div className="flex items-start gap-3"><Info size={16} className="mt-0.5 shrink-0 text-[#238f9b]" /><p className="text-[.72rem] leading-relaxed text-muted-foreground">CareTrace will compare this issue with previous equipment incidents.</p></div></div><button onClick={analyze} disabled={analysisStage > 0} className="btn-primary w-full py-3.5">Analyze with CareTrace <ArrowRight size={16} /></button></div></div></div>;
}

function StepLabel({ number, title }: { number: string; title: string }) { return <div className="flex items-center gap-3"><span className="eyebrow text-[#238f9b]">Step {number}</span><span className="h-px flex-1 bg-border" /><span className="text-[.88rem] font-extrabold text-foreground">{title}</span></div>; }

function AnalysisResult({ file, equipmentType, floor, room, department, navigate, onReset }: { file: string | null; equipmentType: string; floor: string; room: string; department: string; navigate: (path: string) => void; onReset: () => void }) {
  return <div className="space-y-7"><PageHeader eyebrow="Equipment analysis" title="Here’s what CareTrace found." subtitle="A concise read on the issue, the pattern behind it, and a sensible next step." action={<span className="status-pill attention"><span className="live-dot warning-dot" />Attention</span>} /><div className="grid gap-5 lg:grid-cols-[1fr_.72fr]"><div className="surface rounded-[1.25rem] p-6"><div className="grid gap-6 sm:grid-cols-2"><div><div className="eyebrow">Equipment</div><div className="mt-2 text-[1rem] font-extrabold text-foreground">{equipmentType}</div></div><div><div className="eyebrow">Location</div><div className="mt-2 text-[.82rem] font-extrabold leading-relaxed text-foreground">{floor}<br />Room {room}<br />{department}</div></div></div><div className="my-6 h-px bg-border" /><div><div className="eyebrow">Possible issue</div><div className="mt-2 text-[1.16rem] font-extrabold text-foreground">Temperature abnormality detected</div></div><div className="mt-6 rounded-2xl bg-accent p-5"><div className="flex items-center gap-2 text-[.72rem] font-extrabold uppercase tracking-[.1em] text-[#238f9b]"><History size={15} /> Similar past incidents</div><div className="mt-3 flex items-end justify-between gap-4"><div className="display-font text-3xl font-extrabold text-foreground">4</div><p className="max-w-[220px] text-right text-[.76rem] leading-relaxed text-muted-foreground">Similar problems have happened before.</p></div></div><div className="mt-7"><div className="eyebrow">What happened before</div><div className="trace-line mt-4 space-y-5"><HistoryItem date="12 Aug" issue="Overheating detected" resolution="Cooling system inspected" /><HistoryItem date="19 Aug" issue="Temperature abnormality" resolution="Filter replaced" /><HistoryItem date="29 Aug" issue="Temperature rising again" /></div></div><div className="mt-7 rounded-xl border border-[#bde9e9] bg-[#f0fbfb] p-4 dark:border-[#356568] dark:bg-[#1c383d]"><div className="eyebrow text-[#238f9b]">CareTrace recommendation</div><p className="mt-2 text-[.86rem] font-extrabold leading-relaxed text-foreground">Consider inspecting the cooling system.</p></div></div><div className="space-y-5"><div className="surface overflow-hidden rounded-[1.25rem] p-4"><div className="eyebrow px-1 pb-3">Evidence</div><div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">{file ? <img src={file} alt="Uploaded equipment evidence" className="h-full w-full object-cover" /> : <img src={generatedAssets.equipment} alt="Equipment evidence illustration" className="h-full w-full object-cover" />}</div><div className="mt-3 flex items-center gap-2 text-[.68rem] text-muted-foreground"><FileImage size={14} /> Evidence captured for this incident</div></div><button onClick={() => navigate("/incidents")} className="btn-primary w-full">View incident <ArrowUpRight size={15} /></button><button onClick={onReset} className="btn-secondary w-full">Report another issue <ArrowRight size={14} /></button></div></div></div>;
}

function HistoryItem({ date, issue, resolution }: { date: string; issue: string; resolution?: string }) { return <div className="relative flex gap-4"><div className="trace-node mt-1 shrink-0" /><div><div className="text-[.7rem] font-bold text-[#238f9b]">{date}</div><div className="mt-1 text-[.8rem] font-extrabold text-foreground">{issue}</div>{resolution && <div className="mt-1 text-[.7rem] text-muted-foreground">Resolution: {resolution}</div>}</div></div>; }

function Incidents({ incidents, onOpen }: { incidents: Incident[]; onOpen: (incident: Incident) => void }) {
  const [type, setType] = useState<"All" | IncidentType>("All");
  const [status, setStatus] = useState<"All" | Incident["status"]>("All");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => incidents.filter((incident) => (type === "All" || incident.type === type) && (status === "All" || incident.status === status) && `${incident.title} ${incident.location}`.toLowerCase().includes(search.toLowerCase())), [incidents, type, status, search]);
  return <div className="space-y-7"><PageHeader eyebrow="Incident history" title="Everything CareTrace has detected." subtitle="One clear record of restricted-zone events, exit obstructions, and equipment problems." /><div className="surface rounded-[1.25rem] p-4 sm:p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex items-center gap-2"><Filter size={15} className="text-muted-foreground" /><span className="text-[.76rem] font-extrabold text-foreground">Filter incidents</span></div><div className="flex flex-wrap gap-2">{(["All", "restricted", "exit", "equipment"] as const).map((value) => <button key={value} onClick={() => setType(value as "All" | IncidentType)} className={`rounded-lg px-3 py-2 text-[.68rem] font-bold transition ${type === value ? "bg-[#16353d] text-white dark:bg-[#49B8C4] dark:text-[#102027]" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{value === "All" ? "All" : typeCopy[value]}</button>)}<span className="mx-1 hidden h-7 w-px bg-border sm:block" />{(["All", "Open", "Under review", "Resolved"] as const).map((value) => <button key={value} onClick={() => setStatus(value)} className={`rounded-lg px-3 py-2 text-[.68rem] font-bold transition ${status === value ? "bg-accent text-[#238f9b]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{value}</button>)}</div><label className="relative block lg:w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents…" className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-[.73rem] text-foreground placeholder:text-muted-foreground" /></label></div><div className="mt-5 border-t border-border pt-2">{filtered.length ? filtered.map((incident) => <IncidentTableRow key={incident.id} incident={incident} onOpen={onOpen} />) : <div className="py-16 text-center"><Search size={22} className="mx-auto text-muted-foreground" /><div className="mt-3 text-[.82rem] font-bold text-foreground">No incidents found</div><div className="mt-1 text-[.72rem] text-muted-foreground">Try a different filter or search term.</div></div>}</div></div></div>;
}

function IncidentTableRow({ incident, onOpen }: { incident: Incident; onOpen: (incident: Incident) => void }) { return <button onClick={() => onOpen(incident)} className="group grid w-full grid-cols-[1fr_auto] gap-3 border-b border-border px-2 py-4 text-left transition last:border-b-0 hover:bg-accent sm:grid-cols-[1.25fr_1fr_.75fr_.65fr_auto] sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${incident.severity === "critical" ? "bg-[#fff0ef] text-[#e53935] dark:bg-[#512b31]" : incident.severity === "high" ? "bg-[#fff5e5] text-[#b66b0e] dark:bg-[#4a3821]" : "bg-[#fff8d8] text-[#aa8400] dark:bg-[#4a4221]"}`}>{incident.type === "restricted" ? <LockKeyhole size={15} /> : incident.type === "exit" ? <DoorOpen size={15} /> : <Thermometer size={15} />}</div><div className="min-w-0"><div className="truncate text-[.77rem] font-extrabold text-foreground">{incident.title}</div><div className="mt-1 truncate text-[.67rem] text-muted-foreground">{typeCopy[incident.type]}</div></div></div><div className="hidden text-[.75rem] font-semibold text-muted-foreground sm:block">{incident.location}</div><div className="hidden text-[.73rem] font-semibold text-muted-foreground sm:block">{incident.detected}</div><div className="text-right sm:text-left"><div className={`text-[.65rem] font-bold uppercase tracking-[.08em] ${incident.severity === "critical" ? "text-[#df4b47]" : incident.severity === "high" ? "text-[#b66b0e]" : "text-[#aa8400]"}`}>{severityCopy[incident.severity]}</div><div className="mt-1 text-[.65rem] text-muted-foreground">{incident.status}</div></div><ArrowUpRight size={15} className="ml-auto self-center text-border transition group-hover:text-foreground" /></button>; }

function IncidentDetail({ incident, onClose, onResolve }: { incident: Incident; onClose: () => void; onResolve: (id: string) => void }) {
  const resolved = incident.status === "Resolved";
  return <div className="fixed inset-0 z-50 flex justify-end bg-[#102027]/25 p-0 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="h-full w-full max-w-[500px] overflow-y-auto bg-background p-6 shadow-[-20px_0_60px_rgba(16,32,39,.16)] sm:p-8 fade-up"><div className="flex items-center justify-between"><div className="eyebrow">Incident detail · {incident.id}</div><button onClick={onClose} aria-label="Close incident detail" className="btn-secondary h-9 w-9 p-0"><X size={16} /></button></div><div className="mt-7 flex items-start justify-between gap-4"><div><h2 className="display-font text-[1.75rem] font-extrabold leading-[1.05] text-foreground">{incident.title}</h2><div className="mt-3 flex items-center gap-2 text-[.77rem] text-muted-foreground"><span className="flex items-center gap-1"><Clock3 size={13} /> {incident.detected}</span><span>·</span><span>{incident.camera ?? "Equipment report"}</span></div></div><StatusPill severity={incident.severity}>{severityCopy[incident.severity]}</StatusPill></div><div className="mt-7 grid grid-cols-2 gap-3 rounded-2xl bg-card p-4 shadow-[0_8px_26px_rgba(28,92,104,.07)]"><div><div className="eyebrow">Location</div><div className="mt-2 text-[.8rem] font-extrabold text-foreground">{incident.location}</div><div className="mt-1 text-[.68rem] text-muted-foreground">{incident.floor}</div></div><div><div className="eyebrow">Status</div><div className="mt-2 text-[.8rem] font-extrabold text-foreground">{incident.status}</div><div className="mt-1 text-[.68rem] text-muted-foreground">{incident.relative}</div></div></div><div className="mt-7 space-y-6">{Object.entries(incident.details).map(([label, value]) => <div key={label}><div className="eyebrow">{label}</div><div className="mt-2 text-[.83rem] font-semibold leading-relaxed text-foreground">{value}</div></div>)}<div><div className="eyebrow">Evidence</div><div className="camera-frame mt-3 aspect-[4/3] overflow-hidden rounded-2xl"><img src={incident.evidence} alt="Incident evidence" className="h-full w-full object-cover" /><div className="absolute bottom-3 left-3 rounded-lg bg-[#0e3036]/78 px-2.5 py-1.5 text-[.63rem] font-bold text-white">Evidence captured · {incident.detected}</div></div></div><div className="rounded-2xl border border-[#bde9e9] bg-[#f0fbfb] p-5 dark:border-[#356568] dark:bg-[#1c383d]"><div className="eyebrow text-[#238f9b]">Recommended action</div><p className="mt-2 text-[.85rem] font-extrabold leading-relaxed text-foreground">{incident.action}</p></div><div><div className="eyebrow">Status</div>{resolved ? <div className="mt-3 flex items-center gap-2 text-[.8rem] font-bold text-[#168448]"><CheckCircle2 size={17} /> This incident is resolved.</div> : <button onClick={() => { onResolve(incident.id); toast.success("Incident marked as resolved"); }} className="btn-primary mt-3 w-full"><Check size={16} /> Mark as resolved</button>}</div></div></aside></div>;
}

export default function Home() {
  const [location, navigate] = useLocation();
  const page = getPage(location);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("caretrace-theme") as Theme) || "light");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState(seedIncidents);
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); localStorage.setItem("caretrace-theme", theme); }, [theme]);
  const openIncident = (incident: Incident) => setActiveIncident(incidents.find((item) => item.id === incident.id) ?? incident);
  const resolveIncident = (id: string) => { setIncidents((items) => items.map((item) => item.id === id ? { ...item, status: "Resolved" as const } : item)); setActiveIncident((item) => item?.id === id ? { ...item, status: "Resolved" as const } : item); };
  return <div className="app-shell"><Sidebar page={page} navigate={navigate} theme={theme} onToggle={() => setTheme((value) => value === "light" ? "dark" : "light")} /><div className="workspace ml-[242px] min-h-screen transition-[margin] duration-200"><Topbar page={page} onNotifications={() => setNotificationOpen((value) => !value)} notificationOpen={notificationOpen} theme={theme} onToggle={() => setTheme((value) => value === "light" ? "dark" : "light")} navigate={navigate} /><main className="content-pad mx-auto max-w-[1440px] px-7 py-9 lg:px-10">{page === "overview" && <Overview navigate={navigate} onOpenIncident={openIncident} />}{page === "monitoring" && <Monitoring onOpenIncident={openIncident} />}{page === "equipment" && <Equipment navigate={navigate} onOpenIncident={openIncident} />}{page === "report" && <EquipmentReport navigate={navigate} />}{page === "incidents" && <Incidents incidents={incidents} onOpen={openIncident} />}</main></div>{activeIncident && <IncidentDetail incident={activeIncident} onClose={() => setActiveIncident(null)} onResolve={resolveIncident} />}</div>;
}
