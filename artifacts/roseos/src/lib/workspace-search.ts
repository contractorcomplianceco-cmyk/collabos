import type { AgentWorkItem, Project, Recommendation, Task } from "@/types";
import { PROMPT_INTENT_LABEL, type PromptRecord } from "@/lib/prompts-api";

export type SearchHitKind = "page" | "project" | "task" | "decision" | "cursor" | "prompt";

export type SearchHit = {
  id: string;
  kind: SearchHitKind;
  title: string;
  subtitle: string;
  href: string;
};

export type NavSearchItem = {
  href: string;
  label: string;
  blurb?: string;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesQuery(haystack: string, q: string): boolean {
  if (!q) return false;
  const h = norm(haystack);
  const parts = norm(q).split(" ").filter(Boolean);
  return parts.every((p) => h.includes(p));
}

function clientCodes(tags: string[] | undefined): string[] {
  return (tags ?? [])
    .filter((t) => t.toLowerCase().startsWith("client-code:"))
    .map((t) => t.slice("client-code:".length).toUpperCase())
    .filter(Boolean);
}

/** Match FRR / EC / ALD in query or tags / names. */
function matchesClientCode(query: string, tags: string[] | undefined, name: string): boolean {
  const q = norm(query);
  const codes = clientCodes(tags);
  if (codes.some((c) => q.includes(c.toLowerCase()) || matchesQuery(c, query))) return true;
  // bare codes typed by the user
  for (const code of ["frr", "ec", "ald"]) {
    if (q === code || q.includes(` ${code} `) || q.startsWith(`${code} `) || q.endsWith(` ${code}`)) {
      if (codes.some((c) => c.toLowerCase() === code) || norm(name).includes(code)) return true;
    }
  }
  return false;
}

export function searchWorkspace(opts: {
  query: string;
  nav: NavSearchItem[];
  projects: Project[];
  tasks: Task[];
  recommendations: Recommendation[];
  agentWork: AgentWorkItem[];
  prompts?: PromptRecord[];
  limit?: number;
}): SearchHit[] {
  const q = opts.query.trim();
  const limit = opts.limit ?? 24;
  const hits: SearchHit[] = [];
  const projectName = Object.fromEntries(opts.projects.map((p) => [p.id, p.name]));

  if (!q) {
    for (const n of opts.nav.slice(0, 8)) {
      hits.push({
        id: `page:${n.href}`,
        kind: "page",
        title: n.label,
        subtitle: n.blurb ?? "Go to page",
        href: n.href,
      });
    }
    return hits;
  }

  for (const n of opts.nav) {
    if (matchesQuery(`${n.label} ${n.blurb ?? ""}`, q)) {
      hits.push({
        id: `page:${n.href}`,
        kind: "page",
        title: n.label,
        subtitle: n.blurb ?? "Page",
        href: n.href,
      });
    }
  }

  for (const p of opts.projects) {
    const codes = clientCodes(p.tags);
    const blob = `${p.name} ${p.description} ${p.department} ${codes.join(" ")} ${(p.tags ?? []).join(" ")}`;
    if (matchesQuery(blob, q) || matchesClientCode(q, p.tags, p.name)) {
      hits.push({
        id: `project:${p.id}`,
        kind: "project",
        title: p.name,
        subtitle: codes.length ? `Project · ${codes.join(", ")}` : "Project",
        href: `/projects?expand=${encodeURIComponent(p.id)}`,
      });
    }
  }

  for (const t of opts.tasks) {
    const pname = projectName[t.projectId] ?? "Project";
    if (matchesQuery(`${t.title} ${pname} ${t.owner ?? ""}`, q)) {
      hits.push({
        id: `task:${t.id}`,
        kind: "task",
        title: t.title,
        subtitle: `Task · ${pname}${t.owner ? ` · ${t.owner}` : ""}`,
        href: `/project-tasks?task=${encodeURIComponent(t.id)}&project=${encodeURIComponent(t.projectId)}`,
      });
    }
  }

  for (const r of opts.recommendations) {
    const pname = r.projectId ? projectName[r.projectId] : null;
    if (matchesQuery(`${r.recommendation} ${r.source} ${r.category} ${pname ?? ""}`, q)) {
      hits.push({
        id: `decision:${r.id}`,
        kind: "decision",
        title: r.recommendation.length > 72 ? `${r.recommendation.slice(0, 69)}…` : r.recommendation,
        subtitle: pname ? `Decision · ${pname}` : "Decision / recommendation",
        href: `/review-queue?focus=${encodeURIComponent(r.id)}`,
      });
    }
  }

  for (const w of opts.agentWork) {
    const pname = w.relatedProjectId ? projectName[w.relatedProjectId] : null;
    if (matchesQuery(`${w.title} ${w.description} ${w.affectedModule} ${pname ?? ""}`, q)) {
      hits.push({
        id: `cursor:${w.id}`,
        kind: "cursor",
        title: w.title,
        subtitle: pname ? `Cursor request · ${pname}` : "Cursor request",
        href: `/agent-queue?focus=${encodeURIComponent(w.id)}`,
      });
    }
  }

  for (const p of opts.prompts ?? []) {
    const pname = p.projectId != null ? projectName[String(p.projectId)] ?? projectName[p.projectId] : null;
    const intentLabel = PROMPT_INTENT_LABEL[p.intent] ?? p.intent;
    if (matchesQuery(`${p.title} ${p.body} ${intentLabel} ${p.tags.join(" ")} ${p.createdBy} ${pname ?? ""}`, q)) {
      hits.push({
        id: `prompt:${p.id}`,
        kind: "prompt",
        title: p.title,
        subtitle: pname ? `Prompt · ${intentLabel} · ${pname}` : `Prompt · ${intentLabel}`,
        href: `/prompt-library?focus=${encodeURIComponent(String(p.id))}`,
      });
    }
  }

  return hits.slice(0, limit);
}

export const SEARCH_KIND_LABEL: Record<SearchHitKind, string> = {
  page: "Pages",
  project: "Projects",
  task: "Tasks",
  decision: "Decisions",
  cursor: "Cursor requests",
  prompt: "Prompts",
};
