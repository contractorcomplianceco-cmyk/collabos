import React, { useState } from "react";
import { Link } from "wouter";
import {
  Search, ExternalLink, Flag, ClipboardCheck, BookOpen, ArrowRight,
} from "lucide-react";
import { PageHeader, SectionCard } from "@/components/shared";
import { canSubmit } from "@/lib/helpers";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";

const CC_COMPANY_BRAIN_URL = "https://command.cagteam.net/company-brain";

export default function SolutionFinder() {
  const { currentRole, addRecommendation } = useAppState();
  const { toast } = useToast();
  const [gapNote, setGapNote] = useState("");
  const [gapSent, setGapSent] = useState(false);

  const flagKnowledgeGap = () => {
    const note = gapNote.trim();
    if (!canSubmit(currentRole) || !note) return;
    addRecommendation({
      source: "Company Brain",
      category: "company-record",
      recommendation: `Knowledge gap proposal: "${note}". Recommend documenting this in Command Center Company Brain and assigning an owner.`,
      classification: "ai-recommendation",
      risk: "low",
      requiredApprover: "carmen",
    });
    setGapSent(true);
    toast({
      title: "Gap sent to Review Queue",
      description: "This is a proposal only — approved knowledge stays in Command Center.",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Company Brain"
        subtitle="Approved how-we-work records live in Command Center. CollabOS proposes gaps for review — it does not hold the official library."
        icon={Search}
        accent="violet"
      />

      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4 text-sm text-violet-900">
        <p className="font-semibold">Official Company Brain is in Command Center</p>
        <p className="mt-1.5 text-xs leading-relaxed text-violet-800">
          CollabOS does not duplicate approved knowledge here. Use Command Center for the source of truth;
          use Review Queue below when something is missing and needs a documented answer.
        </p>
        <a
          href={CC_COMPANY_BRAIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Open Company Brain in Command Center
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Propose a knowledge gap" icon={Flag} accent="rose">
          <p className="mb-3 text-xs text-slate-500">
            Spot something undocumented? Send a short note to Review Queue. Nothing writes to approved records automatically.
          </p>
          {canSubmit(currentRole) ? (
            gapSent ? (
              <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
                Sent to Review Queue — Stamp the decision there when you are ready. Approved copy belongs in Command Center.
              </p>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={gapNote}
                  onChange={(e) => setGapNote(e.target.value)}
                  placeholder="What’s missing? e.g. Who owns client document intake?"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
                <button
                  onClick={flagKnowledgeGap}
                  disabled={!gapNote.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-40"
                >
                  <Flag className="h-3.5 w-3.5" /> Send to Review Queue
                </button>
              </div>
            )
          ) : (
            <p className="text-xs text-slate-500">Your role can view — ask Rose or Carmen to propose a gap.</p>
          )}
        </SectionCard>

        <SectionCard title="How this fits" icon={BookOpen} accent="slate">
          <ul className="space-y-2.5 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
              <span><span className="font-semibold">Command Center</span> — approved Company Brain records</span>
            </li>
            <li className="flex items-start gap-2">
              <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span><span className="font-semibold">Review Queue</span> — stamp proposals and decisions</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span><span className="font-semibold">CollabOS</span> — proposes gaps; does not replace the official library</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Link href="/review-queue" className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100">
              Open Review Queue
            </Link>
            <Link href="/prompt-library" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              Prompt Library
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
