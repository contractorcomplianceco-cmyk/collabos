import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type {
  Role,
  Idea,
  IdeaStatus,
  Recommendation,
  ApprovalStatus,
  MindMeldItem,
  Handoff,
  FeedbackItem,
  AppSettings,
  AuditEntry,
} from "@/types";
import {
  ideas as seedIdeas,
  recommendations as seedRecommendations,
  mindMeldItems as seedMindMeld,
  handoffs as seedHandoffs,
  feedbackItems as seedFeedback,
  defaultSettings,
} from "@/data/seed";
import { routeMindMeld, canApprove } from "@/lib/helpers";

export type { Role };

const STORAGE_KEY = "roseos_state_v1";

interface PersistedState {
  currentRole: Role;
  ideas: Idea[];
  recommendations: Recommendation[];
  mindMeldItems: MindMeldItem[];
  handoffs: Handoff[];
  feedbackItems: FeedbackItem[];
  settings: AppSettings;
}

interface AppState extends PersistedState {
  setCurrentRole: (role: Role) => void;
  isRoseBrainOpen: boolean;
  setRoseBrainOpen: (open: boolean) => void;
  roseBrainContext: string;
  setRoseBrainContext: (ctx: string) => void;
  submitIdea: (idea: Omit<Idea, "id" | "createdAt">) => void;
  updateIdeaStatus: (id: string, status: IdeaStatus) => void;
  setRecommendationStatus: (id: string, status: ApprovalStatus, actor: string) => void;
  addRecommendation: (rec: Omit<Recommendation, "id" | "history" | "status">) => void;
  carmenfy: (itemId: string, note: string) => void;
  rosify: (itemId: string, note: string) => void;
  addMindMeldThought: (itemId: string, owner: "Rose" | "Carmen", text: string) => void;
  addFeedback: (item: Omit<FeedbackItem, "id" | "count">) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetData: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

function freshState(): PersistedState {
  return {
    currentRole: "Rose",
    ideas: seedIdeas,
    recommendations: seedRecommendations,
    mindMeldItems: seedMindMeld,
    handoffs: seedHandoffs,
    feedbackItems: seedFeedback,
    settings: defaultSettings,
  };
}

function load(): PersistedState {
  if (typeof localStorage === "undefined") return freshState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return { ...freshState(), ...parsed };
  } catch {
    return freshState();
  }
}

const now = () =>
  new Date().toISOString().slice(0, 16).replace("T", " ");

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => freshState());
  const [isRoseBrainOpen, setRoseBrainOpen] = useState(false);
  const [roseBrainContext, setRoseBrainContext] = useState("Collab Dashboard");

  useEffect(() => {
    setState(load());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  const setCurrentRole = useCallback((role: Role) => {
    setState((s) => ({ ...s, currentRole: role }));
  }, []);

  const submitIdea = useCallback((idea: Omit<Idea, "id" | "createdAt">) => {
    setState((s) => ({
      ...s,
      ideas: [
        { ...idea, id: uid("i"), createdAt: now().slice(0, 10) },
        ...s.ideas,
      ],
    }));
  }, []);

  const updateIdeaStatus = useCallback((id: string, status: IdeaStatus) => {
    setState((s) => ({
      ...s,
      ideas: s.ideas.map((i) => (i.id === id ? { ...i, status } : i)),
    }));
  }, []);

  const setRecommendationStatus = useCallback(
    (id: string, status: ApprovalStatus, actor: string) => {
      setState((s) => ({
        ...s,
        recommendations: s.recommendations.map((r) => {
          if (r.id !== id) return r;

          // Authorization guard: only roles permitted by the approval route may
          // change a recommendation's status. Unauthorized actors are a no-op.
          if (!canApprove(actor as Role, r.requiredApprover)) return r;

          // Dual approval: a "both" route needs BOTH Rose and Carmen to approve
          // before it is finalized. One approval alone leaves it pending.
          if (status === "approved" && r.requiredApprover === "both") {
            const approvals = { ...(r.approvals ?? { rose: false, carmen: false }) };
            if (actor === "Rose") approvals.rose = true;
            else if (actor === "Carmen") approvals.carmen = true;
            else if (actor === "Admin") {
              approvals.rose = true;
              approvals.carmen = true;
            }
            const fully = approvals.rose && approvals.carmen;
            const waitingOn = approvals.rose ? "Carmen" : "Rose";
            return {
              ...r,
              approvals,
              status: (fully ? "approved" : "pending") as ApprovalStatus,
              history: [
                ...r.history,
                {
                  id: uid("rh"),
                  timestamp: now(),
                  actor,
                  action: fully
                    ? "Final approval recorded (Rose + Carmen)"
                    : `Approved by ${actor} — awaiting ${waitingOn}`,
                } as AuditEntry,
              ],
            };
          }

          return {
            ...r,
            status,
            history: [
              ...r.history,
              {
                id: uid("rh"),
                timestamp: now(),
                actor,
                action: `Marked ${status}`,
              } as AuditEntry,
            ],
          };
        }),
      }));
    },
    [],
  );

  const addRecommendation = useCallback(
    (rec: Omit<Recommendation, "id" | "history" | "status">) => {
      setState((s) => ({
        ...s,
        recommendations: [
          {
            ...rec,
            id: uid("rc"),
            status: "pending" as ApprovalStatus,
            history: [
              { id: uid("rh"), timestamp: now(), actor: "Rose OS", action: "Recommendation created" },
            ],
          },
          ...s.recommendations,
        ],
      }));
    },
    [],
  );

  const carmenfy = useCallback((itemId: string, note: string) => {
    const route = routeMindMeld("carmenfy");
    setState((s) => ({
      ...s,
      mindMeldItems: s.mindMeldItems.map((m) =>
        m.id === itemId
          ? {
              ...m,
              status: "with-carmen",
              nextHandoff: "carmen",
              history: [
                ...m.history,
                { id: uid("h"), timestamp: now(), actor: "Rose", action: "Carmenfied — routed to Carmen" },
              ],
            }
          : m,
      ),
      handoffs: [
        {
          id: uid("ho"),
          itemId,
          itemTitle: s.mindMeldItems.find((m) => m.id === itemId)?.title ?? "Item",
          from: "Rose",
          to: "Carmen",
          layer: "Execution",
          timestamp: now(),
          note: note || route.reason,
        },
        ...s.handoffs,
      ],
    }));
  }, []);

  const rosify = useCallback((itemId: string, note: string) => {
    const route = routeMindMeld("rosify");
    setState((s) => ({
      ...s,
      mindMeldItems: s.mindMeldItems.map((m) =>
        m.id === itemId
          ? {
              ...m,
              status: "with-rose",
              nextHandoff: "rose",
              history: [
                ...m.history,
                { id: uid("h"), timestamp: now(), actor: "Carmen", action: "Rosified — routed to Rose" },
              ],
            }
          : m,
      ),
      handoffs: [
        {
          id: uid("ho"),
          itemId,
          itemTitle: s.mindMeldItems.find((m) => m.id === itemId)?.title ?? "Item",
          from: "Carmen",
          to: "Rose",
          layer: "Strategy",
          timestamp: now(),
          note: note || route.reason,
        },
        ...s.handoffs,
      ],
    }));
  }, []);

  const addMindMeldThought = useCallback(
    (itemId: string, owner: "Rose" | "Carmen", text: string) => {
      setState((s) => ({
        ...s,
        mindMeldItems: s.mindMeldItems.map((m) =>
          m.id === itemId
            ? {
                ...m,
                roseThoughts: owner === "Rose" ? text : m.roseThoughts,
                carmenThoughts: owner === "Carmen" ? text : m.carmenThoughts,
                history: [
                  ...m.history,
                  { id: uid("h"), timestamp: now(), actor: owner, action: "Added a thought" },
                ],
              }
            : m,
        ),
      }));
    },
    [],
  );

  const addFeedback = useCallback((item: Omit<FeedbackItem, "id" | "count">) => {
    setState((s) => ({
      ...s,
      feedbackItems: [{ ...item, id: uid("f"), count: 1 }, ...s.feedbackItems],
    }));
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const resetData = useCallback(() => {
    const fresh = freshState();
    fresh.currentRole = state.currentRole;
    setState(fresh);
  }, [state.currentRole]);

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        setCurrentRole,
        isRoseBrainOpen,
        setRoseBrainOpen,
        roseBrainContext,
        setRoseBrainContext,
        submitIdea,
        updateIdeaStatus,
        setRecommendationStatus,
        addRecommendation,
        carmenfy,
        rosify,
        addMindMeldThought,
        addFeedback,
        updateSettings,
        resetData,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
