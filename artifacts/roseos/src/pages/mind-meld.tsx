import React, { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Brain, Lock, ShieldCheck, Languages, Grid3x3, MessageCircleQuestion,
  Combine, BadgeCheck, Timer, Activity, ArrowRightLeft, Send, History,
  Sparkles, AlertTriangle, Radio, TrendingUp, Target, FileText, Heart,
  ArrowRight, ArrowLeft, Lightbulb, ClipboardCheck, Users, Plus,
} from "lucide-react";
import { SectionCard, StatusChip, RiskBadge, Donut, LockedState } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { canAccessMindMeld } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";
import type { MindMeldItem, ThoughtLayer } from "@/types";

const STAT_TONE: Record<string, { card: string; icon: string; text: string }> = {
  rose: { card: "border-rose-100 bg-rose-50/70", icon: "bg-rose-100 text-rose-500", text: "text-rose-500" },
  emerald: { card: "border-emerald-100 bg-emerald-50/70", icon: "bg-emerald-100 text-emerald-500", text: "text-emerald-600" },
  violet: { card: "border-violet-100 bg-violet-50/70", icon: "bg-violet-100 text-violet-500", text: "text-violet-500" },
  amber: { card: "border-amber-100 bg-amber-50/70", icon: "bg-amber-100 text-amber-500", text: "text-amber-600" },
  sky: { card: "border-sky-100 bg-sky-50/70", icon: "bg-sky-100 text-sky-500", text: "text-sky-600" },
};

const LAYERS: ThoughtLayer[] = ["Vision", "Strategy", "Execution", "Experience", "Impact"];
const LAYER_TONE: Record<ThoughtLayer, string> = {
  Vision: "bg-rose-100 text-rose-700", Strategy: "bg-sky-100 text-sky-700",
  Execution: "bg-violet-100 text-violet-700", Experience: "bg-amber-100 text-amber-700",
  Impact: "bg-emerald-100 text-emerald-700",
};

/** Core helpers only — reusable AI reply templates live in Prompt Library. */
const FUNCTIONS = [
  { key: "translation", name: "Translation Lens", icon: Languages, desc: "Vision language ↔ systems language." },
  { key: "question", name: "Open questions", icon: MessageCircleQuestion, desc: "Sharpest unanswered questions on this thread." },
  { key: "merge", name: "Shared synthesis", icon: Combine, desc: "Both views in one direction note." },
  { key: "timesaver", name: "Catch-up brief", icon: Timer, desc: "One paragraph where this stands." },
];
const SEED_FEED_TIMESTAMPS = new Set(["2m ago", "1m ago", "just now"]);

export default function MindMeldRoom() {
  const { currentRole, mindMeldItems, handoffs, carmenfy, rosify, addMindMeldThought, createMindMeldThread, ideas, recommendations, meldTimeline, mindMeldLoading, duplicateRisks, sentimentSignals, competitors, reports, mindFeed } = useAppState();
  const { toast } = useToast();
  const [view, setView] = useState("room");
  const [selectedId, setSelectedId] = useState(mindMeldItems[0]?.id ?? "");
  const [activeFn, setActiveFn] = useState<string | null>(null);
  const [roseDraft, setRoseDraft] = useState("");
  const [carmenDraft, setCarmenDraft] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [tlNeeds, setTlNeeds] = useState("all");
  const [tlReadyTo, setTlReadyTo] = useState("all");
  const [tlSensitiveOnly, setTlSensitiveOnly] = useState(false);
  const [tlFinalizedOnly, setTlFinalizedOnly] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newThought, setNewThought] = useState("");
  const [creating, setCreating] = useState(false);

  const defaultOwner: "Rose" | "Carmen" = currentRole === "Carmen" ? "Carmen" : "Rose";

  useEffect(() => {
    if (mindMeldItems.length === 0) {
      setSelectedId("");
      return;
    }
    if (!mindMeldItems.some((m) => m.id === selectedId)) {
      setSelectedId(mindMeldItems[0].id);
    }
  }, [mindMeldItems, selectedId]);

  const handleCreateThread = async () => {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    const titleTrimmed = newTitle.trim();
    const id = await createMindMeldThread({ title: titleTrimmed, owner: defaultOwner, initialThought: newThought });
    setCreating(false);
    if (id) {
      setSelectedId(id);
      setNewTitle("");
      setNewThought("");
      setShowCreateForm(false);
      setView("room");
      toast({ title: "Thread created", description: `"${titleTrimmed}" is ready in the Mind Meld Room.` });
    } else {
      toast({ title: "Could not create thread", description: "Please try again.", variant: "destructive" });
    }
  };

  const filteredTimeline = useMemo(
    () =>
      meldTimeline.filter(
        (e) =>
          (tlNeeds === "all" || e.needs === tlNeeds) &&
          (tlReadyTo === "all" || e.readyTo === tlReadyTo) &&
          (!tlSensitiveOnly || e.sensitive) &&
          (!tlFinalizedOnly || e.finalized),
      ),
    [meldTimeline, tlNeeds, tlReadyTo, tlSensitiveOnly, tlFinalizedOnly],
  );

  const selected = useMemo(
    () => mindMeldItems.find((m) => m.id === selectedId) ?? mindMeldItems[0],
    [mindMeldItems, selectedId],
  );

  const pending = recommendations.filter((r) => r.status === "pending");
  const pulseAvg = sentimentSignals.length
    ? (sentimentSignals.reduce((a, s) => a + s.score, 0) / sentimentSignals.length) * 5
    : 0;
  const STATS = [
    { key: "dupes", label: "Duplicate Alerts", value: duplicateRisks.length, sub: `${duplicateRisks.filter((d) => d.similarity >= 80).length} High Priority`, icon: Target, tone: "rose" },
    { key: "pulse", label: "Team Pulse", value: pulseAvg.toFixed(1), sub: pulseAvg >= 3 ? "Strong Momentum" : "Watch closely", icon: Users, tone: "emerald" },
    { key: "ideas", label: "Innovation Ideas", value: ideas.length, sub: `${ideas.filter((i) => i.status === "approved-for-build").length} in Development`, icon: Lightbulb, tone: "violet" },
    { key: "queue", label: "Approval Queue", value: pending.length, sub: `${pending.filter((r) => r.risk === "high").length} Urgent`, icon: ClipboardCheck, tone: "amber" },
    { key: "recos", label: "Rose OS Recommends", value: recommendations.length, sub: `${recommendations.filter((r) => r.risk === "high").length} High Impact Actions`, icon: Sparkles, tone: "sky" },
  ] as const;

  if (!canAccessMindMeld(currentRole)) {
    return (
      <LockedState
        title="Private space for Rose & Carmen only"
        message="The Mind Meld Room is an end-to-end private alignment space. Switch to the Rose or Carmen role to enter."
      />
    );
  }

  if (mindMeldLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Loading shared Mind Meld state…</p>
      </div>
    );
  }

  const VIEWS = [
    { key: "room", label: "Mind Meld Room" },
    { key: "rose", label: "Rose View" },
    { key: "carmen", label: "Carmen View" },
    { key: "board", label: "Shared Mind Board" },
    { key: "handoff", label: "Handoff History" },
    { key: "notes", label: "Private Notes" },
    { key: "timeline", label: "Meld Timeline" },
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
              <p className="text-sm text-white/85">
                Think together on live threads — not a prompt library. Stamp decisions in Review Queue; save reusable templates in{" "}
                <Link href="/prompt-library" className="font-semibold underline decoration-white/60 underline-offset-2 hover:decoration-white">Prompt Library</Link>.
              </p>
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

      {view === "timeline" ? (
        <SectionCard title="Meld Timeline" icon={History} accent="violet">
          <p className="text-xs text-slate-500">
            Every thought keeps its origin story — original message, each founder's take, syntheses, open questions, and routing actions. Nothing here is an official decision until it is finalized through the approval flow.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              Needs
              <select value={tlNeeds} onChange={(e) => setTlNeeds(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                <option value="all">All</option>
                <option value="rose">Needs Rose</option>
                <option value="carmen">Needs Carmen</option>
                <option value="both">Needs both</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              Ready to
              <select value={tlReadyTo} onChange={(e) => setTlReadyTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                <option value="all">All</option>
                <option value="carmenfy">Send to Carmen</option>
                <option value="rosify">Send to Rose</option>
              </select>
            </label>
            <button
              onClick={() => setTlSensitiveOnly((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${tlSensitiveOnly ? "bg-rose-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              Sensitive only
            </button>
            <button
              onClick={() => setTlFinalizedOnly((v) => !v)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${tlFinalizedOnly ? "bg-emerald-500 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              Finalized only
            </button>
          </div>
          {filteredTimeline.length === 0 ? (
            <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">
                {meldTimeline.length === 0
                  ? "No timeline events yet. Create a thread and add thoughts to start the alignment story."
                  : `Nothing here — ${meldTimeline.length} event${meldTimeline.length === 1 ? "" : "s"} waiting in All.`}
              </p>
              {meldTimeline.length > 0 ? (
                <button
                  onClick={() => {
                    setTlNeeds("all");
                    setTlReadyTo("all");
                    setTlSensitiveOnly(false);
                    setTlFinalizedOnly(false);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  Show all timeline events ({meldTimeline.length})
                </button>
              ) : (
                <button
                  onClick={() => { setShowCreateForm(true); setView("room"); }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                >
                  <Plus className="h-4 w-4" /> Create thread
                </button>
              )}
            </div>
          ) : (
            <ul className="mt-4 space-y-3 border-l-2 border-violet-100 pl-4">
              {filteredTimeline.map((e) => (
                <li key={e.id} className="relative rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <span className={`absolute -left-[23px] top-4 h-3 w-3 rounded-full ring-2 ring-white ${e.finalized ? "bg-emerald-400" : e.sensitive ? "bg-rose-400" : "bg-violet-300"}`} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-800">{e.itemTitle}</span>
                    <StatusChip label={e.type.replace(/-/g, " ")} tone="violet" />
                    {e.sensitive && <StatusChip label="Sensitive" tone="rose" />}
                    {e.finalized && <StatusChip label="Finalized" tone="emerald" />}
                    {e.needs && <StatusChip label={`Needs ${e.needs === "both" ? "Rose + Carmen" : e.needs === "rose" ? "Rose" : "Carmen"}`} tone="amber" />}
                    {e.readyTo && <StatusChip label={e.readyTo === "carmenfy" ? "Ready for Carmen" : "Ready for Rose"} tone="sky" />}
                    <span className="ml-auto text-[11px] text-slate-400">{e.timestamp}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{e.text}</p>
                  <p className="mt-1 text-[11px] text-slate-400">by {e.actor}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : view === "handoff" ? (
        <SectionCard title="Handoff History" icon={History} accent="violet">
          {handoffs.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">No handoffs yet. Start a thread, then send it to Carmen or Rose when you're ready.</p>
              <button
                onClick={() => { setShowCreateForm(true); setView("room"); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <Plus className="h-4 w-4" /> Create thread
              </button>
            </div>
          ) : (
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
          )}
        </SectionCard>
      ) : view === "notes" ? (
        <SectionCard title="Private Decision Notes" icon={Lock} accent="rose">
          {mindMeldItems.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-6 text-center">
              <p className="text-sm text-slate-500">No private notes yet. Create a thread to capture founder alignment work.</p>
              <button
                onClick={() => { setShowCreateForm(true); setView("room"); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                <Plus className="h-4 w-4" /> Create thread
              </button>
            </div>
          ) : (
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
          )}
        </SectionCard>
      ) : view === "board" ? (
        mindMeldItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/30 p-10 text-center">
            <Brain className="mx-auto h-10 w-10 text-violet-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No threads yet — start one when you need to think together</p>
            <p className="mt-1 text-xs text-slate-500">
              Mind Meld is for live Rose ↔ Carmen alignment. For reusable reply templates, use{" "}
              <Link href="/prompt-library" className="font-semibold text-violet-600 hover:underline">Prompt Library</Link>.
            </p>
            <button
              onClick={() => { setShowCreateForm(true); setView("room"); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" /> Create thread
            </button>
          </div>
        ) : (
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
        )
      ) : view === "room" ? (
        <div className="space-y-6">
          {/* Command stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STATS.map((s) => {
              const Icon = s.icon;
              const tone = STAT_TONE[s.tone];
              return (
                <div key={s.key} className={`rounded-2xl border p-4 shadow-sm ${tone.card}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone.icon}`}><Icon className="h-4 w-4" /></span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{s.value}</p>
                  <p className={`mt-0.5 text-[11px] font-medium ${tone.text}`}>{s.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Item selector */}
          <div className="flex flex-wrap items-center gap-2">
            {mindMeldItems.map((m) => (
              <button key={m.id} onClick={() => setSelectedId(m.id)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${selectedId === m.id ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                {m.title}
              </button>
            ))}
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
            >
              <Plus className="h-3.5 w-3.5" /> New thread
            </button>
          </div>

          {(showCreateForm || mindMeldItems.length === 0) && (
            <CreateThreadPanel
              title={newTitle}
              thought={newThought}
              owner={defaultOwner}
              creating={creating}
              onTitleChange={setNewTitle}
              onThoughtChange={setNewThought}
              onSubmit={() => void handleCreateThread()}
              onCancel={mindMeldItems.length > 0 ? () => setShowCreateForm(false) : undefined}
            />
          )}

          {selected ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
              {/* Mind Meld Room panel */}
              <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm xl:col-span-3">
                {/* Panel header */}
                <div className="flex flex-col items-center gap-1 border-b border-violet-100 bg-gradient-to-r from-rose-50 via-violet-50 to-sky-50 px-6 py-5 text-center">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-500" />
                    <h2 className="text-base font-bold uppercase tracking-wide text-violet-700">Mind Meld Room</h2>
                    <Heart className="h-4 w-4 text-rose-400" />
                  </div>
                  <p className="text-xs text-slate-500">Private space for Rose &amp; Carmen only · {selected.title}</p>
                </div>

                {/* Three columns */}
                <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-3">
                  {/* ROSE VIEW */}
                  <div className="flex flex-col rounded-2xl border border-rose-100 bg-rose-50/40 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-xs font-bold text-white">RA</div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Rose View</p>
                          <p className="text-[11px] text-slate-500">Founder · vision</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />Active</span>
                    </div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-rose-400">Top Thought</p>
                    <p className="mt-1 text-sm text-slate-700">{selected.roseThoughts}</p>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-rose-400">Focus Areas</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{selected.focusAreas.map((f) => <StatusChip key={f} label={f} tone="rose" />)}</div>
                    {selected.roseFeedback && selected.roseFeedback.length > 0 && (
                      <>
                        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-rose-400">Rose OS Feedback</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {selected.roseFeedback.map((f) => (
                            <li key={f} className="flex items-start gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-600 ring-1 ring-rose-100">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-rose-400" /> {f}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {currentRole === "Rose" && (
                      <div className="mt-3">
                        <textarea value={roseDraft} onChange={(e) => setRoseDraft(e.target.value)} placeholder="Add or refine your thought..." className="h-16 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-200" />
                        <button onClick={() => { if (!roseDraft.trim()) return; addMindMeldThought(selected.id, "Rose", roseDraft); setRoseDraft(""); toast({ title: "Thought added to Rose View" }); }} className="mt-2 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600">Save thought</button>
                      </div>
                    )}
                    <button onClick={() => { carmenfy(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Sent to Carmen", description: "Routed for systems review. No official decision created." }); }} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 mt-4">
                      <Send className="h-4 w-4" /> Send to Carmen
                    </button>
                    <button onClick={() => { carmenfy(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Handoff to Carmen", description: "Routed to Carmen for systems review. No official decision created." }); }} className="mt-2 inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-500 transition hover:text-rose-600">
                      Handoff to Carmen <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* CENTER */}
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-center gap-3 text-[11px] font-semibold">
                      <span className="inline-flex items-center gap-1 text-rose-500">Rose <ArrowRight className="h-3.5 w-3.5" /></span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-600">Mind Meld</span>
                      <span className="inline-flex items-center gap-1 text-sky-500"><ArrowLeft className="h-3.5 w-3.5" /> Carmen</span>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-400">Alignment Meter</p>
                      <div className="mt-2 flex justify-center"><Donut value={selected.alignmentScore} label="aligned" accent="#a855f7" /></div>
                      <p className="mt-2 text-sm font-bold text-slate-800">{selected.alignment === "strong" ? "High Alignment" : selected.alignment === "partial" ? "Partial Alignment" : "Needs Clarity"}</p>
                      <p className="text-xs text-slate-500">{selected.alignment === "strong" ? "Synergy is strong" : selected.alignment === "partial" ? "Closing the gap" : "Clarify before deciding"}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400">Thread helpers</p>
                      <p className="mb-2 text-[10px] text-slate-400">
                        Glance aids for this thread. For reusable prompts / AI reply templates, use{" "}
                        <Link href="/prompt-library" className="font-semibold text-violet-600 hover:underline">Prompt Library</Link>.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {FUNCTIONS.map((f) => {
                          const Icon = f.icon;
                          return (
                            <button key={f.key} onClick={() => setActiveFn(activeFn === f.key ? null : f.key)} className={`rounded-xl border p-2.5 text-left transition ${activeFn === f.key ? "border-violet-300 bg-violet-50" : "border-slate-100 hover:border-violet-200 hover:bg-slate-50"}`}>
                              <Icon className="h-4 w-4 text-violet-500" />
                              <p className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-800">{f.name}</p>
                              <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{f.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                      {activeFn && <FunctionOutput fnKey={activeFn} item={selected} />}
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-violet-400">Thought Layers</p>
                      <div className="flex flex-wrap gap-1.5">{LAYERS.map((l) => <span key={l} className={`rounded-full px-2.5 py-1 text-xs font-medium ${LAYER_TONE[l]}`}>{l}</span>)}</div>
                    </div>

                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-violet-400">Recent activity</p>
                      {mindFeed.filter((e) => !SEED_FEED_TIMESTAMPS.has(e.timestamp)).length === 0 ? (
                        <p className="text-xs text-slate-400">No new activity yet — open a thread and add a thought.</p>
                      ) : (
                        <ul className="space-y-2">
                          {mindFeed.filter((e) => !SEED_FEED_TIMESTAMPS.has(e.timestamp)).map((e) => (
                            <li key={e.id} className="flex items-center gap-2 text-xs">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                              <span className="text-slate-700"><span className="font-semibold">{e.actor}</span> {e.action}</span>
                              <span className="ml-auto text-slate-300">{e.timestamp}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* CARMEN VIEW */}
                  <div className="flex flex-col rounded-2xl border border-sky-100 bg-sky-50/40 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-xs font-bold text-white">CV</div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Carmen View</p>
                          <p className="text-[11px] text-slate-500">Systems · execution</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600"><span className="h-1.5 w-1.5 rounded-full bg-sky-500" />Active</span>
                    </div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-sky-400">Top Perspective</p>
                    <p className="mt-1 text-sm text-slate-700">{selected.carmenThoughts}</p>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-sky-400">Thought Layers</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{selected.layers.map((l) => <span key={l} className={`rounded-full px-2 py-0.5 text-xs font-medium ${LAYER_TONE[l]}`}>{l}</span>)}</div>
                    {selected.carmenFeedback && selected.carmenFeedback.length > 0 && (
                      <>
                        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-sky-400">Carmen OS Feedback</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {selected.carmenFeedback.map((f) => (
                            <li key={f} className="flex items-start gap-1.5 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] text-slate-600 ring-1 ring-sky-100">
                              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-sky-400" /> {f}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {currentRole === "Carmen" && (
                      <div className="mt-3">
                        <textarea value={carmenDraft} onChange={(e) => setCarmenDraft(e.target.value)} placeholder="Add or refine your perspective..." className="h-16 w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-200" />
                        <button onClick={() => { if (!carmenDraft.trim()) return; addMindMeldThought(selected.id, "Carmen", carmenDraft); setCarmenDraft(""); toast({ title: "Perspective added to Carmen View" }); }} className="mt-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-600">Save perspective</button>
                      </div>
                    )}
                    <button onClick={() => { rosify(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Sent to Rose", description: "Routed for direction review. No official decision created." }); }} className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 mt-4">
                      <Send className="h-4 w-4" /> Send to Rose
                    </button>
                    <button onClick={() => { rosify(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Handoff to Rose", description: "Routed to Rose for direction review. No official decision created." }); }} className="mt-2 inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-sky-500 transition hover:text-sky-600">
                      <ArrowLeft className="h-3.5 w-3.5" /> Handoff to Rose
                    </button>
                  </div>
                </div>

                {/* Synthesis */}
                <div className="border-t border-violet-100 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/60 p-5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600"><Sparkles className="h-3.5 w-3.5" /> Rose OS Synthesis</p>
                  <p className="mt-2 text-sm text-slate-700">{selected.synthesis}</p>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Open questions</p>
                      <ul className="mt-1 space-y-1">{selected.openQuestions.map((q) => <li key={q} className="flex items-start gap-1.5 text-sm text-slate-700"><MessageCircleQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />{q}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Optional handoff note</p>
                      <input value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} placeholder="Add a note before sending to Carmen or Rose..." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />
                      <p className="mt-1.5 text-[11px] text-slate-400">Handoffs create a private item for the other person. They never auto-create official company decisions.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right rail */}
              <div className="space-y-6">
                <SectionCard title="Decision Heatmap" icon={Grid3x3} accent="rose">
                  <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const intensity = (Math.sin(i * 1.7) + 1) / 2;
                      const bg = intensity > 0.66 ? "bg-rose-400" : intensity > 0.33 ? "bg-fuchsia-400" : "bg-sky-300";
                      return (
                        <div
                          key={i}
                          className={`aspect-square ${bg}`}
                          style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)", opacity: 0.45 + intensity * 0.55 }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Strong</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-fuchsia-400" />Partial</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-300" />Needs clarity</span>
                  </div>
                </SectionCard>

                <SectionCard title="Handoff History" icon={History} accent="violet">
                  <ul className="space-y-3">
                    {handoffs.map((h) => (
                      <li key={h.id} className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600"><ArrowRightLeft className="h-4 w-4" /></div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{h.from} → {h.to}</p>
                          <p className="text-[11px] text-slate-500">{h.layer} layer · {h.timestamp}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </SectionCard>

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
          ) : !showCreateForm && mindMeldItems.length > 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Select a thread above to open the Mind Meld Room.</p>
          ) : null}

          {/* Module pulse strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <SectionCard title="Duplicate Radar" icon={Target} accent="rose">
              <ul className="space-y-2.5">
                {duplicateRisks.slice(0, 3).map((d) => (
                  <li key={d.id} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700">{d.similarity}% overlap</span>
                      <RiskBadge value={d.risk} />
                    </div>
                    <p className="mt-0.5 truncate text-slate-500">{d.title}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Team Pulse" icon={Users} accent="emerald">
              <ul className="space-y-2">
                {sentimentSignals.slice(0, 4).map((s) => (
                  <li key={s.team} className="flex items-center gap-2 text-xs">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.score >= 0.6 ? "bg-emerald-400" : s.score >= 0.3 ? "bg-amber-400" : "bg-rose-400"}`} />
                    <span className="truncate text-slate-600">{s.team}</span>
                    <span className="ml-auto font-semibold text-slate-700">{(s.score * 5).toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Innovation Clusters" icon={Lightbulb} accent="violet">
              <ul className="space-y-2">
                {ideas.slice(0, 4).map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    <span className="truncate text-slate-600">{i.title}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Market Pulse" icon={Activity} accent="sky">
              <ul className="space-y-2">
                {competitors.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-xs">
                    <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${c.movement >= 0 ? "text-emerald-500" : "text-rose-500"}`} />
                    <span className="truncate text-slate-600">{c.name}</span>
                    <span className={`ml-auto font-semibold ${c.movement >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{c.movement >= 0 ? "+" : ""}{c.movement}%</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Executive Reports" icon={FileText} accent="amber">
              <ul className="space-y-2">
                {reports.slice(0, 3).map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="truncate text-slate-600">{r.title}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left & center */}
          <div className="space-y-6 lg:col-span-2">
            {/* Item selector */}
            <div className="flex flex-wrap items-center gap-2">
              {mindMeldItems.map((m) => (
                <button key={m.id} onClick={() => setSelectedId(m.id)} className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${selectedId === m.id ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
                  {m.title}
                </button>
              ))}
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
              >
                <Plus className="h-3.5 w-3.5" /> New thread
              </button>
            </div>

            {(showCreateForm || mindMeldItems.length === 0) && (
              <CreateThreadPanel
                title={newTitle}
                thought={newThought}
                owner={defaultOwner}
                creating={creating}
                onTitleChange={setNewTitle}
                onThoughtChange={setNewThought}
                onSubmit={() => void handleCreateThread()}
                onCancel={mindMeldItems.length > 0 ? () => setShowCreateForm(false) : undefined}
              />
            )}

            {!selected && !showCreateForm && mindMeldItems.length === 0 && (
              <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/30 p-8 text-center">
                <p className="text-sm text-slate-600">Start your first alignment thread above.</p>
              </div>
            )}

            {selected && (
              <>
                {/* Two-column Rose / Carmen */}
                {view === "rose" && (
                  <div className="grid grid-cols-1 gap-4">
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
                    <button onClick={() => { carmenfy(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Sent to Carmen", description: "Routed for systems review. No official decision created." }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"><Send className="h-4 w-4" /> Send to Carmen</button>
                    <button onClick={() => { rosify(selected.id, handoffNote); setHandoffNote(""); toast({ title: "Sent to Rose", description: "Routed for direction review. No official decision created." }); }} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"><Send className="h-4 w-4" /> Send to Rose</button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Handoffs create a private item for the other person. They never auto-create official company decisions.</p>
                </SectionCard>

                <SectionCard title="Thread helpers" icon={Brain} accent="violet">
                  <p className="mb-3 text-xs text-slate-500">
                    Aids for this conversation only. Reusable prompts and AI reply templates live in{" "}
                    <Link href="/prompt-library" className="font-semibold text-violet-600 hover:underline">Prompt Library</Link>.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
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

function CreateThreadPanel({
  title,
  thought,
  owner,
  creating,
  onTitleChange,
  onThoughtChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  thought: string;
  owner: "Rose" | "Carmen";
  creating: boolean;
  onTitleChange: (v: string) => void;
  onThoughtChange: (v: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-violet-600" />
        <h3 className="text-sm font-bold text-slate-800">Create alignment thread</h3>
        <StatusChip label={owner} tone={owner === "Rose" ? "rose" : "sky"} />
      </div>
      <p className="mt-1 text-xs text-slate-500">Private thread for Rose &amp; Carmen — not an official company decision until routed through approval.</p>
      <div className="mt-4 space-y-3">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Thread title (e.g. Q3 platform direction)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
        />
        <textarea
          value={thought}
          onChange={(e) => onThoughtChange(e.target.value)}
          placeholder={`${owner}'s opening thought (optional)`}
          className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSubmit}
            disabled={!title.trim() || creating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {creating ? "Creating…" : "Create thread"}
          </button>
          {onCancel && (
            <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white">
              Cancel
            </button>
          )}
        </div>
      </div>
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
