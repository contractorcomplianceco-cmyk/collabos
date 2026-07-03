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
  IntakeItem,
  IntakeSource,
  IntakeDestination,
  IntakeReviewOwner,
  ApprovalRoute,
  MemoryCandidate,
  MemoryDestination,
  MindMeldTimelineEvent,
} from "@/types";
import {
  ideas as seedIdeas,
  recommendations as seedRecommendations,
  mindMeldItems as seedMindMeld,
  handoffs as seedHandoffs,
  feedbackItems as seedFeedback,
  seedIntakeItems,
  seedMemoryCandidates,
  seedMeldTimeline,
  projects as seedProjects,
  defaultSettings,
} from "@/data/seed";
import {
  routeMindMeld,
  canApprove,
  canSubmit,
  classifyIntakeMessage,
  summarizeIntakeMessage,
  detectIntakeDuplicates,
} from "@/lib/helpers";

export type { Role };

const STORAGE_KEY = "roseos_state_v1";

interface PersistedState {
  currentRole: Role;
  ideas: Idea[];
  recommendations: Recommendation[];
  mindMeldItems: MindMeldItem[];
  handoffs: Handoff[];
  feedbackItems: FeedbackItem[];
  intakeItems: IntakeItem[];
  memoryCandidates: MemoryCandidate[];
  meldTimeline: MindMeldTimelineEvent[];
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
  addIntakeItem: (input: {
    source: IntakeSource;
    sourceChannel: string;
    senderName: string;
    senderHandle: string;
    senderRole?: string | null;
    rawMessage: string;
  }) => void;
  updateIntakeItem: (id: string, patch: Partial<IntakeItem>, actor: string, action: string) => void;
  routeIntakeItem: (
    id: string,
    destination: IntakeDestination,
    actor: string,
    ownerOverride?: IntakeReviewOwner,
  ) => void;
  addMemoryCandidate: (input: {
    sourceIntakeId: string | null;
    summary: string;
    destination: MemoryDestination;
    sensitive: boolean;
    createdBy: string;
  }) => void;
  setMemoryCandidateStatus: (id: string, status: MemoryCandidate["status"], actor: string) => void;
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
    intakeItems: seedIntakeItems,
    memoryCandidates: seedMemoryCandidates,
    meldTimeline: seedMeldTimeline,
    settings: defaultSettings,
  };
}

function load(): PersistedState {
  if (typeof localStorage === "undefined") return freshState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      ...freshState(),
      ...parsed,
      settings: { ...defaultSettings, ...parsed.settings },
    };
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
    setState((s) => {
      // Authorization guard: read-only roles (e.g. Viewer) cannot mutate ideas.
      if (!canSubmit(s.currentRole)) return s;
      return {
        ...s,
        ideas: s.ideas.map((i) => (i.id === id ? { ...i, status } : i)),
      };
    });
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

  const addIntakeItem = useCallback(
    (input: {
      source: IntakeSource;
      sourceChannel: string;
      senderName: string;
      senderHandle: string;
      senderRole?: string | null;
      rawMessage: string;
    }) => {
      const classification = classifyIntakeMessage(input.rawMessage);
      const dup = detectIntakeDuplicates(
        input.rawMessage,
        seedProjects.map((p) => ({ name: p.name, keywords: p.tags })),
      );
      const sourceLabel =
        input.source === "zoho_cliq" ? "Zoho Cliq" : input.source === "whatsapp" ? "WhatsApp" : "manual test entry";
      const item: IntakeItem = {
        id: uid("in"),
        source: input.source,
        sourceChannel: input.sourceChannel,
        senderName: input.senderName,
        senderHandle: input.senderHandle,
        senderRole: input.senderRole ?? null,
        receivedAt: now(),
        rawMessage: input.rawMessage,
        cleanedSummary: summarizeIntakeMessage(input.rawMessage),
        detectedType: classification.detectedType,
        suggestedDestination: classification.suggestedDestination,
        sensitivity: classification.sensitivity,
        reviewOwner: classification.reviewOwner,
        classificationReason: classification.reason,
        status: "new",
        duplicateRisk: dup.risk,
        relatedProjectNames: dup.relatedNames,
        reviewerNotes: "",
        finalActionTaken: null,
        nextStep: classification.nextStep,
        auditLog: [
          {
            id: uid("al"),
            timestamp: now(),
            actor: "System",
            action: `Captured from ${sourceLabel} (test mode) and classified as ${classification.detectedType.replace(/_/g, " ")}.`,
          },
        ],
      };
      setState((s) => ({
        ...s,
        intakeItems: [item, ...s.intakeItems],
        settings: { ...s.settings, lastTestMessageAt: now() },
      }));
    },
    [],
  );

  const updateIntakeItem = useCallback(
    (id: string, patch: Partial<IntakeItem>, actor: string, action: string) => {
      setState((s) => ({
        ...s,
        intakeItems: s.intakeItems.map((it) =>
          it.id === id
            ? {
                ...it,
                ...patch,
                auditLog: [
                  ...it.auditLog,
                  { id: uid("al"), timestamp: now(), actor, action },
                ],
              }
            : it,
        ),
      }));
    },
    [],
  );

  const routeIntakeItem = useCallback(
    (id: string, destination: IntakeDestination, actor: string, ownerOverride?: IntakeReviewOwner) => {
      setState((s) => {
        const item = s.intakeItems.find((it) => it.id === id);
        if (!item) return s;

        const sensitive = item.sensitivity !== "normal";
        const effectiveOwner: IntakeReviewOwner = ownerOverride ?? item.reviewOwner;
        const approver: ApprovalRoute =
          effectiveOwner === "Rose"
            ? "rose"
            : effectiveOwner === "Carmen"
              ? "carmen"
              : "both";

        let next = { ...s };
        let actionLabel = "";

        if (destination === "mind-meld") {
          const meldItem: MindMeldItem = {
            id: uid("mm"),
            title: item.cleanedSummary.slice(0, 60),
            source: "External Intake",
            owner: "Rose",
            status: "rose-thinking",
            roseThoughts: "",
            carmenThoughts: "",
            synthesis: `Safe summary: ${item.cleanedSummary}`,
            openQuestions: [item.nextStep],
            alignment: "needs-clarity",
            alignmentScore: 40,
            risk: sensitive ? "high" : "medium",
            privacy: "leadership-only",
            nextHandoff: null,
            finalOutcome: null,
            layers: ["Strategy"],
            focusAreas: ["External Intake"],
            sensitive: true,
            history: [
              {
                id: uid("h"),
                timestamp: now(),
                actor,
                action: "Created from External Intake — raw message stays in the intake record.",
              },
            ],
          };
          const timelineEvents: MindMeldTimelineEvent[] = [
            {
              id: uid("tl"),
              itemTitle: meldItem.title,
              type: "original-message",
              actor: "System",
              text: `Safe summary: ${item.cleanedSummary}`,
              timestamp: now(),
              sensitive,
              needs: "both",
              readyTo: null,
              finalized: false,
            },
            {
              id: uid("tl"),
              itemTitle: meldItem.title,
              type: "routing-action",
              actor: "System",
              text: `Routed from External Intake by ${actor} - private to leadership, raw message stays protected.`,
              timestamp: now(),
              sensitive,
              needs: "both",
              readyTo: null,
              finalized: false,
            },
          ];
          next = {
            ...next,
            mindMeldItems: [meldItem, ...s.mindMeldItems],
            meldTimeline: [...timelineEvents, ...s.meldTimeline],
          };
          actionLabel = "Sent to Rose/Carmen Mind Meld (private, safe summary only).";
        } else if (destination === "idea-backlog") {
          const idea: Idea = {
            id: uid("i"),
            title: item.cleanedSummary.slice(0, 60),
            description: item.rawMessage,
            submittedBy: item.senderName,
            status: "draft-idea",
            momentum: 1,
            cluster: null,
            benefits: [],
            risks: [],
            dependencies: [],
            approvalRoute: approver,
            createdAt: now().slice(0, 10),
          };
          next = { ...next, ideas: [idea, ...s.ideas] };
          actionLabel = "Draft idea created in the Idea Backlog (pending review).";
        } else if (destination === "no-action") {
          actionLabel = "Archived — no action taken.";
        } else {
          const destLabel: Record<string, string> = {
            "review-queue": "CollabOS Review Queue draft",
            "command-center-task": "Draft Command Center task",
            "build-registry": "Build Registry suggestion",
            "requirements-registry": "Requirements Registry suggestion",
            "automation-registry": "Automation Registry suggestion",
            "decision-log": "Decision Log suggestion",
            "company-brain-update": "Company Brain update proposal",
          };
          const rec: Recommendation = {
            id: uid("r"),
            source: "External Intake",
            category: "external-intake",
            recommendation: `${destLabel[destination]}: ${item.cleanedSummary}`,
            classification: sensitive ? "sensitive" : "pending-approval",
            risk: sensitive ? "high" : "medium",
            requiredApprover: approver,
            status: "pending",
            approvals: { rose: false, carmen: false },
            history: [
              {
                id: uid("h"),
                timestamp: now(),
                actor,
                action: `Drafted from external intake — requires approval before it becomes real work.`,
              },
            ],
          };
          next = { ...next, recommendations: [rec, ...s.recommendations] };
          actionLabel = `${destLabel[destination]} created (pending approval).`;
        }

        const overrideNote = ownerOverride && ownerOverride !== item.reviewOwner
          ? ` Reviewer set to ${ownerOverride}.`
          : "";
        next.intakeItems = s.intakeItems.map((it) =>
          it.id === id
            ? {
                ...it,
                status: destination === "no-action" ? "archived" : "routed",
                reviewOwner: effectiveOwner,
                finalActionTaken: actionLabel,
                auditLog: [
                  ...it.auditLog,
                  { id: uid("al"), timestamp: now(), actor, action: `${actionLabel}${overrideNote}` },
                ],
              }
            : it,
        );
        return next;
      });
    },
    [],
  );

  const addMemoryCandidate = useCallback(
    (input: {
      sourceIntakeId: string | null;
      summary: string;
      destination: MemoryDestination;
      sensitive: boolean;
      createdBy: string;
    }) => {
      setState((s) => {
        const candidate: MemoryCandidate = {
          id: uid("mc"),
          sourceIntakeId: input.sourceIntakeId,
          summary: input.summary,
          destination: input.destination,
          status: "proposed",
          sensitive: input.sensitive,
          createdBy: input.createdBy,
          createdAt: now(),
        };
        const intakeItems = input.sourceIntakeId
          ? s.intakeItems.map((it) =>
              it.id === input.sourceIntakeId
                ? {
                    ...it,
                    auditLog: [
                      ...it.auditLog,
                      {
                        id: uid("al"),
                        timestamp: now(),
                        actor: input.createdBy,
                        action: `Preserved as memory candidate (${input.destination.replace(/-/g, " ")}) - pending approval, nothing written yet.`,
                      },
                    ],
                  }
                : it,
            )
          : s.intakeItems;
        return { ...s, memoryCandidates: [candidate, ...s.memoryCandidates], intakeItems };
      });
    },
    [],
  );

  const setMemoryCandidateStatus = useCallback(
    (id: string, status: MemoryCandidate["status"], actor: string) => {
      setState((s) => ({
        ...s,
        memoryCandidates: s.memoryCandidates.map((mc) =>
          mc.id === id ? { ...mc, status, createdAt: mc.createdAt } : mc,
        ),
        intakeItems: s.intakeItems.map((it) => {
          const mc = s.memoryCandidates.find((m) => m.id === id);
          if (!mc || !mc.sourceIntakeId || it.id !== mc.sourceIntakeId) return it;
          return {
            ...it,
            auditLog: [
              ...it.auditLog,
              { id: uid("al"), timestamp: now(), actor, action: `Memory candidate ${status} by ${actor}.` },
            ],
          };
        }),
      }));
    },
    [],
  );

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
        addIntakeItem,
        updateIntakeItem,
        routeIntakeItem,
        addMemoryCandidate,
        setMemoryCandidateStatus,
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
