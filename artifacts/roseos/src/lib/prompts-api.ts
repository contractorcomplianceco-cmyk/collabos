export type PromptIntent =
  | "handoff"
  | "security"
  | "design"
  | "audit"
  | "cursor-brief"
  | "marketing"
  | "general";

export type PromptSharedWith = "rose" | "carmen" | "both";

export type PromptRecord = {
  id: number;
  title: string;
  body: string;
  intent: PromptIntent;
  projectId: number | null;
  tags: string[];
  createdBy: string;
  createdById: number | null;
  sharedWith: PromptSharedWith | null;
  sharedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const PROMPT_INTENT_LABEL: Record<PromptIntent, string> = {
  handoff: "Handoff / reply-to-AI",
  security: "Security",
  design: "Design / UX",
  audit: "Audit / compliance",
  "cursor-brief": "Cursor / build brief",
  marketing: "Marketing / ops",
  general: "General",
};

export const PROMPT_INTENTS = Object.keys(PROMPT_INTENT_LABEL) as PromptIntent[];

export const PROMPTS_QUERY_KEY = ["prompts"] as const;

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listPrompts(): Promise<PromptRecord[]> {
  return apiJson("/prompts");
}

export function createPrompt(input: {
  title: string;
  body: string;
  intent: PromptIntent;
  projectId?: number | null;
  tags?: string[];
}): Promise<PromptRecord> {
  return apiJson("/prompts", { method: "POST", body: JSON.stringify(input) });
}

export function updatePrompt(
  id: number,
  input: Partial<{
    title: string;
    body: string;
    intent: PromptIntent;
    projectId: number | null;
    tags: string[];
    sharedWith: PromptSharedWith | null;
  }>,
): Promise<PromptRecord> {
  return apiJson(`/prompts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function sharePrompt(id: number, sharedWith: PromptSharedWith): Promise<PromptRecord> {
  return apiJson(`/prompts/${id}/share`, { method: "POST", body: JSON.stringify({ sharedWith }) });
}

export function deletePrompt(id: number): Promise<PromptRecord> {
  return apiJson(`/prompts/${id}`, { method: "DELETE" });
}
