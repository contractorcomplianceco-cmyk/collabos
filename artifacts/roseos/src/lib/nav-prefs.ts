/** Client-side nav prefs: recent, pinned, sticky list filters. */

const PREFIX = "collabos.nav";

function key(userKey: string, part: string): string {
  return `${PREFIX}.${userKey}.${part}`;
}

function readJson<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(storageKey: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export type RecentEntry = {
  id: string;
  kind: "project" | "page";
  label: string;
  href: string;
  visitedAt: number;
};

const MAX_RECENT = 5;
const MAX_PINNED = 8;

export function getRecent(userKey: string): RecentEntry[] {
  const list = readJson<RecentEntry[]>(key(userKey, "recent"), []);
  return Array.isArray(list) ? list.slice(0, MAX_RECENT) : [];
}

export function pushRecent(userKey: string, entry: Omit<RecentEntry, "visitedAt">): RecentEntry[] {
  const next: RecentEntry = { ...entry, visitedAt: Date.now() };
  const prev = getRecent(userKey).filter((r) => !(r.kind === entry.kind && r.id === entry.id));
  const list = [next, ...prev].slice(0, MAX_RECENT);
  writeJson(key(userKey, "recent"), list);
  return list;
}

export function getPinnedProjectIds(userKey: string): string[] {
  const list = readJson<string[]>(key(userKey, "pinned"), []);
  return Array.isArray(list) ? list.slice(0, MAX_PINNED) : [];
}

export function togglePinnedProject(userKey: string, projectId: string): string[] {
  const id = String(projectId);
  const prev = getPinnedProjectIds(userKey);
  const next = prev.includes(id) ? prev.filter((p) => p !== id) : [id, ...prev].slice(0, MAX_PINNED);
  writeJson(key(userKey, "pinned"), next);
  return next;
}

export function isPinnedProject(userKey: string, projectId: string): boolean {
  return getPinnedProjectIds(userKey).includes(String(projectId));
}

/** Sticky filters — restore last choice per user; empty string means “use page default”. */
export function getStickyFilter(userKey: string, page: string): string {
  return readJson<string>(key(userKey, `filter.${page}`), "");
}

export function setStickyFilter(userKey: string, page: string, value: string): void {
  writeJson(key(userKey, `filter.${page}`), value);
}
