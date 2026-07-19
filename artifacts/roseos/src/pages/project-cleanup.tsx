import React, { useMemo, useState } from "react";
import { ClipboardList, Filter, ShieldAlert, FileText, Copy, Check, AlertTriangle } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { updateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { canSubmit } from "@/lib/helpers";
import type { Project, Role } from "@/types";

// Label option sets (must match the server enums; "" = unset/blank).
const STAGES = ["", "Concept", "Prototype", "Build", "Internal", "Pilot", "Live", "Retiring", "Archive"];
const FINAL_INTENTIONS = ["", "Staff cockpit", "Internal system", "Client portal", "Product for sale", "Partner room", "Investor room", "Temporary bridge", "Archive"];
const CONFIDENCE = ["", "Exploratory", "Likely", "Confirmed", "Approved"];
const PRIORITIES = ["", "Critical now", "Important next", "Scheduled later", "Parked"];
const SOURCE_OF_TRUTH = ["", "SoT", "Connected node", "Mirror", "Twin", "Unknown"];
const AGREEMENT_STATUSES = ["", "None", "Internal notice only", "Draft needed", "Drafting", "Ready to wire", "Wired", "Counsel review"];

type GovKey = "stage" | "finalIntention" | "confidence" | "cleanupPriority" | "sourceOfTruth" | "agreementStatus";

const COLS: { key: GovKey; label: string; opts: string[] }[] = [
  { key: "stage", label: "Stage", opts: STAGES },
  { key: "finalIntention", label: "Final Intention", opts: FINAL_INTENTIONS },
  { key: "confidence", label: "Confidence", opts: CONFIDENCE },
  { key: "cleanupPriority", label: "Priority", opts: PRIORITIES },
  { key: "sourceOfTruth", label: "Source-of-Truth", opts: SOURCE_OF_TRUTH },
  { key: "agreementStatus", label: "Agreement Status", opts: AGREEMENT_STATUSES },
];

const CLIENT_FACING = new Set(["Client portal", "Product for sale", "Partner room", "Investor room"]);
const INTERNAL = new Set(["Staff cockpit", "Internal system"]);

const VIEWS = [
  { id: "all", label: "All projects" },
  { id: "client", label: "Client / Partner / Investor surfaces" },
  { id: "internal", label: "Internal OS & cockpits" },
  { id: "bridges", label: "Bridges / Archives / non-SoT" },
  { id: "untagged", label: "Untagged" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

const INTAKE_TEMPLATE = `PROJECT INTAKE BRIEF — {NAME}

1. SYSTEM INTENT
   What is this for, who is it for, and what role does it play in the CCA ecosystem?

2. STAGE & LIFECYCLE
   Where is it now (Concept / Prototype / Build / Internal / Pilot / Live / Retiring / Archive) and where is it going?

3. DIRECTION & CONFIDENCE
   Final Intention (cockpit / internal system / client portal / product / partner room / investor room / bridge / archive). How confident are we (Exploratory / Likely / Confirmed / Approved)?

4. PRIORITY
   Critical now / Important next / Scheduled later / Parked — and why.

5. AGREEMENTS & RISK
   Which user-agreement applies (Staff AUP, Docs Collect, Partner/Investor terms, Demo terms, Client Portal terms, ServiceConnect terms, DataVault terms, AI-use disclosure)? Agreement Status? Trade-secret logic and DO-NOT-CLAIM rules (e.g. internal-only, "no official score").

6. ECOSYSTEM PLACEMENT
   Is this a cockpit, a core system, a portal, a product, or a bridge/twin? What is its Source-of-Truth relationship (SoT / connected node / mirror / twin)?

7. COST & AI USAGE
   Where is AI reduced vs. a superpower here? Monitoring vs. event-driven? Expected cost profile.`;

const GUARDRAILS = [
  "Staff cockpits / person-OS portals are standalone internal nodes that connect to Command Center — they are NOT to be automatically merged into Command Center.",
  "AuditOS / exammanageros and similar trade-secret systems remain internal-only. No demo or product conversion without explicit approval.",
  "ServiceOS / ServiceConnect, facility demos, bid-intelligence, speak-capture-bid, video/voice connect, franchise / Gov-Connect and other external surfaces are products/demos and must be tagged as such.",
  "Twins, clean handoffs, -clean, -SHALLOW-STALE, -empty-github, deploy-backups must NOT be treated as Source-of-Truth unless explicitly marked.",
];

export default function ProjectCleanup() {
  const { projects, projectsLoading, currentRole } = useAppState();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const role = (user?.role ? mapRole(user.role) : currentRole) as Role;
  const editable = canSubmit(role);

  const [view, setView] = useState<ViewId>("all");
  const [waveFilter, setWaveFilter] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Only cleanup-campaign rows (imported repos + memo names).
  const cleanupProjects = useMemo(
    () => projects.filter((p) => p.source === "GitHub import" || p.source === "Cleanup memo"),
    [projects],
  );

  const filtered = useMemo(() => {
    let list = cleanupProjects;
    if (waveFilter) list = list.filter((p) => p.cleanupWave === waveFilter);
    if (search.trim()) list = list.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (view === "client") list = list.filter((p) => CLIENT_FACING.has(p.finalIntention ?? ""));
    else if (view === "internal") list = list.filter((p) => INTERNAL.has(p.finalIntention ?? ""));
    else if (view === "bridges") list = list.filter((p) => ["Temporary bridge", "Archive"].includes(p.finalIntention ?? "") || (p.sourceOfTruth !== "" && p.sourceOfTruth !== "SoT"));
    else if (view === "untagged") list = list.filter((p) => isUntagged(p));
    return [...list].sort((a, b) => (a.cleanupWave ?? 9) - (b.cleanupWave ?? 9) || a.name.localeCompare(b.name));
  }, [cleanupProjects, view, waveFilter, search]);

  const untaggedCount = cleanupProjects.filter(isUntagged).length;

  const setLabel = async (p: Project, key: GovKey, value: string) => {
    setSavingId(p.id);
    try {
      await updateProject(Number(p.id), { [key]: value });
      await queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    } catch {
      toast({ title: "Couldn't save label", description: "Please try again.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(INTAKE_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: "Intake template copied", description: "Paste it into any project's brief." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Project Cleanup"
        subtitle="Governance campaign: label every build-server project, separate surfaces, and wire user-agreements."
        icon={ClipboardList}
        accent="sky"
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects" value={cleanupProjects.length} />
        <Stat label="Untagged" value={untaggedCount} tone={untaggedCount ? "amber" : "emerald"} />
        <Stat label="Wave 1 (client/product)" value={cleanupProjects.filter((p) => p.cleanupWave === 1).length} />
        <Stat label="Do-not-claim flags" value={cleanupProjects.filter((p) => p.doNotClaim).length} tone="rose" />
      </div>

      {/* Filters / views */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${view === v.id ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {v.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {[0, 1, 2, 3].map((w) => (
          <button
            key={w}
            onClick={() => setWaveFilter(w)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${waveFilter === w ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {w === 0 ? "All waves" : `Wave ${w}`}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="ml-auto w-48 rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      {/* Table */}
      <SectionCard title={`Projects (${filtered.length})`} icon={ClipboardList} accent="sky">
        {projectsLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState message="No projects match this view." hint="Try a different view or wave filter." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Name</th>
                  <th className="px-1">Wave</th>
                  {COLS.map((c) => <th key={c.key} className="px-1">{c.label}</th>)}
                  <th className="px-1">Notes / Do-not-claim</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className={`border-b border-slate-100 align-top ${savingId === p.id ? "opacity-60" : ""}`}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                        {p.repoExists?.startsWith("memo-only") ? (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 font-semibold text-amber-700"><AlertTriangle className="h-2.5 w-2.5" /> no repo</span>
                        ) : p.repoExists === "live" ? (
                          <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-600">repo</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-1 py-0.5">memo</span>
                        )}
                      </div>
                    </td>
                    <td className="px-1"><span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-600">W{p.cleanupWave || "?"}</span></td>
                    {COLS.map((c) => (
                      <td key={c.key} className="px-1">
                        <select
                          value={(p[c.key] as string) ?? ""}
                          disabled={!editable}
                          onChange={(e) => void setLabel(p, c.key, e.target.value)}
                          className={`w-full rounded border px-1 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-300 disabled:opacity-60 ${(p[c.key] as string) ? "border-slate-200 bg-white text-slate-700" : "border-dashed border-slate-200 bg-slate-50 text-slate-400"}`}
                        >
                          {c.opts.map((o) => <option key={o} value={o}>{o || "— set —"}</option>)}
                        </select>
                      </td>
                    ))}
                    <td className="px-1 py-2 text-[10px] text-rose-600">
                      {p.doNotClaim ? <span className="inline-flex items-start gap-0.5"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" /> {p.doNotClaim}</span> : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Intake template */}
        <SectionCard title="Project Intake template" icon={FileText} accent="violet">
          <p className="mb-2 text-xs text-slate-500">Attach this 7-prompt brief to any project row. Copy and paste into a project's notes.</p>
          <button onClick={() => void copyTemplate()} className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-600">
            {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy intake template</>}
          </button>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600">{INTAKE_TEMPLATE.replace("{NAME}", "[project]")}</pre>
        </SectionCard>

        {/* Guardrails */}
        <SectionCard title="Cleanup guardrails" icon={ShieldAlert} accent="rose">
          <ul className="space-y-2 text-xs text-slate-600">
            {GUARDRAILS.map((g, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-rose-50/50 p-2">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function isUntagged(p: Project): boolean {
  return !p.stage && !p.finalIntention && !p.confidence && !p.cleanupPriority && !p.sourceOfTruth && !p.agreementStatus;
}

function mapRole(serverRole: string): string {
  switch (serverRole) {
    case "rose_admin": return "Rose";
    case "carmen_admin": return "Carmen";
    case "super_admin": return "Admin";
    case "leadership_reviewer": return "Department Lead";
    case "contributor": return "Team Member";
    default: return "Viewer";
  }
}

function Stat({ label, value, tone = "sky" }: { label: string; value: number; tone?: "sky" | "amber" | "emerald" | "rose" }) {
  const tones = { sky: "text-sky-600", amber: "text-amber-600", emerald: "text-emerald-600", rose: "text-rose-600" };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className={`text-2xl font-bold ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] text-slate-500">{label}</div>
    </div>
  );
}
