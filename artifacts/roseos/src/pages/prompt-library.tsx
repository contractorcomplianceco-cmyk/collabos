import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import {
  BookMarked, Copy, Pencil, Plus, Search, Send, Trash2, X, Filter, Share2,
} from "lucide-react";
import { PageHeader, EmptyState, SectionCard } from "@/components/shared";
import { useAppState } from "@/hooks/use-app-state";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  PROMPT_INTENT_LABEL,
  PROMPT_INTENTS,
  PROMPTS_QUERY_KEY,
  createPrompt,
  deletePrompt,
  listPrompts,
  sharePrompt,
  updatePrompt,
  type PromptIntent,
  type PromptRecord,
  type PromptSharedWith,
} from "@/lib/prompts-api";

type Draft = {
  title: string;
  body: string;
  intent: PromptIntent;
  projectId: string;
  tags: string;
};

const emptyDraft = (): Draft => ({
  title: "",
  body: "",
  intent: "handoff",
  projectId: "",
  tags: "",
});

function parseTags(raw: string): string[] {
  return raw
    .split(/[,#]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

export default function PromptLibraryPage() {
  const { user } = useAuth();
  const { projects } = useAppState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const { data: prompts = [], isLoading } = useQuery({
    queryKey: PROMPTS_QUERY_KEY,
    queryFn: listPrompts,
  });

  const [intentFilter, setIntentFilter] = useState<PromptIntent | "all" | "shared">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const focus = params.get("focus");
    if (focus && /^\d+$/.test(focus)) setFocusId(Number(focus));
  }, [search]);

  useEffect(() => {
    if (focusId == null) return;
    const el = document.getElementById(`prompt-${focusId}`);
    if (el) window.setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [focusId, prompts]);

  const role = user?.role ?? "";
  const isRose = role === "rose_admin" || role === "super_admin";
  const isCarmen = role === "carmen_admin" || role === "super_admin";
  const meKey = isRose ? "rose" : isCarmen ? "carmen" : null;

  const projectName = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return prompts.filter((p) => {
      if (intentFilter === "shared") {
        if (!p.sharedWith) return false;
        if (meKey === "rose" && p.sharedWith !== "rose" && p.sharedWith !== "both") return false;
        if (meKey === "carmen" && p.sharedWith !== "carmen" && p.sharedWith !== "both") return false;
      } else if (intentFilter !== "all" && p.intent !== intentFilter) {
        return false;
      }
      if (projectFilter !== "all") {
        if (projectFilter === "none") {
          if (p.projectId != null) return false;
        } else if (String(p.projectId) !== projectFilter) {
          return false;
        }
      }
      if (!needle) return true;
      const blob = `${p.title} ${p.body} ${p.tags.join(" ")} ${p.createdBy} ${PROMPT_INTENT_LABEL[p.intent]} ${p.projectId ? projectName[p.projectId] ?? "" : ""}`.toLowerCase();
      return needle.split(/\s+/).every((part) => blob.includes(part));
    });
  }, [prompts, intentFilter, projectFilter, q, meKey, projectName]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: PROMPTS_QUERY_KEY });
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setShowForm(true);
  };

  const startEdit = (p: PromptRecord) => {
    setEditingId(p.id);
    setDraft({
      title: p.title,
      body: p.body,
      intent: p.intent,
      projectId: p.projectId != null ? String(p.projectId) : "",
      tags: p.tags.join(", "),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast({ title: "Title and prompt text are required", variant: "destructive" });
      return;
    }
    const payload = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      intent: draft.intent,
      projectId: draft.projectId ? Number(draft.projectId) : null,
      tags: parseTags(draft.tags),
    };
    try {
      if (editingId != null) {
        await updatePrompt(editingId, payload);
        toast({ title: "Prompt updated" });
      } else {
        await createPrompt(payload);
        toast({ title: "Prompt saved" });
      }
      setShowForm(false);
      setEditingId(null);
      setDraft(emptyDraft());
      await refresh();
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    }
  };

  const copyBody = async (p: PromptRecord) => {
    try {
      await navigator.clipboard.writeText(p.body);
      toast({ title: "Copied", description: "Paste into Rose’s AI or your Cursor chat." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text and copy manually.", variant: "destructive" });
    }
  };

  const markShared = async (p: PromptRecord, sharedWith: PromptSharedWith) => {
    setBusyId(p.id);
    try {
      await sharePrompt(p.id, sharedWith);
      const who = sharedWith === "both" ? "Rose & Carmen" : sharedWith === "rose" ? "Rose" : "Carmen";
      toast({ title: "Marked shared", description: `${p.title} is marked shared with ${who}.` });
      await refresh();
    } catch (e) {
      toast({
        title: "Could not share",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: PromptRecord) => {
    if (!window.confirm(`Delete “${p.title}”? You can recreate it later from a seed or new entry.`)) return;
    setBusyId(p.id);
    try {
      await deletePrompt(p.id);
      toast({ title: "Prompt deleted" });
      await refresh();
    } catch (e) {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Prompt Library"
        subtitle="Reusable prompts and AI reply templates — saved by what you need them for, optionally tied to a project. Not the same as Mind Meld (think together) or Review Queue (stamp decisions)."
        icon={BookMarked}
        accent="violet"
        actions={
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
          >
            <Plus className="h-3.5 w-3.5" /> New prompt
          </button>
        }
      />

      <p className="text-xs text-slate-500">
        Saved by what you need the prompt for — optionally tied to a project.{" "}
        <Link href="/mind-meld" className="font-semibold text-violet-600 hover:underline">Mind Meld</Link>
        {" "}= think together ·{" "}
        <Link href="/review-queue" className="font-semibold text-rose-600 hover:underline">Review Queue</Link>
        {" "}= stamp decisions ·{" "}
        <Link href="/agent-queue" className="font-semibold text-slate-700 hover:underline">Cursor Direct Requests</Link>
        {" "}= build work.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-slate-400" />
        <button
          type="button"
          onClick={() => setIntentFilter("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${intentFilter === "all" ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setIntentFilter("shared")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${intentFilter === "shared" ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
        >
          Shared with me
        </button>
        {PROMPT_INTENTS.map((intent) => (
          <button
            key={intent}
            type="button"
            onClick={() => setIntentFilter(intent)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${intentFilter === intent ? "bg-violet-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {PROMPT_INTENT_LABEL[intent]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Project
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            <option value="all">Any project</option>
            <option value="none">No project tag</option>
            {projects.map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </label>
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, body, tags…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>
      </div>

      {showForm && (
        <SectionCard title={editingId != null ? "Edit prompt" : "New prompt"} icon={Pencil} accent="violet">
          <div className="space-y-3">
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <div className="flex flex-wrap gap-3">
              <label className="text-xs text-slate-500">
                Intent
                <select
                  value={draft.intent}
                  onChange={(e) => setDraft((d) => ({ ...d, intent: e.target.value as PromptIntent }))}
                  className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                  {PROMPT_INTENTS.map((intent) => (
                    <option key={intent} value={intent}>{PROMPT_INTENT_LABEL[intent]}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Project (optional)
                <select
                  value={draft.projectId}
                  onChange={(e) => setDraft((d) => ({ ...d, projectId: e.target.value }))}
                  className="mt-1 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-[12rem] flex-1 text-xs text-slate-500">
                Tags (comma-separated)
                <input
                  value={draft.tags}
                  onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                  placeholder="handoff, rose-ai"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Prompt text — what you’ll paste into an AI or Cursor…"
              rows={10}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="space-y-3">
        {isLoading && <p className="py-10 text-center text-sm text-slate-400">Loading prompts…</p>}
        {!isLoading && filtered.length === 0 && (
          <EmptyState
            message="No prompts match these filters."
            hint="Try All intents, clear search, or create a new prompt for a Rose ↔ Carmen AI reply."
            action={
              <button
                type="button"
                onClick={startCreate}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                New prompt
              </button>
            }
          />
        )}
        {!isLoading && filtered.map((p) => {
          const busy = busyId === p.id;
          const pname = p.projectId != null ? projectName[p.projectId] : null;
          return (
            <article
              key={p.id}
              id={`prompt-${p.id}`}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${focusId === p.id ? "border-violet-300 ring-2 ring-violet-100" : "border-slate-200"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{p.title}</h3>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-100">
                      {PROMPT_INTENT_LABEL[p.intent]}
                    </span>
                    {pname ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
                        {pname}
                      </span>
                    ) : null}
                    {p.sharedWith ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                        <Share2 className="h-3 w-3" />
                        Shared · {p.sharedWith === "both" ? "Rose & Carmen" : p.sharedWith === "rose" ? "Rose" : "Carmen"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    By {p.createdBy} · Updated {new Date(p.updatedAt).toLocaleString()}
                    {p.tags.length > 0 ? ` · ${p.tags.map((t) => `#${t}`).join(" ")}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void copyBody(p)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(p)}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  {isCarmen || isRose ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void markShared(p, isCarmen ? "rose" : "carmen")}
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                      title="Mark shared so the other person sees it under Shared with me"
                    >
                      <Send className="h-3 w-3" /> {isCarmen ? "Send to Rose" : "Send to Carmen"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void markShared(p, "both")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <Share2 className="h-3 w-3" /> Mark shared
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(p)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
              <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                {p.body}
              </pre>
            </article>
          );
        })}
      </div>
    </div>
  );
}
