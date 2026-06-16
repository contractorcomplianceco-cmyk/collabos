import React, { useState } from "react";
import { ClipboardCheck, Check, X, RefreshCw, History, Filter } from "lucide-react";
import { PageHeader, SectionCard, ClassificationBadge, RiskBadge, ApprovalRouteBadge, StatusChip, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { canApprove } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["all", "duplicate", "team-pulse", "automation", "market", "mind-meld-handoff", "final-decision", "mockup-prompt"];
const STATUS_TONE: Record<string, "amber" | "emerald" | "rose" | "sky"> = { pending: "amber", approved: "emerald", rejected: "rose", "needs-revision": "sky" };

export default function ReviewQueue() {
  const { recommendations, setRecommendationStatus, currentRole } = useAppState();
  const { toast } = useToast();
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = recommendations.filter((r) => category === "all" || r.category === category);

  const act = (id: string, status: "approved" | "rejected" | "needs-revision") => {
    setRecommendationStatus(id, status, currentRole);
    toast({ title: `Recommendation ${status.replace("-", " ")}`, description: "Audit history updated." });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Review Queue" subtitle="Central approval queue. AI recommendations are never auto-approved." icon={ClipboardCheck} accent="rose" />

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${category === c ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {c.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <EmptyState message="Nothing in this category." />}
        {filtered.map((r) => {
          const allowed = canApprove(currentRole, r.requiredApprover);
          return (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip label={r.source} tone="slate" />
                    <ClassificationBadge value={r.classification} />
                    <RiskBadge value={r.risk} />
                    <ApprovalRouteBadge value={r.requiredApprover} />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-800">{r.recommendation}</p>
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
                    <History className="h-3.5 w-3.5" /> {expanded === r.id ? "Hide" : "Show"} audit history
                  </button>
                  {expanded === r.id && (
                    <ul className="mt-2 space-y-1 border-l-2 border-slate-100 pl-3">
                      {r.history.map((h) => (
                        <li key={h.id} className="text-xs text-slate-500"><span className="font-medium text-slate-600">{h.actor}</span> — {h.action} <span className="text-slate-300">· {h.timestamp}</span></li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  {r.requiredApprover === "both" && r.status === "pending" && (r.approvals?.rose || r.approvals?.carmen) && (
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {r.approvals?.rose ? "Rose approved" : "Carmen approved"} · awaiting {r.approvals?.rose ? "Carmen" : "Rose"}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                  {r.status === "pending" ? (
                    allowed ? (
                      <>
                        <button onClick={() => act(r.id, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"><Check className="h-3.5 w-3.5" /> Approve</button>
                        <button onClick={() => act(r.id, "needs-revision")} className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-200"><RefreshCw className="h-3.5 w-3.5" /> Revise</button>
                        <button onClick={() => act(r.id, "rejected")} className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"><X className="h-3.5 w-3.5" /> Reject</button>
                      </>
                    ) : (
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">Requires {r.requiredApprover === "both" ? "Rose + Carmen" : r.requiredApprover}</span>
                    )
                  ) : (
                    <StatusChip label={r.status} tone={STATUS_TONE[r.status]} />
                  )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
