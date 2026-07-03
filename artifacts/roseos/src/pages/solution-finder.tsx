import React, { useMemo, useState } from "react";
import {
  Search, FileText, FolderKanban, UserCheck, ArrowRight, ShieldAlert, Sparkles,
  Library, History, Flag, HelpCircle, BookOpen,
} from "lucide-react";
import { PageHeader, SectionCard, ClassificationBadge, EmptyState } from "@/components/shared";
import { companyRecords, projects } from "@/data/seed";
import { findSolution, canSubmit, type SolutionResult } from "@/lib/helpers";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";
import type { Classification } from "@/types";

const EXAMPLES = [
  "How do we handle client onboarding?",
  "Who owns the CRM data model?",
  "I'm stuck on document collection",
  "What's our qualifier scoring approach?",
];

const CLASS_FILTERS: { value: Classification | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "documented-fact", label: "Documented facts" },
  { value: "user-update", label: "User updates" },
  { value: "ai-recommendation", label: "AI recommendations" },
];

export default function SolutionFinder() {
  const { currentRole, addRecommendation } = useAppState();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SolutionResult | null>(null);
  const [lastRunQuery, setLastRunQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [gapFlagged, setGapFlagged] = useState<string | null>(null);

  const [browseQuery, setBrowseQuery] = useState("");
  const [browseClass, setBrowseClass] = useState<Classification | "all">("all");

  const run = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setResult(findSolution(trimmed, companyRecords, projects));
    setLastRunQuery(trimmed);
    setGapFlagged(null);
    setRecent((r) => [trimmed, ...r.filter((x) => x !== trimmed)].slice(0, 5));
  };

  const followUps = useMemo(() => {
    if (!result?.found) return [];
    return result.sources
      .slice(0, 3)
      .map((s) => `How does "${s.title}" work?`)
      .filter((q) => q.toLowerCase() !== query.toLowerCase());
  }, [result, query]);

  const browseResults = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    return companyRecords.filter((r) => {
      if (browseClass !== "all" && r.classification !== browseClass) return false;
      if (!q) return true;
      return `${r.title} ${r.summary} ${r.type} ${r.keywords.join(" ")}`.toLowerCase().includes(q);
    });
  }, [browseQuery, browseClass]);

  const flagKnowledgeGap = () => {
    if (!canSubmit(currentRole) || !lastRunQuery) return;
    addRecommendation({
      source: "Solution Finder",
      category: "company-record",
      recommendation: `Knowledge gap: no documented answer for "${lastRunQuery}". Recommend documenting this in Company Brain and assigning an owner.`,
      classification: "ai-recommendation",
      risk: "low",
      requiredApprover: "carmen",
    });
    setGapFlagged(lastRunQuery);
    toast({ title: "Knowledge gap flagged", description: "Sent to the Review Queue as a pending recommendation — nothing is auto-approved." });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Solution Finder"
        subtitle="Ask a question — Rose OS searches Company Brain for documented answers."
        icon={Search}
        accent="violet"
      />

      <SectionCard title="Ask Rose OS" icon={Sparkles} accent="violet">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(query)}
            placeholder="I'm stuck on... / Who owns... / How do we..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            onClick={() => run(query)}
            disabled={!query.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
          >
            Find answer <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => run(e)} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-100">
              {e}
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400"><History className="h-3 w-3" /> Recent</span>
            {recent.map((r) => (
              <button key={r} onClick={() => run(r)} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-200">
                {r}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {result && (
        result.found ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <SectionCard title="Answer" icon={Sparkles} accent="violet">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <ClassificationBadge value="documented-fact" />
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">{result.confidence}% confidence</span>
                </div>
                <p className="text-sm text-slate-700">{result.answer}</p>
                {result.matchedTerms.length > 0 && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><HelpCircle className="h-3.5 w-3.5" /> Why this answer</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {result.matchedTerms.map((t) => (
                        <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">{t}</span>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">These terms from your question matched documented Company Brain records — keyword search, not generative AI.</p>
                  </div>
                )}
                <div className="mt-4 rounded-xl bg-violet-50/60 p-3 text-sm text-slate-700">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600"><ShieldAlert className="h-3.5 w-3.5" /> Escalation path</p>
                  <p className="mt-1">{result.escalation}</p>
                </div>
              </SectionCard>

              <SectionCard title="Next Steps" icon={ArrowRight} accent="violet">
                <ol className="space-y-2">
                  {result.nextSteps.map((s, i) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                {followUps.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Keep digging</p>
                    <div className="flex flex-wrap gap-2">
                      {followUps.map((f) => (
                        <button key={f} onClick={() => run(f)} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600 transition hover:bg-violet-100">
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Source Records" icon={FileText} accent="slate">
                <ul className="space-y-2">
                  {result.sources.map((s) => (
                    <li key={s.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800">{s.title}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{s.type}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{s.summary}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <ClassificationBadge value={s.classification} />
                        <span className="text-[10px] text-slate-400">{s.source}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Related Projects" icon={FolderKanban} accent="sky">
                {result.relatedProjects.length ? (
                  <ul className="space-y-1.5 text-sm text-slate-700">
                    {result.relatedProjects.map((p) => (
                      <li key={p} className="flex items-center gap-1.5"><FolderKanban className="h-3.5 w-3.5 text-sky-400" />{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">No directly linked projects.</p>
                )}
              </SectionCard>

              {result.owner && (
                <SectionCard title="Likely Owner" icon={UserCheck} accent="emerald">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-700"><UserCheck className="h-4 w-4 text-emerald-500" />{result.owner}</p>
                </SectionCard>
              )}
            </div>
          </div>
        ) : (
          <SectionCard title="No Documented Answer" icon={ShieldAlert} accent="rose">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
              <p className="text-sm font-medium text-rose-700">{result.answer}</p>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Suggested next steps</p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {result.nextSteps.map((s) => <li key={s} className="flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-slate-400" />{s}</li>)}
              </ul>
            </div>
            {canSubmit(currentRole) && (
              gapFlagged === lastRunQuery ? (
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                  Knowledge gap flagged — a pending recommendation is now in the Review Queue.
                </p>
              ) : (
                <button
                  onClick={flagKnowledgeGap}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
                >
                  <Flag className="h-3.5 w-3.5" /> Flag "{lastRunQuery}" as knowledge gap
                </button>
              )
            )}
          </SectionCard>
        )
      )}

      {!result && (
        <EmptyState
          message="Ask a question above to search the Company Brain."
          hint="Answers come only from documented records — if nothing is documented, Rose OS says so instead of guessing."
        />
      )}

      <SectionCard
        title="Browse Company Brain"
        icon={Library}
        accent="slate"
        action={<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">{browseResults.length} of {companyRecords.length} records</span>}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <BookOpen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={browseQuery}
              onChange={(e) => setBrowseQuery(e.target.value)}
              placeholder="Filter records by title, keyword, or type..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CLASS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setBrowseClass(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${browseClass === f.value ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {browseResults.length === 0 ? (
          <div className="mt-3">
            <EmptyState message="No records match this filter." hint="Try a broader keyword or switch the classification filter back to All." />
          </div>
        ) : (
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {browseResults.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{r.title}</p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{r.type}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.keywords.slice(0, 4).map((k) => (
                    <button key={k} onClick={() => run(k)} title={`Search "${k}"`} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-600 transition hover:bg-violet-100">
                      {k}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <ClassificationBadge value={r.classification} />
                  <span className="text-[10px] text-slate-400">{r.source}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
