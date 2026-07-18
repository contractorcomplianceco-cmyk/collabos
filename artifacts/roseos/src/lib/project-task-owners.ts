/** Owner buckets for Project Tasks open-work columns. */
export type ProjectTaskOwnerBucket = "rose" | "carmen" | "team";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Infer Rose/Carmen from titles like "Rose: …" / "Carmen: …". */
export function inferOwnerFromTitle(title: string | null | undefined): ProjectTaskOwnerBucket | null {
  const t = normalizeKey(title ?? "");
  if (!t) return null;
  if (/^rose\s*:/.test(t) || /^rose\s*[—–-]\s*/.test(t)) return "rose";
  if (/^carmen\s*:/.test(t) || /^carmen\s*[—–-]\s*/.test(t)) return "carmen";
  return null;
}

/**
 * Bucket a project task by owner (and title prefix when owner is missing).
 * Recognizes Rose / Rose Taylor / Carmen / Carmen Vega and similar.
 */
export function bucketProjectTaskOwner(
  owner: string | null | undefined,
  title?: string | null,
): ProjectTaskOwnerBucket {
  const key = normalizeKey(owner ?? "");
  if (!key) {
    return inferOwnerFromTitle(title) ?? "team";
  }

  const hasRose =
    key === "rose" ||
    key.startsWith("rose ") ||
    key.includes("rose taylor") ||
    key.includes("rose almeida") ||
    /(^|[^a-z])rose([^a-z]|$)/.test(key);
  const hasCarmen =
    key === "carmen" ||
    key.startsWith("carmen ") ||
    key.includes("carmen vega") ||
    /(^|[^a-z])carmen([^a-z]|$)/.test(key);

  if (hasRose && hasCarmen) return "team";
  if (hasRose) return "rose";
  if (hasCarmen) return "carmen";
  return "team";
}

/** Sort key for completed history (newest first). */
export function projectTaskCompletedSortKey(task: {
  completedAt?: string | null;
  createdAt?: string | null;
}): number {
  const raw = task.completedAt || task.createdAt;
  if (!raw) return 0;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? ts : 0;
}

/** Human date for completed history rows. */
export function formatProjectTaskCompletedDate(task: {
  completedAt?: string | null;
  createdAt?: string | null;
}): string | null {
  const raw = task.completedAt || task.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
