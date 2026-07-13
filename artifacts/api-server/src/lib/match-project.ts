import { db, projectsTable, type ProjectRow } from "@workspace/db";
import { asc } from "drizzle-orm";

export type ProjectMatch = { id: number; name: string };

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreProject(haystack: string, project: ProjectRow): number {
  const name = normalize(project.name);
  if (!name) return 0;
  let score = 0;
  if (haystack.includes(name)) {
    score += 100 + Math.min(name.length, 40);
  } else {
    const tokens = name.split(" ").filter((t) => t.length >= 4);
    const hit = tokens.filter((t) => haystack.includes(t)).length;
    if (hit > 0 && hit === tokens.length) score += 40 + hit * 5;
    else if (hit >= 2) score += 20 + hit * 3;
  }
  for (const tag of project.tags ?? []) {
    const t = normalize(tag);
    if (!t || t.startsWith("sync:")) continue;
    if (t.startsWith("client-code:")) {
      const code = t.slice("client-code:".length);
      if (code && (haystack.includes(code.toLowerCase()) || haystack.includes(t))) score += 50;
      continue;
    }
    if (t.length >= 4 && haystack.includes(t)) score += 15;
  }
  return score;
}

export async function loadProjectsForMatch(): Promise<ProjectRow[]> {
  return db.select().from(projectsTable).orderBy(asc(projectsTable.sortOrder), asc(projectsTable.name));
}

/** Best project match from recommendation text / tags / source. Falls back to CollabOS when possible. */
export function matchProjectFromText(
  text: string,
  projects: ProjectRow[],
  extra = "",
): ProjectMatch | null {
  const haystack = normalize(`${text} ${extra}`);
  if (!haystack || projects.length === 0) return null;

  let best: { project: ProjectRow; score: number } | null = null;
  for (const project of projects) {
    const score = scoreProject(haystack, project);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { project, score };
  }
  if (best && best.score >= 20) {
    return { id: best.project.id, name: best.project.name };
  }

  const collabos = projects.find((p) => normalize(p.name) === "collabos");
  if (collabos) return { id: collabos.id, name: collabos.name };
  return { id: projects[0].id, name: projects[0].name };
}

export async function resolveProjectForRecommendation(
  recommendationText: string,
  source = "",
  existingProjectId?: number | null,
): Promise<ProjectMatch | null> {
  const projects = await loadProjectsForMatch();
  if (existingProjectId) {
    const found = projects.find((p) => p.id === existingProjectId);
    if (found) return { id: found.id, name: found.name };
  }
  return matchProjectFromText(recommendationText, projects, source);
}
