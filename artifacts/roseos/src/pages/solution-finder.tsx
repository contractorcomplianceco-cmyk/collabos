import React, { useState } from "react";
import { Search, FileText, FolderKanban, UserCheck, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { PageHeader, SectionCard, ClassificationBadge, EmptyState } from "@/components/shared";
import { companyRecords, projects } from "@/data/seed";
import { findSolution, type SolutionResult } from "@/lib/helpers";

const EXAMPLES = [
  "How do we handle client onboarding?",
  "Who owns the CRM data model?",
  "I'm stuck on document collection",
  "What's our qualifier scoring approach?",
];

export default function SolutionFinder() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SolutionResult | null>(null);

  const run = (q: string) => {
    setQuery(q);
    setResult(findSolution(q, companyRecords, projects));
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
            onKeyDown={(e) => e.key === "Enter" && query.trim() && run(query)}
            placeholder="I'm stuck on... / Who owns... / How do we..."
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            onClick={() => query.trim() && run(query)}
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
      </SectionCard>

      {result && (
        result.found ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <SectionCard title="Answer" icon={Sparkles} accent="violet">
                <div className="mb-3 flex items-center gap-2">
                  <ClassificationBadge value="documented-fact" />
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">{result.confidence}% confidence</span>
                </div>
                <p className="text-sm text-slate-700">{result.answer}</p>
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
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard title="Source Records" icon={FileText} accent="slate">
                <ul className="space-y-2">
                  {result.sources.map((s) => (
                    <li key={s.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">{s.title}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{s.summary}</p>
                      <div className="mt-2"><ClassificationBadge value={s.classification} /></div>
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
          </SectionCard>
        )
      )}

      {!result && <EmptyState message="Ask a question above to search the Company Brain." />}
    </div>
  );
}
