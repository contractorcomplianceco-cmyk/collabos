import React, { useMemo, useState } from "react";
import { Copy, Search, AlertTriangle, Users2, FileText, ArrowRight } from "lucide-react";
import { PageHeader, SectionCard, RiskBadge, ApprovalRouteBadge, EmptyState } from "@/components/shared";
import { duplicateRisks, projects, ideas as seedIdeas } from "@/data/seed";
import { detectDuplicates } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["all", "projects", "ideas", "build-items", "automations"];

export default function DuplicateRadar() {
  const { toast } = useToast();
  const [category, setCategory] = useState("all");
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);

  const filtered = useMemo(
    () => (category === "all" ? duplicateRisks : duplicateRisks.filter((d) => d.category === category)),
    [category],
  );

  const candidates = useMemo(
    () => [
      ...projects.map((p) => ({ id: p.id, name: p.name, description: p.description })),
      ...seedIdeas.map((i) => ({ id: i.id, name: i.title, description: i.description })),
    ],
    [],
  );

  const matches = useMemo(
    () => (checked && input.trim() ? detectDuplicates(input, candidates, 25) : []),
    [checked, input, candidates],
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Duplicate Radar"
        subtitle="Detect overlapping efforts before they become duplicated work."
        icon={Copy}
        accent="rose"
      />

      {/* New request checker */}
      <SectionCard title="New Request Checker" icon={Search} accent="rose">
        <p className="mb-3 text-sm text-slate-500">
          Describe a new idea or request. Rose OS checks for overlaps across projects and ideas before you create new work.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setChecked(false); }}
            placeholder="e.g. AI tool that drafts marketing content from our records"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button
            onClick={() => {
              setChecked(true);
              const found = detectDuplicates(input, candidates, 25);
              toast({
                title: found.length ? `${found.length} possible overlap(s) found` : "No overlaps found",
                description: found.length ? "Review before creating new work." : "This looks like net-new work.",
              });
            }}
            disabled={!input.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Check for overlaps <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {checked && (
          <div className="mt-4">
            {matches.length === 0 ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                No significant overlap detected. This appears to be net-new work — safe to create.
              </div>
            ) : (
              <div className="space-y-2">
                {matches.map((m) => (
                  <div key={m.candidate.id} className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <div>
                      <span className="text-sm font-semibold text-slate-800">{m.candidate.name}</span>
                      {m.sharedTerms.length > 0 && (
                        <p className="text-xs text-slate-500">Shared themes: {m.sharedTerms.slice(0, 5).join(", ")}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">{m.score}% match</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
              category === c ? "bg-rose-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Duplicate risk cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.length === 0 && <EmptyState message="No duplicate risks in this category." />}
        {filtered.map((d) => (
          <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">{d.title}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-600">{d.similarity}% similarity</span>
                  <RiskBadge value={d.risk} />
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400" style={{ width: `${d.similarity}%` }} />
            </div>

            <p className="mt-3 text-sm text-slate-600">{d.reason}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Overlapping items</p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {d.overlappingItems.map((o) => (
                    <li key={o} className="flex items-center gap-1"><Copy className="h-3 w-3 text-rose-400" />{o}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Source records</p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {d.sourceRecords.map((s) => (
                    <li key={s} className="flex items-center gap-1"><FileText className="h-3 w-3 text-slate-400" />{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
              <Users2 className="h-3.5 w-3.5" /> Affected: {d.affectedOwners.join(", ")}
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommendation</p>
              <p className="mt-1 text-sm text-slate-700">{d.recommendation}</p>
              <div className="mt-2">
                <ApprovalRouteBadge value={d.approvalRoute} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
