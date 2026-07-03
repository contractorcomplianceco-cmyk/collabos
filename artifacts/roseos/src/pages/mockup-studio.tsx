import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMockups,
  useCreateMockup,
  useUpdateMockup,
  useChangeMockupStatus,
  useListMockupVersions,
  useCreateMockupVersion,
  getListMockupsQueryKey,
  getListMockupVersionsQueryKey,
  ApiError,
  type MockupRecord,
  type MockupBriefData,
  type MockupScreenData,
  type VisualDirectionData,
  type MockupStatus,
  type MockupSourceType,
  type MockupVersionRecord,
} from "@workspace/api-client-react";
import {
  PenTool, Wand2, FileCode, Send, LayoutGrid, Plus, ArrowLeft, ArrowUp, ArrowDown,
  Trash2, Layers, Palette, History, CheckCircle2, XCircle, GitCompare, Sparkles,
  ClipboardCheck, Image, Copy, Archive, Undo2,
} from "lucide-react";
import { PageHeader, SectionCard, EmptyState, StatusChip } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  mockupReviewChecklist,
  generateMockupBuildPrompt,
  generateMockupHandoff,
} from "@/lib/helpers";

/* ---------- constants ---------- */

const BLOCK_LIBRARY = [
  "Header bar", "KPI widgets", "Data table", "Card list", "Detail panel", "Form",
  "Chart", "Timeline", "Kanban board", "Chat thread", "Filter bar", "Sidebar nav",
  "Action footer", "Empty state", "Approval banner", "Search bar", "Tabs", "Stepper",
];

const COMPONENT_IDEAS: Record<string, string> = {
  "KPI widgets": "Add delta pills showing week-over-week change.",
  "Data table": "Sticky header + row-level status chips.",
  "Card list": "Use pastel classification chips like the Review Queue.",
  "Detail panel": "Slide-over drawer keeps list context visible.",
  Form: "Group fields into short sections with helper text.",
  Chart: "Donut for share-of-total, bars for trends.",
  Timeline: "Color-code events by actor (Rose vs Carmen).",
  "Kanban board": "Limit to 4 columns; add a WIP hint.",
  "Approval banner": "Show who still needs to approve — never auto-approve.",
  "Chat thread": "Label AI messages clearly as recommendations.",
};

const STATUS_META: Record<MockupStatus, { label: string; tone: "slate" | "rose" | "sky" | "emerald" | "amber" | "violet" }> = {
  draft: { label: "Draft", tone: "slate" },
  needs_rose_review: { label: "Needs Rose review", tone: "rose" },
  needs_carmen_review: { label: "Needs Carmen review", tone: "sky" },
  needs_both_review: { label: "Needs Rose + Carmen", tone: "violet" },
  approved_for_build: { label: "Approved for build", tone: "emerald" },
  sent_back: { label: "Sent back", tone: "amber" },
  archived: { label: "Archived", tone: "slate" },
};

const EMPTY_BRIEF: MockupBriefData = {
  productName: "", audience: "", mainGoal: "", userRoles: "", keyWorkflows: "",
  mustHaveFeatures: "", dataNeeded: "", privacyRules: "", brandDirection: "",
  visualFeel: "", approvalNeeded: "both", buildReadiness: "not_ready",
};

const EMPTY_VISUAL: VisualDirectionData = {
  mood: "", colorDirection: "", layoutDensity: "balanced", buttonStyle: "rounded",
  cardStyle: "soft shadow", navigationStyle: "sidebar", motionLevel: "subtle", overallFeel: "",
};

function errMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as { message?: string } | undefined;
    return data?.message ?? "Request failed";
  }
  return err instanceof Error ? err.message : "Request failed";
}

function newScreen(name = "New screen"): MockupScreenData {
  return { id: `scr-${Date.now()}-${Math.floor(Math.random() * 1000)}`, name, purpose: "", blocks: ["Header bar"] };
}

/* ---------- page ---------- */

export default function MockupStudio() {
  const { data: mockups, isLoading, error } = useListMockups();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = (mockups ?? []).find((m) => m.id === selectedId) ?? null;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Mockup Studio"
        subtitle="Turn ideas into structured mockups — briefs, screens, visual direction, versions, and an approval flow."
        icon={PenTool}
        accent="violet"
        actions={selected ? (
          <button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> All mockups
          </button>
        ) : undefined}
      />
      {isLoading && <p className="py-10 text-center text-sm text-slate-400">Loading mockups...</p>}
      {error != null && <p className="py-10 text-center text-sm text-rose-500">{errMessage(error)}</p>}
      {!isLoading && !error && (selected
        ? <MockupEditor key={selected.id} mockup={selected} />
        : <MockupGallery mockups={mockups ?? []} onOpen={setSelectedId} />)}
    </div>
  );
}

/* ---------- gallery + intake ---------- */

function MockupGallery({ mockups, onOpen }: { mockups: MockupRecord[]; onOpen: (id: number) => void }) {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("mockup_studio_edit");
  const { intakeItems, ideas, mindMeldItems } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMockup = useCreateMockup();
  const [title, setTitle] = useState("");

  const sources = useMemo(() => {
    const fromIntake = intakeItems
      .filter((i) => i.status !== "archived" && i.sensitivity === "normal")
      .slice(0, 4)
      .map((i) => ({ key: `intake-${i.id}`, sourceType: "intake_item" as MockupSourceType, sourceItemId: i.id, label: i.cleanedSummary || i.rawMessage.slice(0, 80), origin: "External Intake" }));
    const fromIdeas = ideas.slice(0, 4).map((i) => ({ key: `idea-${i.id}`, sourceType: "idea" as MockupSourceType, sourceItemId: i.id, label: i.title, origin: "Innovation Lab" }));
    const fromMeld = mindMeldItems.slice(0, 3).map((i) => ({ key: `meld-${i.id}`, sourceType: "mind_meld_item" as MockupSourceType, sourceItemId: i.id, label: i.title, origin: "Mind Meld Room" }));
    return [...fromIntake, ...fromIdeas, ...fromMeld];
  }, [intakeItems, ideas, mindMeldItems]);

  const create = (input: { title: string; sourceType: MockupSourceType; sourceItemId?: string; sourceSummary?: string }) => {
    createMockup.mutate(
      {
        data: {
          title: input.title,
          sourceType: input.sourceType,
          sourceItemId: input.sourceItemId,
          sourceSummary: input.sourceSummary,
          brief: { ...EMPTY_BRIEF, productName: input.title, mainGoal: input.sourceSummary ?? "" },
          screens: [newScreen("Main screen")],
          visualDirection: { ...EMPTY_VISUAL },
        },
      },
      {
        onSuccess: (m) => {
          void queryClient.invalidateQueries({ queryKey: getListMockupsQueryKey() });
          toast({ title: "Mockup created", description: "Saved as a draft — nothing goes to build without approval." });
          onOpen(m.id);
        },
        onError: (e) => toast({ title: "Could not create mockup", description: errMessage(e), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <SectionCard title={`Mockups (${mockups.length})`} icon={LayoutGrid} accent="violet">
          {mockups.length === 0 ? (
            <EmptyState message="No mockups yet. Start one from scratch or pick an idea on the right — your first draft takes under a minute." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {mockups.map((m) => {
                const meta = STATUS_META[m.status];
                return (
                  <button key={m.id} onClick={() => onOpen(m.id)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-200 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800">{m.title}</p>
                      <StatusChip label={meta.label} tone={meta.tone} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{m.brief.mainGoal || m.sourceSummary || "No goal set yet"}</p>
                    <p className="mt-2 text-[11px] text-slate-400">{m.screens.length} screen{m.screens.length === 1 ? "" : "s"} · {m.ownerName} · {new Date(m.updatedAt).toLocaleDateString()}</p>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>
      <div className="space-y-6">
        <SectionCard title="Start from scratch" icon={Plus} accent="violet">
          {canEdit ? (
            <div className="space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="field-input" placeholder="Mockup title, e.g. Client 360 Dashboard" />
              <button
                onClick={() => { create({ title: title.trim(), sourceType: "scratch" }); setTitle(""); }}
                disabled={!title.trim() || createMockup.isPending}
                className="w-full rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40"
              >
                {createMockup.isPending ? "Creating..." : "Create draft"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Your role can browse mockups but not create or edit them.</p>
          )}
        </SectionCard>
        {canEdit && (
          <SectionCard title="Start from an existing idea" icon={Sparkles} accent="rose">
            {sources.length === 0 ? (
              <p className="text-xs text-slate-500">No intake items, ideas, or meld threads available yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {sources.map((s) => (
                  <li key={s.key}>
                    <button
                      onClick={() => create({ title: s.label.slice(0, 60), sourceType: s.sourceType, sourceItemId: s.sourceItemId, sourceSummary: s.label })}
                      disabled={createMockup.isPending}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-40"
                    >
                      <span className="block truncate font-medium">{s.label}</span>
                      <span className="text-[10px] text-slate-400">{s.origin}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

/* ---------- editor ---------- */

type EditorTab = "brief" | "screens" | "visual" | "review" | "versions";

function MockupEditor({ mockup }: { mockup: MockupRecord }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMockup = useUpdateMockup();
  const changeStatus = useChangeMockupStatus();
  const locked = mockup.status === "approved_for_build" || mockup.status === "archived";
  const canEdit = hasPermission("mockup_studio_edit") && !locked;

  const [tab, setTab] = useState<EditorTab>("brief");
  const [brief, setBrief] = useState<MockupBriefData>(mockup.brief);
  const [screens, setScreens] = useState<MockupScreenData[]>(mockup.screens);
  const [visual, setVisual] = useState<VisualDirectionData>(mockup.visualDirection);
  const [dirty, setDirty] = useState(false);

  const draft = { title: mockup.title, brief, screens, visualDirection: visual };
  const checklist = mockupReviewChecklist(draft);
  const done = checklist.filter((c) => c.ok).length;
  const meta = STATUS_META[mockup.status];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMockupsQueryKey() });

  const save = (onSaved?: () => void) => {
    updateMockup.mutate(
      { id: mockup.id, data: { brief, screens, visualDirection: visual } },
      {
        onSuccess: () => {
          setDirty(false);
          void invalidate();
          toast({ title: "Mockup saved" });
          onSaved?.();
        },
        onError: (e) => toast({ title: "Could not save", description: errMessage(e), variant: "destructive" }),
      },
    );
  };

  const transition = (status: MockupStatus, note?: string) => {
    changeStatus.mutate(
      { id: mockup.id, data: { status, note } },
      {
        onSuccess: (m) => {
          void invalidate();
          toast({ title: `Status: ${STATUS_META[m.status].label}`, description: m.statusNote ?? undefined });
        },
        onError: (e) => toast({ title: "Status change blocked", description: errMessage(e), variant: "destructive" }),
      },
    );
  };

  const submitForReview = () => {
    const target: MockupStatus =
      brief.approvalNeeded === "rose" ? "needs_rose_review"
        : brief.approvalNeeded === "carmen" ? "needs_carmen_review"
        : "needs_both_review";
    if (dirty) save(() => transition(target));
    else transition(target);
  };

  const mut = <K extends keyof MockupBriefData>(k: K, v: MockupBriefData[K]) => { setBrief((b) => ({ ...b, [k]: v })); setDirty(true); };
  const mutV = <K extends keyof VisualDirectionData>(k: K, v: VisualDirectionData[K]) => { setVisual((s) => ({ ...s, [k]: v })); setDirty(true); };
  const mutScreens = (next: MockupScreenData[]) => { setScreens(next); setDirty(true); };

  const inReview = mockup.status === "needs_rose_review" || mockup.status === "needs_carmen_review" || mockup.status === "needs_both_review";
  const canApproveNow =
    (mockup.status === "needs_rose_review" && hasPermission("mockup_approve_rose")) ||
    (mockup.status === "needs_carmen_review" && hasPermission("mockup_approve_carmen")) ||
    (mockup.status === "needs_both_review" && (hasPermission("mockup_approve_rose") || hasPermission("mockup_approve_carmen")));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold text-slate-800">{mockup.title}</h2>
          <StatusChip label={meta.label} tone={meta.tone} />
          {mockup.statusNote && <span className="text-[11px] text-slate-400">Note: {mockup.statusNote}</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{done}/{checklist.length} checklist</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <button onClick={() => save()} disabled={!dirty || updateMockup.isPending} className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40">
              {updateMockup.isPending ? "Saving..." : dirty ? "Save changes" : "Saved"}
            </button>
          )}
          {canEdit && (mockup.status === "draft" || mockup.status === "sent_back") && (
            <button onClick={submitForReview} disabled={changeStatus.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40">
              <Send className="h-3.5 w-3.5" /> Submit for review
            </button>
          )}
          {inReview && canApproveNow && (
            <button onClick={() => transition("approved_for_build")} disabled={changeStatus.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-40">
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </button>
          )}
          {inReview && canApproveNow && (
            <button onClick={() => transition("sent_back", "Needs another pass")} disabled={changeStatus.isPending} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-100 disabled:opacity-40">
              <XCircle className="h-3.5 w-3.5" /> Send back
            </button>
          )}
          {hasPermission("mockup_studio_edit") && mockup.status !== "archived" && (
            <button onClick={() => transition("archived")} disabled={changeStatus.isPending} title="Archive" className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 disabled:opacity-40">
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          {hasPermission("mockup_studio_edit") && mockup.status === "archived" && (
            <button onClick={() => transition("draft")} disabled={changeStatus.isPending} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              <Undo2 className="h-3.5 w-3.5" /> Restore to draft
            </button>
          )}
        </div>
      </div>

      {locked && mockup.status === "approved_for_build" && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
          Approved for build — content is locked. Use the Review tab to copy the build handoff and prompt.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {([
          ["brief", "Brief", FileCode],
          ["screens", "Screens", Layers],
          ["visual", "Visual direction", Palette],
          ["review", "Review & handoff", ClipboardCheck],
          ["versions", "Versions & compare", History],
        ] as [EditorTab, string, React.ElementType][]).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${tab === key ? "bg-violet-500 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "brief" && <BriefTab brief={brief} mut={mut} canEdit={canEdit} sourceSummary={mockup.sourceSummary ?? null} />}
      {tab === "screens" && <ScreensTab screens={screens} setScreens={mutScreens} canEdit={canEdit} />}
      {tab === "visual" && <VisualTab visual={visual} mutV={mutV} canEdit={canEdit} />}
      {tab === "review" && <ReviewTab mockup={mockup} draft={draft} />}
      {tab === "versions" && <VersionsTab mockup={mockup} currentDirty={dirty} />}
    </div>
  );
}

/* ---------- brief tab ---------- */

function BriefTab({ brief, mut, canEdit, sourceSummary }: {
  brief: MockupBriefData;
  mut: <K extends keyof MockupBriefData>(k: K, v: MockupBriefData[K]) => void;
  canEdit: boolean;
  sourceSummary: string | null;
}) {
  const fields: { key: keyof MockupBriefData; label: string; placeholder: string; textarea?: boolean }[] = [
    { key: "productName", label: "Product / screen name", placeholder: "Client 360 Dashboard" },
    { key: "audience", label: "Audience", placeholder: "Account managers and leadership" },
    { key: "mainGoal", label: "Main goal", placeholder: "One place to see everything about a client", textarea: true },
    { key: "userRoles", label: "User roles", placeholder: "Admin, manager, viewer" },
    { key: "keyWorkflows", label: "Key workflows", placeholder: "Open client → review status → take action → route for approval", textarea: true },
    { key: "mustHaveFeatures", label: "Must-have features", placeholder: "Timeline, documents, CRM stage, compliance status", textarea: true },
    { key: "dataNeeded", label: "Data needed", placeholder: "Client records, activity log, document metadata", textarea: true },
    { key: "privacyRules", label: "Privacy & permission rules", placeholder: "HR-sensitive items visible to leadership only", textarea: true },
    { key: "brandDirection", label: "Brand direction", placeholder: "CollabOS white + rose/blue accents" },
    { key: "visualFeel", label: "Visual feel", placeholder: "Clean, calm, confident" },
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard title="Build brief" icon={FileCode} accent="violet">
          {sourceSummary && (
            <div className="mb-4 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">
              <span className="font-semibold">Source idea:</span> {sourceSummary}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className={`block ${f.textarea ? "sm:col-span-2" : ""}`}>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{f.label}</span>
                {f.textarea ? (
                  <textarea rows={2} disabled={!canEdit} value={brief[f.key]} onChange={(e) => mut(f.key, e.target.value)} className="field-input resize-y" placeholder={f.placeholder} />
                ) : (
                  <input disabled={!canEdit} value={brief[f.key]} onChange={(e) => mut(f.key, e.target.value)} className="field-input" placeholder={f.placeholder} />
                )}
              </label>
            ))}
          </div>
        </SectionCard>
      </div>
      <div className="space-y-6">
        <SectionCard title="Approval & readiness" icon={ClipboardCheck} accent="rose">
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Who must approve</span>
            <select disabled={!canEdit} value={brief.approvalNeeded} onChange={(e) => mut("approvalNeeded", e.target.value as MockupBriefData["approvalNeeded"])} className="field-input">
              <option value="rose">Rose</option>
              <option value="carmen">Carmen</option>
              <option value="both">Both Rose & Carmen</option>
              <option value="none">Not set yet</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Build readiness</span>
            <select disabled={!canEdit} value={brief.buildReadiness} onChange={(e) => mut("buildReadiness", e.target.value as MockupBriefData["buildReadiness"])} className="field-input">
              <option value="not_ready">Not ready</option>
              <option value="needs_detail">Needs detail</option>
              <option value="almost_ready">Almost ready</option>
              <option value="build_ready">Build ready</option>
            </select>
          </label>
          <p className="mt-3 text-[11px] text-slate-400">Approval is enforced on the server — a mockup can never reach "approved for build" without the required reviewer(s).</p>
        </SectionCard>
        <SectionCard title="Reference images" icon={Image} accent="amber">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-xs font-semibold text-slate-500">Upload references — coming soon</p>
            <p className="mt-1 text-[11px] text-slate-400">For now, describe references in the brand direction field.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ---------- screens tab ---------- */

function ScreensTab({ screens, setScreens, canEdit }: {
  screens: MockupScreenData[];
  setScreens: (s: MockupScreenData[]) => void;
  canEdit: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(screens[0]?.id ?? null);
  const active = screens.find((s) => s.id === activeId) ?? screens[0] ?? null;

  const patch = (id: string, p: Partial<MockupScreenData>) => setScreens(screens.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...screens];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setScreens(next);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <SectionCard title={`Screen planner (${screens.length})`} icon={Layers} accent="violet">
        <ul className="space-y-1.5">
          {screens.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 ${active?.id === s.id ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"}`}>
              <button onClick={() => setActiveId(s.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-semibold text-slate-700">{s.name}</p>
                <p className="text-[10px] text-slate-400">{s.blocks.length} blocks</p>
              </button>
              {canEdit && (
                <>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-white disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === screens.length - 1} className="rounded p-1 text-slate-400 hover:bg-white disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                  <button onClick={() => { const next = screens.filter((x) => x.id !== s.id); setScreens(next); if (activeId === s.id) setActiveId(next[0]?.id ?? null); }} className="rounded p-1 text-rose-400 hover:bg-rose-50"><Trash2 className="h-3 w-3" /></button>
                </>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <button onClick={() => { const s = newScreen(`Screen ${screens.length + 1}`); setScreens([...screens, s]); setActiveId(s.id); }} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-200 px-3 py-2 text-xs font-semibold text-violet-600 hover:bg-violet-50">
            <Plus className="h-3.5 w-3.5" /> Add screen
          </button>
        )}
      </SectionCard>

      {active ? (
        <>
          <SectionCard title="Screen details & blocks" icon={Wand2} accent="rose">
            <label className="mb-2 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Screen name</span>
              <input disabled={!canEdit} value={active.name} onChange={(e) => patch(active.id, { name: e.target.value })} className="field-input" />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Purpose</span>
              <input disabled={!canEdit} value={active.purpose} onChange={(e) => patch(active.id, { purpose: e.target.value })} className="field-input" placeholder="What the user achieves here" />
            </label>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Layout blocks (tap to toggle)</p>
            <div className="flex flex-wrap gap-1.5">
              {BLOCK_LIBRARY.map((b) => {
                const on = active.blocks.includes(b);
                return (
                  <button
                    key={b}
                    disabled={!canEdit}
                    onClick={() => patch(active.id, { blocks: on ? active.blocks.filter((x) => x !== b) : [...active.blocks, b] })}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${on ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {b}
                  </button>
                );
              })}
            </div>
            {active.blocks.some((b) => COMPONENT_IDEAS[b]) && (
              <div className="mt-4 rounded-xl bg-sky-50 p-3">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-600">Component ideas</p>
                <ul className="space-y-1">
                  {active.blocks.filter((b) => COMPONENT_IDEAS[b]).map((b) => (
                    <li key={b} className="text-xs text-sky-700"><span className="font-semibold">{b}:</span> {COMPONENT_IDEAS[b]}</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Wireframe preview" icon={LayoutGrid} accent="sky">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-rose-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="ml-2 text-[10px] font-semibold text-slate-400">{active.name}</span>
              </div>
              <div className="space-y-1.5">
                {active.blocks.length === 0 && <p className="py-6 text-center text-[11px] text-slate-400">Toggle blocks to sketch this screen.</p>}
                {active.blocks.map((b, i) => (
                  <div key={`${b}-${i}`} className={`flex items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-400 ${b.includes("Header") || b.includes("bar") ? "h-8" : b.includes("KPI") || b.includes("Tabs") || b.includes("Stepper") ? "h-10" : "h-16"}`}>
                    {b}
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Block-based sketch — order follows your block selection.</p>
          </SectionCard>
        </>
      ) : (
        <div className="lg:col-span-2"><EmptyState message="Add a screen to start planning its layout." /></div>
      )}
    </div>
  );
}

/* ---------- visual tab ---------- */

const VISUAL_CHOICES: { key: keyof VisualDirectionData; label: string; options: string[] }[] = [
  { key: "mood", label: "Mood", options: ["Calm & focused", "Bold & energetic", "Warm & friendly", "Precise & technical"] },
  { key: "colorDirection", label: "Color direction", options: ["CollabOS rose + blue", "Deep violet + white", "Emerald + slate", "Monochrome + one accent"] },
  { key: "layoutDensity", label: "Layout density", options: ["airy", "balanced", "dense"] },
  { key: "buttonStyle", label: "Buttons", options: ["rounded", "pill", "square", "gradient"] },
  { key: "cardStyle", label: "Cards", options: ["soft shadow", "flat outline", "glass", "elevated"] },
  { key: "navigationStyle", label: "Navigation", options: ["sidebar", "top bar", "tabs", "command-first"] },
  { key: "motionLevel", label: "Motion", options: ["none", "subtle", "lively"] },
];

function VisualTab({ visual, mutV, canEdit }: {
  visual: VisualDirectionData;
  mutV: <K extends keyof VisualDirectionData>(k: K, v: VisualDirectionData[K]) => void;
  canEdit: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SectionCard title="Visual direction board" icon={Palette} accent="violet">
          <div className="space-y-4">
            {VISUAL_CHOICES.map((c) => (
              <div key={c.key}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.options.map((o) => (
                    <button
                      key={o}
                      disabled={!canEdit}
                      onClick={() => mutV(c.key, o)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${visual[c.key] === o ? "bg-violet-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Overall feel (your words)</span>
              <textarea rows={2} disabled={!canEdit} value={visual.overallFeel} onChange={(e) => mutV("overallFeel", e.target.value)} className="field-input resize-y" placeholder="A calm command center that feels effortless and premium" />
            </label>
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Direction summary" icon={Sparkles} accent="rose">
        <ul className="space-y-2">
          {VISUAL_CHOICES.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">{c.label}</span>
              <span className={`font-semibold ${visual[c.key] ? "text-slate-700" : "text-slate-300"}`}>{visual[c.key] || "not set"}</span>
            </li>
          ))}
        </ul>
        {visual.overallFeel && <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700">{visual.overallFeel}</p>}
      </SectionCard>
    </div>
  );
}

/* ---------- review tab ---------- */

function ReviewTab({ mockup, draft }: { mockup: MockupRecord; draft: { title: string; brief: MockupBriefData; screens: MockupScreenData[]; visualDirection: VisualDirectionData } }) {
  const { toast } = useToast();
  const checklist = mockupReviewChecklist(draft);
  const prompt = generateMockupBuildPrompt(draft);
  const handoff = generateMockupHandoff(draft, mockup.ownerName, STATUS_META[mockup.status].label);
  const copy = (text: string, label: string) => { void navigator.clipboard?.writeText(text); toast({ title: `${label} copied` }); };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <SectionCard title="Design review assistant" icon={ClipboardCheck} accent="emerald">
        <ul className="space-y-2">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-start gap-2">
              {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
              <div>
                <p className={`text-xs font-semibold ${c.ok ? "text-slate-700" : "text-slate-500"}`}>{c.label}</p>
                {!c.ok && <p className="text-[11px] text-slate-400">{c.hint}</p>}
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
      <SectionCard
        title="Build handoff"
        icon={FileCode}
        accent="violet"
        action={<button onClick={() => copy(handoff, "Handoff")} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"><Copy className="h-3 w-3" /> Copy</button>}
      >
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">{handoff}</pre>
      </SectionCard>
      <SectionCard
        title="Replit build prompt"
        icon={Wand2}
        accent="rose"
        action={<button onClick={() => copy(prompt, "Build prompt")} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"><Copy className="h-3 w-3" /> Copy</button>}
      >
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{prompt}</pre>
        <p className="mt-2 text-[10px] text-slate-400">Draft prompt generated from the brief — review before use. Nothing is auto-approved.</p>
      </SectionCard>
    </div>
  );
}

/* ---------- versions tab ---------- */

function VersionsTab({ mockup, currentDirty }: { mockup: MockupRecord; currentDirty: boolean }) {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: versions, isLoading } = useListMockupVersions(mockup.id);
  const createVersion = useCreateMockupVersion();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [compareA, setCompareA] = useState<number | null>(null);
  const [compareB, setCompareB] = useState<number | null>(null);
  const canEdit = hasPermission("mockup_studio_edit");

  const list = versions ?? [];
  const a = list.find((v) => v.id === compareA) ?? null;
  const b = list.find((v) => v.id === compareB) ?? null;

  const snapshot = () => {
    createVersion.mutate(
      { id: mockup.id, data: { versionName: name.trim() || `Version ${list.length + 1}`, notes: notes.trim() || undefined } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: getListMockupVersionsQueryKey(mockup.id) });
          setName(""); setNotes("");
          toast({ title: "Version saved", description: "Snapshot of the current saved mockup." });
        },
        onError: (e) => toast({ title: "Could not save version", description: errMessage(e), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard title="Save a version" icon={History} accent="violet">
          {canEdit ? (
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="field-input" placeholder={`Version name, e.g. "Round ${list.length + 1}"`} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="field-input" placeholder="What changed? (optional)" />
              {currentDirty && <p className="text-[11px] text-amber-600">You have unsaved edits — save the mockup first so the snapshot includes them.</p>}
              <button onClick={snapshot} disabled={createVersion.isPending} className="w-full rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40">
                {createVersion.isPending ? "Saving..." : "Snapshot current state"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Your role can view versions but not create them.</p>
          )}
        </SectionCard>
        <div className="lg:col-span-2">
          <SectionCard title={`Version history (${list.length})`} icon={GitCompare} accent="sky">
            {isLoading && <p className="py-4 text-center text-xs text-slate-400">Loading versions...</p>}
            {!isLoading && list.length === 0 && <EmptyState message="No versions yet. Snapshot the mockup to lock in a milestone you can compare against later." />}
            {list.length > 0 && (
              <ul className="space-y-1.5">
                {list.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700">{v.versionName}</p>
                      <p className="text-[10px] text-slate-400">{v.createdByName} · {new Date(v.createdAt).toLocaleString()}{v.notes ? ` · ${v.notes}` : ""}</p>
                    </div>
                    <button onClick={() => setCompareA(v.id)} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${compareA === v.id ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>A</button>
                    <button onClick={() => setCompareB(v.id)} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${compareB === v.id ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>B</button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
      {a && b && a.id !== b.id && (
        <SectionCard title={`Compare: ${a.versionName} vs ${b.versionName}`} icon={GitCompare} accent="violet">
          <div className="grid gap-4 md:grid-cols-2">
            {[a, b].map((v, i) => (
              <VersionCard key={v.id} version={v} tag={i === 0 ? "A" : "B"} />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function VersionCard({ version, tag }: { version: MockupVersionRecord; tag: string }) {
  const c = version.content;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${tag === "A" ? "bg-violet-500" : "bg-sky-500"}`}>{tag}</span>
        <p className="text-sm font-bold text-slate-800">{version.versionName}</p>
      </div>
      <dl className="space-y-1.5 text-xs">
        <div><dt className="font-semibold text-slate-400">Goal</dt><dd className="text-slate-700">{c.brief.mainGoal || "—"}</dd></div>
        <div><dt className="font-semibold text-slate-400">Must-haves</dt><dd className="text-slate-700">{c.brief.mustHaveFeatures || "—"}</dd></div>
        <div><dt className="font-semibold text-slate-400">Screens ({c.screens.length})</dt><dd className="text-slate-700">{c.screens.map((s) => `${s.name} (${s.blocks.length})`).join(", ") || "—"}</dd></div>
        <div><dt className="font-semibold text-slate-400">Visual</dt><dd className="text-slate-700">{[c.visualDirection.mood, c.visualDirection.colorDirection, c.visualDirection.navigationStyle].filter(Boolean).join(" · ") || "—"}</dd></div>
        <div><dt className="font-semibold text-slate-400">Approval</dt><dd className="text-slate-700">{c.brief.approvalNeeded}</dd></div>
      </dl>
    </div>
  );
}
