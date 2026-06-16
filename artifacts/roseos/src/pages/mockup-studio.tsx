import React, { useState } from "react";
import { PenTool, Wand2, FileCode, Send, Link2, LayoutGrid } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useToast } from "@/hooks/use-toast";

interface Concept {
  screenSummary: string;
  layoutDescription: string;
  keyUISections: string[];
  dataNeeded: string[];
  workflow: string[];
  risks: string[];
  buildPrompt: string;
}

function buildConcept(form: {
  ideaName: string; targetUser: string; purpose: string; features: string; brand: string; screenType: string; output: string;
}): Concept {
  const feats = form.features.split(",").map((f) => f.trim()).filter(Boolean);
  return {
    screenSummary: `${form.ideaName || "New screen"} — a ${form.screenType || "dashboard"} for ${form.targetUser || "internal users"} to ${form.purpose || "accomplish a key task"} inside ${form.brand || "Rose OS"}.`,
    layoutDescription: `A clean ${form.brand || "Rose OS"}-styled ${form.screenType || "dashboard"}: left navigation, a top context bar, a primary content area with KPI widgets, and a focused detail panel. White surfaces, rose/coral accents, electric-blue highlights.`,
    keyUISections: [
      "Header with title, context, and primary action",
      ...feats.slice(0, 4).map((f) => `${f} module`),
      "Insight / recommendation panel",
    ].filter(Boolean),
    dataNeeded: [
      `${form.targetUser || "User"} profile & role`,
      ...(feats.length ? feats.map((f) => `${f} records`) : ["Primary entity records"]),
      "Status & approval metadata",
    ],
    workflow: [
      `${form.targetUser || "User"} opens the ${form.screenType || "screen"}`,
      "Reviews KPI widgets and prioritized items",
      "Drills into a detail item",
      "Takes an action that routes for approval where needed",
    ],
    risks: [
      "Scope creep beyond must-have features",
      feats.length > 5 ? "Too many modules on one screen — consider phasing" : "Confirm data availability before build",
      "Ensure permission gating for sensitive items",
    ],
    buildPrompt: `Build a ${form.brand || "Rose OS"} ${form.screenType || "dashboard"} called "${form.ideaName || "New Screen"}" for ${form.targetUser || "internal users"}. Purpose: ${form.purpose || "n/a"}. Must-have features: ${form.features || "n/a"}. Use a clean white layout with rose/coral accents and electric-blue highlights, lucide-react icons, KPI widgets, a prioritized list, and a detail panel. Include role-based permissions and route sensitive actions for approval. Desired output: ${form.output || "working screen"}.`,
  };
}

export default function MockupStudio() {
  const { toast } = useToast();
  const { addRecommendation } = useAppState();
  const [form, setForm] = useState({ ideaName: "", targetUser: "", purpose: "", features: "", brand: "Rose OS", screenType: "Dashboard", output: "Build prompt + layout brief" });
  const [concept, setConcept] = useState<Concept | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Mockup Studio" subtitle="Turn an idea into a structured screen brief and build prompt." icon={PenTool} accent="violet" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Concept Inputs" icon={LayoutGrid} accent="violet">
          <div className="space-y-3">
            <Field label="Idea name"><input value={form.ideaName} onChange={set("ideaName")} className="field-input" placeholder="Customer 360 Dashboard" /></Field>
            <Field label="Target user"><input value={form.targetUser} onChange={set("targetUser")} className="field-input" placeholder="Account managers" /></Field>
            <Field label="Purpose"><input value={form.purpose} onChange={set("purpose")} className="field-input" placeholder="See a unified client view" /></Field>
            <Field label="Must-have features (comma separated)"><input value={form.features} onChange={set("features")} className="field-input" placeholder="Timeline, documents, CRM stage, compliance status" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brand / system">
                <select value={form.brand} onChange={set("brand")} className="field-input"><option>Rose OS</option><option>Business Services Hub</option><option>QualifierConnect</option></select>
              </Field>
              <Field label="Screen type">
                <select value={form.screenType} onChange={set("screenType")} className="field-input"><option>Dashboard</option><option>Detail view</option><option>Workflow</option><option>Report</option></select>
              </Field>
            </div>
            <Field label="Desired output"><input value={form.output} onChange={set("output")} className="field-input" /></Field>
            <button
              onClick={() => { setConcept(buildConcept(form)); toast({ title: "Concept generated", description: "Review the brief and build prompt." }); }}
              disabled={!form.ideaName.trim()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-40"
            >
              <Wand2 className="h-4 w-4" /> Generate Concept
            </button>
          </div>
        </SectionCard>

        <div className="space-y-6">
          {!concept ? (
            <EmptyState message="Fill in the inputs and generate a concept to see the structured brief." />
          ) : (
            <>
              <SectionCard title="Generated Concept" icon={FileCode} accent="violet">
                <Block label="Screen summary"><p className="text-sm text-slate-700">{concept.screenSummary}</p></Block>
                <Block label="Layout description"><p className="text-sm text-slate-700">{concept.layoutDescription}</p></Block>
                <Block label="Key UI sections"><List items={concept.keyUISections} /></Block>
                <Block label="Data needed"><List items={concept.dataNeeded} /></Block>
                <Block label="User workflow"><List items={concept.workflow} ordered /></Block>
                <Block label="Risks"><List items={concept.risks} /></Block>
              </SectionCard>

              <SectionCard title="Next Build Prompt" icon={FileCode} accent="rose">
                <pre className="whitespace-pre-wrap rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{concept.buildPrompt}</pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { navigator.clipboard?.writeText(concept.buildPrompt); toast({ title: "Build prompt copied" }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200">
                    <FileCode className="h-4 w-4" /> Create Build Prompt
                  </button>
                  <button
                    onClick={() => { addRecommendation({ source: "Mockup Studio", category: "mockup-prompt", recommendation: `Build "${form.ideaName}" — ${concept.screenSummary}`, classification: "ai-recommendation", risk: "low", requiredApprover: "carmen" }); toast({ title: "Sent to Review Queue" }); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-600"
                  >
                    <Send className="h-4 w-4" /> Send to Review
                  </button>
                  <button onClick={() => toast({ title: "Linked to existing project", description: "Associated with the closest matching project." })} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                    <Link2 className="h-4 w-4" /> Link to Existing Project
                  </button>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {children}
    </div>
  );
}
function List({ items, ordered }: { items: string[]; ordered?: boolean }) {
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={it} className="flex items-start gap-2 text-sm text-slate-700">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400">{ordered ? "" : ""}</span>
          {ordered ? `${i + 1}. ${it}` : it}
        </li>
      ))}
    </ul>
  );
}
