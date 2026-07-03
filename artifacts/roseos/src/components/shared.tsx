import React from "react";
import { cn } from "@/lib/utils";
import type { Classification, RiskLevel, ApprovalRoute } from "@/types";
import { ShieldCheck, FileText, Sparkles, PenLine, Clock, Lock, CheckCircle2, ArrowUpRight } from "lucide-react";

const CLASS_META: Record<Classification, { label: string; cls: string; icon: React.ElementType }> = {
  "documented-fact": { label: "Documented Fact", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: FileText },
  "user-update": { label: "User Update", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: PenLine },
  "ai-recommendation": { label: "AI Recommendation", cls: "bg-violet-50 text-violet-700 border-violet-200", icon: Sparkles },
  "draft-idea": { label: "Draft Idea", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: PenLine },
  "pending-approval": { label: "Pending Approval", cls: "bg-orange-50 text-orange-700 border-orange-200", icon: Clock },
  "approved-decision": { label: "Approved Decision", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  sensitive: { label: "Sensitive", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: Lock },
};

export function ClassificationBadge({ value }: { value: Classification }) {
  const meta = CLASS_META[value];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", meta.cls)}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

const RISK_META: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export function RiskBadge({ value }: { value: RiskLevel }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize", RISK_META[value])}>
      {value} risk
    </span>
  );
}

const ROUTE_META: Record<ApprovalRoute, { label: string; cls: string }> = {
  rose: { label: "Rose review", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  carmen: { label: "Carmen review", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  both: { label: "Rose + Carmen", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  none: { label: "No approval needed", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function ApprovalRouteBadge({ value }: { value: ApprovalRoute }) {
  const meta = ROUTE_META[value];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", meta.cls)}>
      <ShieldCheck className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export function StatusChip({ label, tone = "slate" }: { label: string; tone?: "slate" | "rose" | "sky" | "emerald" | "amber" | "violet" | "orange" }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    orange: "bg-orange-50 text-orange-700",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", tones[tone])}>{label.replace(/-/g, " ")}</span>;
}

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  accent = "rose",
  actions,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent?: "rose" | "sky" | "violet" | "amber" | "emerald";
  actions?: React.ReactNode;
}) {
  const accents: Record<string, string> = {
    rose: "from-rose-500 to-orange-400",
    sky: "from-sky-500 to-blue-500",
    violet: "from-violet-500 to-fuchsia-500",
    amber: "from-amber-500 to-orange-500",
    emerald: "from-emerald-500 to-teal-500",
  };
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm", accents[accent])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  icon: Icon,
  accent = "rose",
  children,
  action,
  className,
}: {
  title: string;
  icon?: React.ElementType;
  accent?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    rose: "text-rose-500",
    sky: "text-sky-500",
    violet: "text-violet-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
    orange: "text-orange-500",
  };
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
          {Icon && <Icon className={cn("h-4 w-4", tones[accent] ?? tones.rose)} />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const KPI_TONES: Record<string, { card: string; icon: string }> = {
  blue: { card: "border-sky-100 bg-sky-50/70", icon: "bg-sky-100 text-sky-500" },
  emerald: { card: "border-emerald-100 bg-emerald-50/70", icon: "bg-emerald-100 text-emerald-500" },
  violet: { card: "border-violet-100 bg-violet-50/70", icon: "bg-violet-100 text-violet-500" },
  rose: { card: "border-rose-100 bg-rose-50/70", icon: "bg-rose-100 text-rose-500" },
  amber: { card: "border-amber-100 bg-amber-50/70", icon: "bg-amber-100 text-amber-500" },
};

export function KpiWidget({
  label,
  value,
  sub,
  icon: Icon,
  tone = "rose",
  delta,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  tone?: string;
  delta?: string;
}) {
  const t = KPI_TONES[tone] ?? KPI_TONES.rose;
  return (
    <div className={cn("flex items-center gap-3.5 rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md", t.card)}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", t.icon)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
          {delta && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="h-3 w-3" />
              {delta}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

export function Donut({ value, size = 120, label, accent = "#f43f5e" }: { value: number; size?: number; label?: string; accent?: string }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-900">{value}%</span>
        {label && <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>}
      </div>
    </div>
  );
}

export function EmptyState({ message, hint, action }: { message: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
      <p>{message}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * Approval Passport — a compact visual of an item's approval journey.
 * Shows who must approve and which "stamps" have been collected. Read-only.
 */
export function ApprovalPassport({
  requiredApprover,
  approvals,
  status,
}: {
  requiredApprover: "rose" | "carmen" | "both" | "none";
  approvals?: { rose?: boolean; carmen?: boolean };
  status: string;
}) {
  if (requiredApprover === "none") return null;
  const needsRose = requiredApprover === "rose" || requiredApprover === "both";
  const needsCarmen = requiredApprover === "carmen" || requiredApprover === "both";
  const finalized = status !== "pending";
  const stamp = (label: string, needed: boolean, given: boolean) => {
    if (!needed) return null;
    const done = given || (finalized && status === "approved");
    return (
      <span
        key={label}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
          done ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-dashed border-slate-300 bg-white text-slate-400",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", done ? "bg-emerald-500" : "bg-slate-300")} />
        {label} {done ? "✓" : "…"}
      </span>
    );
  };
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-50 px-2 py-1.5 ring-1 ring-slate-100">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Passport</span>
      {stamp("Rose", needsRose, Boolean(approvals?.rose))}
      {stamp("Carmen", needsCarmen, Boolean(approvals?.carmen))}
      {status === "rejected" && <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase text-rose-500">Rejected</span>}
      {status === "needs-revision" && <span className="rounded-lg bg-sky-50 px-2 py-1 text-[10px] font-bold uppercase text-sky-500">Revision</span>}
    </div>
  );
}

export function LockedState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="max-w-md rounded-3xl border border-rose-100 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
          <Lock className="h-3 w-3" /> Permission required
        </p>
      </div>
    </div>
  );
}
