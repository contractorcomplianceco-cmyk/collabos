import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import { Lightbulb, Plus, Layers, TrendingUp, ArrowRight, Sparkles, Copy, PenTool, Wand2, X } from "lucide-react";
import { PageHeader, SectionCard, StatusChip, ApprovalRouteBadge } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { canSubmit, detectDuplicates, expandIdeaConcept, type IdeaExpansionKind } from "@/lib/helpers";
import { projects } from "@/data/seed";
import { useToast } from "@/hooks/use-toast";
import type { IdeaStatus } from "@/types";

const EXPANSION_KINDS: { kind: IdeaExpansionKind; label: string }[] = [
  { kind: "product", label: "Product" },
  { kind: "workflow", label: "Workflow" },
  { kind: "automation", label: "Automation" },
  { kind: "mockup", label: "Mockup" },
  { kind: "sales", label: "Sales concept" },
];

const STATUS_TONE: Record<string, "amber" | "sky" | "violet" | "rose" | "emerald" | "slate"> = {
  "draft-idea": "amber", "related-to-existing": "sky", "needs-research": "violet",
  "needs-carmen-review": "sky", "needs-rose-review": "rose", "approved-for-build": "emerald", parked: "slate",
};

const NEXT_STATUS: Record<IdeaStatus, IdeaStatus> = {
  "draft-idea": "needs-research",
  "needs-research": "needs-carmen-review",
  "needs-carmen-review": "needs-rose-review",
  "needs-rose-review": "approved-for-build",
  "approved-for-build": "approved-for-build",
  "related-to-existing": "needs-research",
  parked: "needs-research",
};

export default function InnovationLab() {
  const { ideas, submitIdea, updateIdeaStatus, currentRole } = useAppState();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expansion, setExpansion] = useState<{ ideaId: string; kind: IdeaExpansionKind } | null>(null);

  const clusters = useMemo(() => {
    const map: Record<string, typeof ideas> = {};
    ideas.forEach((i) => {
      const key = i.cluster ?? "Unclustered";
      (map[key] ||= []).push(i);
    });
    return map;
  }, [ideas]);

  const overlap = useMemo(() => {
    if (!title.trim()) return [];
    return detectDuplicates(
      `${title} ${description}`,
      projects.map((p) => ({ id: p.id, name: p.name, description: p.description })),
      25,
    );
  }, [title, description]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Innovation Lab"
        subtitle="Capture ideas, cluster them, and grow them into bigger opportunities."
        icon={Lightbulb}
        accent="amber"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Submit an Idea" icon={Plus} accent="amber" className="lg:col-span-1">
          {canSubmit(currentRole) ? (
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Idea name" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it and why does it matter?" className="h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
              {overlap.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                  <span className="font-semibold">Heads up:</span> this may relate to {overlap.slice(0, 2).map((o) => o.candidate.name).join(", ")}.
                </div>
              )}
              <button
                onClick={() => {
                  if (!title.trim()) return;
                  submitIdea({
                    title, description, submittedBy: currentRole,
                    status: overlap.length ? "related-to-existing" : "draft-idea",
                    momentum: 50, cluster: null, benefits: [], risks: [], dependencies: [],
                    approvalRoute: "carmen",
                  });
                  setTitle(""); setDescription("");
                  toast({ title: "Idea submitted", description: "Added to the innovation pipeline as a draft." });
                }}
                disabled={!title.trim()}
                className="w-full rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-40"
              >
                Submit idea
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Viewers cannot submit ideas.</p>
          )}

          <div className="mt-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600"><Sparkles className="h-3.5 w-3.5" /> Rose OS suggestion</p>
            <p className="mt-1 text-xs text-slate-600">Three platform ideas cluster into a stronger "Collab OS vNext" — consider sequencing them as one program.</p>
          </div>
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Idea Clusters" icon={Layers} accent="amber">
            <div className="space-y-4">
              {Object.entries(clusters).map(([cluster, items]) => (
                <div key={cluster}>
                  <div className="mb-2 flex items-center gap-2">
                    <StatusChip label={cluster} tone="violet" />
                    <span className="text-xs text-slate-400">{items.length} idea(s)</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((i) => (
                      <div key={i.id} className="rounded-xl border border-slate-100 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{i.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{i.description}</p>
                          </div>
                          <StatusChip label={i.status} tone={STATUS_TONE[i.status]} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-xs text-amber-600"><TrendingUp className="h-3 w-3" />{i.momentum}</span>
                            <ApprovalRouteBadge value={i.approvalRoute} />
                          </div>
                          {i.status !== "approved-for-build" && canSubmit(currentRole) && (
                            <button
                              onClick={() => {
                                updateIdeaStatus(i.id, NEXT_STATUS[i.status]);
                                toast({ title: "Idea advanced", description: `Moved to ${NEXT_STATUS[i.status].replace(/-/g, " ")}.` });
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
                            >
                              Advance <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><Wand2 className="h-3 w-3" /> Grow into</span>
                          {EXPANSION_KINDS.map((k) => {
                            const active = expansion?.ideaId === i.id && expansion.kind === k.kind;
                            return (
                              <button
                                key={k.kind}
                                onClick={() => setExpansion(active ? null : { ideaId: i.id, kind: k.kind })}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${active ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-600 hover:bg-amber-100"}`}
                              >
                                {k.label}
                              </button>
                            );
                          })}
                        </div>
                        {expansion?.ideaId === i.id && (() => {
                          const c = expandIdeaConcept(i.title, i.description, expansion.kind);
                          return (
                            <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-bold text-slate-800">{c.headline}</p>
                                <button onClick={() => setExpansion(null)} className="rounded p-0.5 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">{c.angle}</p>
                              <ol className="mt-2 space-y-0.5">
                                {c.nextSteps.map((s, idx) => <li key={s} className="text-[11px] text-slate-600">{idx + 1}. {s}</li>)}
                              </ol>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <button
                                  onClick={() => { void navigator.clipboard?.writeText(c.buildPrompt); toast({ title: "Concept draft copied" }); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                                >
                                  <Copy className="h-3 w-3" /> Copy concept draft
                                </button>
                                {expansion.kind === "mockup" && (
                                  <Link href="/mockup-studio" className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-600">
                                    <PenTool className="h-3 w-3" /> Open Mockup Studio
                                  </Link>
                                )}
                              </div>
                              <p className="mt-1.5 text-[10px] text-slate-400">Rule-based draft — routed through the Review Queue, never auto-approved.</p>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
