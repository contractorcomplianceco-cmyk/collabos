import React, { useMemo, useState } from "react";
import {
  Brain, Lock, ShieldCheck, Languages, Grid3x3, MessageCircleQuestion,
  Combine, BadgeCheck, Timer, Activity, ArrowRightLeft, Send, History,
  Sparkles, AlertTriangle, Radio, TrendingUp, Target, FileText,
} from "lucide-react";
import { SectionCard, StatusChip, RiskBadge, Donut, LockedState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { canAccessMindMeld } from "@/lib/helpers";
import { mindFeed } from "@/data/seed";
import { useToast } from "@/hooks/use-toast";
import type { MindMeldItem, ThoughtLayer } from "@/types";

const LAYERS: ThoughtLayer[] = ["Vision", "Strategy", "Execution", "Experience", "Impact"];
const LAYER_TONE: Record<ThoughtLayer, string> = {
  Vision: "bg-rose-100 text-rose-700", Strategy: "bg-sky-100 text-sky-700",
  Execution: "bg-violet-100 text-violet-700", Experience: "bg-amber-100 text-amber-700",
  Impact: "bg-emerald-100 text-emerald-700",
};

const FUNCTIONS = [
  { key: "translation", name: "Translation Lens", icon: Languages, desc: "Translate vision into systems language (and back)." },
  { key: "heatmap", name: "Decision Heatmap", icon: Grid3x3, desc: "See where alignment is hot or cold." },
  { key: "question", name: "Question Composer", icon: MessageCircleQuestion, desc: "Generate the sharpest open questions." },
  { key: "merge", name: "Merge Magic", icon: Combine, desc: "Synthesize both views into one direction." },
  { key: "passport", name: "Readiness Passport", icon: BadgeCheck, desc: "Check if an item is ready to advance." },
  { key: "timesaver", name: "Time-Saver Brief", icon: Timer, desc: "One-paragraph catch-up brief." },
  { key: "forecast", name: "Alignment Forecast", icon: TrendingUp, desc: "Project the path from here to full alignment." },
  { key: "tension", name: "Tension Finder", icon: Target, desc: "Pinpoint the core tension to resolve." },
  { key: "risk", name: "Risk Radar", icon: AlertTriangle, desc: "Surface what could go wrong if we advance now." },
  { key: "draft", name: "Decision Draft", icon: FileText, desc: "Draft a private decision note for sign-off." },
];

export default function MindMeldRoom() {
  const { currentRole, mindMeldItems, handoffs, carmenfy, rosify, addMindMeldThought } = useAppState();
  const { toast } = useToast();
  const [view, setView] = useState("room");
  const [selectedId, setSelectedId] = useState(mindMeldItems[0]?.id ?? "");
  const [activeFn, setActiveFn] = useState<string | null>(null);
  const [roseDraft, setRoseDraft] = useState("");
  const [carmenDraft, setCarmenDraft] = useState("");
  const [handoffNote, setHandoffNote] = useState("");

  const selected = useMemo(
    () => mindMeldItems.find((m) => m.id === selectedId) ?? mindMeldItems[0],
    [mindMeldItems, selectedId],
  );

  if (!canAccessMindMeld(currentRole)) {
    return (
      <LockedState
        title="Private space for Rose & Carmen only"
        message="The Mind Meld Room is an end-to-end private alignment space. Switch to the Rose or Carmen role to enter."
      />
    );
  }

  const VIEWS = [
    { key: "room", label: "Mind Meld Room" },
    { key: "rose", label: "Rose View" },
    { key: "carmen", label: "Carmen View" },
    { key: "board", label: "Shared Mind Board" },
    { key: "handoff", label: "Handoff History" },
    { key: "notes", label: "Private Notes" },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Private header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-600 to-fuchsia-500 p-7 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Brain className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mind Meld Room</h1>
              <p className="text-sm text-white/85">Private space for Rose &amp; Carmen only</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"><Lock className="h-3 w-3" /> End-to-end private</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"><ShieldCheck className="h-3 w-3" /> No official decisions auto-created</span>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)} className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${view === v.key ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            {v.label}
          </button>
        ))}
      </div>

      {view === "handoff" ? (
        <SectionCard title="Handoff History" icon={History} accent="violet">
          <ul className="space-y-3">
            {handoffs.map((h) => (
              <li key={h.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><ArrowRightLeft className="h-4 w-4" /></div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{h.itemTitle}</p>
                  <p className="text-xs text-slate-500">{h.from} → {h.to} · <span className="font-medium">{h.layer}</span> layer · {h.timestamp}</p>
                  <p className="mt-1 text-xs text-slate-600">{h.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : view === "notes" ? (
        <SectionCard title="Private Decision Notes" icon={Lock} accent="rose">
          <div className="space-y-3">
            {mindMeldItems.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">{m.title}</span>
                  {m.sensitive && <StatusChip label="sensitive" tone="rose" />}
                </div>
                <p className="mt-2 text-sm text-slate-600">{m.synthesis}</p>
                <p className="mt-2 text-xs text-slate-400">Outcome: {m.finalOutcome ?? "Not yet decided — remains private until ready."}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mindMeldItems.map((m) => (
            <button key={m.id} onClick={() => { setSelectedId(m.id); setView("room"); }} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <StatusChip label={m.owner} tone={m.owner === "Rose" ? "rose" : "sky"} />
                <RiskBadge value={m.risk} />
              </div>
              <h3 className="mt-2 text-sm font-bold text-slate-800">{m.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{m.source}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" style={{ width: `${m.alignmentScore}%` }} /></div>
                <span className="text-xs font-bold text-violet-600">{m.alignmentScore}%</span>
              </div>
              <div className="mt-2"><StatusChip label={m.alignment} tone="violet" /></div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left & center */}
          <div className="space-y-6 lg:col-span-2">
            {/* Item selector */}
            <div className="flex flex-wrap gap-2">
              {mindMeldItems.map((m) => (
                <button key={m.id} onClick={() => setSelectedId(m.id)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${selectedId === m.id ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                  {m.title}
                </button>
              ))}
            </div>

            {selected && (
              <>
                {/* Two-column Rose / Carmen */}
                {(view === "room" || view === "rose") && (
                  <div className={`grid grid-cols-1 gap-4 ${view === "room" ? "md:grid-cols-2" : ""}`}>
                    {(
                      <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
                        <div className="mb-3 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-xs font-bold text-white">RA</div><div><p className="text-sm font-bold text-slate-800">Rose View</p><p className="text-[11px] text-slate-500">Founder · vision &amp; direction</p></div></div>
                        <p className="text-sm text-slate-700">{selected.roseThoughts}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">{selected.focusAreas.map((f) => <StatusChip key={f} label={f} tone="rose" />)}</div>
                        {currentRole === "Rose" && (
                          <div className="mt-3">
                            <textarea value={roseDraft} onChange={(e) => setRoseDraft(e.target.value)} placeholder="Add or refine your thought..." className="h-16 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-200" />
                            <button onClick={() => { if (!roseDraft.trim()) return; addMindMeldThought(selected.id, "Rose", roseDraft); setRoseDraft(""); toast({ title: "Thought added to Rose View" }); }} className="mt-2 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600">Save thought</button>
                          </div>
                        )}
                      </div>
                    )}
                    {view === "room" && (
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
                        <div className="mb-3 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-xs font-bold text-white">CV</div><div><p className="text-sm font-bold text-slate-800">Carmen View</p><p className="text-[11px] text-slate-500">Systems · execution &amp; precision</p></div></div>
                        <p className="text-sm text-slate-700">{selected.carmenThoughts}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">{selected.layers.map((l) => <span key={l} className={`rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_TONE[l]}`}>{l}</span>)}</div>
                        {currentRole === "Carmen" && (
                          <div className="mt-3">
                            <textarea value={carmenDraft} onChange={(e) => setCarmenDraft(e.target.value)} placeholder="Add or refine your perspective..." className="h-16 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-200" />
                            <button onClick={() => { if (!carmenDraft.trim()) return; addMindMeldThought(selected.id, "Carmen", carmenDraft); setCarmenDraft(""); toast({ title: "Perspective added to Carmen View" }); }} className="mt-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600">Save perspective</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {view === "carmen" && (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
                    <div className="mb-3 flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-xs font-bold text-white">CV</div><div><p className="text-sm font-bold text-slate-800">Carmen View</p><p className="text-[11px] text-slate-500">Systems · execution &amp; precision</p></div></div>
                    <p className="text-sm text-slate-700">{selected.carmenThoughts}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">{selected.layers.map((l) => <span key={l} className={`rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_TONE[l]}`}>{l}</span>)}</div>
                  </div>
                )}

                {/* Rose OS synthesis */}
                <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600"><Sparkles className="h-3.5 w-3.5" /> Rose OS Synthesis</p>
                  <p className="mt-2 text-sm text-slate-700">{selected.synthesis}</p>
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Open questions</p>
                    <ul className="mt-1 space-y-1">{selected.openQuestions.map((q) => <li key={q} className="flex items-start gap-1.5 text-sm text-slate-700"><MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />{q}</li>)}</ul>
                  </div>
                </div>

                {/* Handoff actions */}
                <SectionCard title="Handoff" icon={ArrowRightLeft} accent="violet">
                  <input value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} placeholder="Optional handoff note..." className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { carmenfy(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Ready to Carmenfy", description: "Routed to Carmen for systems review. No official decision created." }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"><Send className="h-4 w-4" /> Ready to Carmenfy</button>
                    <button onClick={() => { rosify(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Ready to Rosify", description: "Routed to Rose for direction review. No official decision created." }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"><Send className="h-4 w-4" /> Ready to Rosify</button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Handoffs create a private item for the other person. They never auto-create official company decisions.</p>
                </SectionCard>

                {/* Innovative functions */}
                <SectionCard title="Innovative Functions" icon={Brain} accent="violet">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {FUNCTIONS.map((f) => {
                      const Icon = f.icon;
                      return (
                        <button key={f.key} onClick={() => setActiveFn(activeFn === f.key ? null : f.key)} className={`rounded-xl border p-3 text-left transition ${activeFn === f.key ? "border-violet-300 bg-violet-50" : "border-slate-100 hover:border-violet-200 hover:bg-slate-50"}`}>
                          <Icon className="h-5 w-5 text-violet-500" />
                          <p className="mt-2 text-xs font-semibold text-slate-800">{f.name}</p>
                        </button>
                      );
                    })}
                  </div>
                  {activeFn && <FunctionOutput fnKey={activeFn} item={selected} />}
                </SectionCard>
              </>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            {selected && (
              <SectionCard title="Alignment Meter" icon={Activity} accent="violet">
                <div className="flex flex-col items-center">
                  <Donut value={selected.alignmentScore} label={selected.alignment} accent="#a855f7" />
                  <div className="mt-3 flex items-center gap-2"><StatusChip label={selected.alignment} tone="violet" /><RiskBadge value={selected.risk} /></div>
                </div>
              </SectionCard>
            )}

            {/* Decision heatmap */}
            <SectionCard title="Decision Heatmap" icon={Grid3x3} accent="rose">
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 30 }).map((_, i) => {
                  const intensity = (Math.sin(i * 1.7) + 1) / 2;
                  const bg = intensity > 0.66 ? "bg-rose-400" : intensity > 0.33 ? "bg-amber-300" : "bg-emerald-200";
                  return <div key={i} className={`h-6 rounded-md ${bg}`} style={{ opacity: 0.5 + intensity * 0.5 }} />;
                })}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400"><span>Aligned</span><span>Needs clarity</span></div>
            </SectionCard>

            {/* Thought layers */}
            <SectionCard title="Thought Layers" icon={Radio} accent="sky">
              <div className="flex flex-wrap gap-1.5">{LAYERS.map((l) => <span key={l} className={`rounded-full px-2.5 py-1 text-xs font-medium ${LAYER_TONE[l]}`}>{l}</span>)}</div>
            </SectionCard>

            {/* Live mind feed */}
            <SectionCard title="Live Mind Feed" icon={Radio} accent="emerald">
              <ul className="space-y-2.5">
                {mindFeed.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                    <span className="text-slate-700"><span className="font-semibold">{e.actor}</span> {e.action}</span>
                    <span className="ml-auto text-slate-300">{e.timestamp}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            {/* Private room status */}
            <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600"><Lock className="h-3.5 w-3.5" /> Private Room Status</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Rose &amp; Carmen present</li>
                <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> End-to-end private</li>
                <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {mindMeldItems.length} active threads</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FunctionOutput({ fnKey, item }: { fnKey: string; item: MindMeldItem }) {
  let title = "";
  let body: React.ReactNode = null;
  switch (fnKey) {
    case "translation":
      title = "Translation Lens";
      body = (
        <div className="space-y-2 text-sm text-slate-700">
          <p><span className="font-semibold text-rose-600">Vision →</span> {item.roseThoughts}</p>
          <p><span className="font-semibold text-sky-600">Systems →</span> {item.carmenThoughts}</p>
        </div>
      );
      break;
    case "heatmap":
      title = "Decision Heatmap reading";
      body = <p className="text-sm text-slate-700">Alignment is {item.alignmentScore}% ({item.alignment}). {item.alignment === "strong" ? "Hot alignment — safe to advance." : item.alignment === "partial" ? "Warm — close one or two open questions first." : "Cold spots remain — clarify before deciding."}</p>;
      break;
    case "question":
      title = "Question Composer";
      body = <ul className="space-y-1 text-sm text-slate-700">{item.openQuestions.map((q) => <li key={q} className="flex items-start gap-1.5"><MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 text-violet-400" />{q}</li>)}</ul>;
      break;
    case "merge":
      title = "Merge Magic";
      body = <p className="text-sm text-slate-700">{item.synthesis}</p>;
      break;
    case "passport": {
      title = "Readiness Passport";
      const ready = item.alignmentScore >= 70 && item.openQuestions.length <= 1;
      body = (
        <div className="flex items-center gap-2 text-sm">
          {ready ? <BadgeCheck className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
          <span className="text-slate-700">{ready ? "Ready to advance to a formal decision route." : `Not yet ready — alignment ${item.alignmentScore}%, ${item.openQuestions.length} open question(s).`}</span>
        </div>
      );
      break;
    }
    case "timesaver":
      title = "Time-Saver Brief";
      body = <p className="text-sm text-slate-700">{item.title}: Rose wants {item.roseThoughts.toLowerCase()} Carmen will {item.carmenThoughts.toLowerCase()} Current alignment {item.alignmentScore}% ({item.alignment}); next handoff to {item.nextHandoff ?? "—"}.</p>;
      break;
    case "forecast": {
      title = "Alignment Forecast";
      const gap = 100 - item.alignmentScore;
      const steps = item.openQuestions.length;
      body = (
        <div className="space-y-1.5 text-sm text-slate-700">
          <p className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-500" /> {gap <= 10 ? "On track — alignment is nearly complete." : gap <= 30 ? `Closing ${gap} points; ${steps} open question(s) stand between you and full alignment.` : `Wide ${gap}-point gap — expect 2-3 sync passes to converge.`}</p>
          <p className="text-xs text-slate-500">Projected to reach 90%+ once {steps === 0 ? "the synthesis is signed off" : `${steps} open question(s) are resolved`}.</p>
        </div>
      );
      break;
    }
    case "tension": {
      title = "Tension Finder";
      body = (
        <div className="space-y-1.5 text-sm text-slate-700">
          <p className="flex items-start gap-1.5"><Target className="mt-0.5 h-4 w-4 text-rose-500" /> Core tension: <span className="font-medium">vision pace vs. systems readiness.</span></p>
          <p className="text-xs text-slate-500">Rose pushes for impact and speed; Carmen protects repeatability and precision. Resolve by agreeing the smallest scope that satisfies both.</p>
        </div>
      );
      break;
    }
    case "risk": {
      title = "Risk Radar";
      const risky = item.alignmentScore < 70 || item.openQuestions.length > 1;
      body = (
        <div className="flex items-start gap-2 text-sm text-slate-700">
          <AlertTriangle className={`mt-0.5 h-5 w-5 ${risky ? "text-amber-500" : "text-emerald-500"}`} />
          <span>{risky ? `Advancing now risks rework: alignment ${item.alignmentScore}% with ${item.openQuestions.length} unresolved question(s). Lock these before any company-record decision.` : "Low risk to advance — alignment is strong and open questions are minimal."}</span>
        </div>
      );
      break;
    }
    case "draft": {
      title = "Decision Draft (private)";
      body = (
        <div className="space-y-1.5 text-sm text-slate-700">
          <p><span className="font-semibold">Proposed decision:</span> {item.synthesis}</p>
          <p className="text-xs text-slate-500">Status: private draft — not a company decision until routed through Review Queue and signed off by {item.alignmentScore >= 70 ? "Rose + Carmen" : "both, after questions close"}.</p>
        </div>
      );
      break;
    }
  }
  return (
    <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-600">{title}</p>
      {body}
    </div>
  );
}
