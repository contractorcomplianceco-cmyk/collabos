import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListRecommendations,
  createRecommendation,
  changeRecommendationStatus,
  getListRecommendationsQueryKey,
  useListIdeas,
  createIdea,
  updateIdeaStatus as updateIdeaStatusApi,
  getListIdeasQueryKey,
  useListMindMeldItems,
  useListMindMeldHandoffs,
  useListMindMeldTimeline,
  useListMindMeldFeed,
  createMindMeldItem,
  carmenfyMindMeldItem,
  rosifyMindMeldItem,
  addMindMeldThought as addMindMeldThoughtApi,
  getListMindMeldItemsQueryKey,
  getListMindMeldHandoffsQueryKey,
  getListMindMeldTimelineQueryKey,
  useListIntakeItems,
  createIntakeItem,
  updateIntakeItem as updateIntakeItemApi,
  getListIntakeItemsQueryKey,
  useListMemoryCandidates,
  createMemoryCandidate,
  updateMemoryCandidateStatus,
  getListMemoryCandidatesQueryKey,
  useListFeedbackItems,
  useListSentimentSignals,
  useListSops,
  createFeedbackItem,
  getListFeedbackItemsQueryKey,
  useGetAppSettings,
  updateAppSettings,
  getGetAppSettingsQueryKey,
  useListProjects,
  useListProjectBlockers,
  useListProjectBuildPlans,
  useListCompanyRecords,
  useListDecisions,
  useListAutomations,
  useListDuplicateRisks,
  useListAlerts,
  useListBuildItems,
  useListProjectTasks,
  useListMarketSignals,
  useListMarketCompetitors,
  useListReportTemplates,
  useListIntegrationStatus,
  useListAgentWorkItems,
  createAgentWorkItem,
  updateAgentWorkItem,
  addAgentWorkEvent,
  getListAgentWorkItemsQueryKey,
  createCompanyRecord,
  updateCompanyRecord,
  createProjectTask,
  updateProjectTask,
  updateProjectBuildPlan,
  createProjectBlocker,
  updateProjectBlocker,
  deleteProjectBlocker,
  getListCompanyRecordsQueryKey,
  getListProjectTasksQueryKey,
  getListProjectBuildPlansQueryKey,
  getListProjectBlockersQueryKey,
  type RecommendationRecord,
  type IdeaRecord,
  type MindMeldItemRecord,
  type MindMeldHandoffRecord,
  type MindMeldTimelineRecord,
  type MindFeedRecord,
  type IntakeItemRecord,
  type MemoryCandidateRecord,
  type FeedbackItemRecord,
  type SentimentSignalRecord,
  type SopRecord,
  type AppSettingsRecord,
  type ProjectRecord,
  type BlockerRecord,
  type ProjectBuildPlanRecord,
  type CompanyRecord as ApiCompanyRecord,
  type DecisionRecord,
  type AutomationRecord,
  type DuplicateRiskRecord,
  type AlertRecord,
  type BuildItemRecord,
  type ProjectTaskRecord,
  type MarketSignalRecord,
  type MarketCompetitorRecord,
  type ReportTemplateRecord,
  type IntegrationStatusRecord,
  type AgentWorkItemRecord,
} from "@workspace/api-client-react";
import type {
  Role,
  Idea,
  IdeaStatus,
  Recommendation,
  ApprovalStatus,
  MindMeldItem,
  Handoff,
  FeedbackItem,
  SentimentSignal,
  SOP,
  AppSettings,
  Project,
  Blocker,
  ProjectBuildPlan,
  Task,
  CompanyRecord,
  Decision,
  Automation,
  DuplicateRisk,
  Alert,
  BuildItem,
  MarketSignal,
  Competitor,
  Report,
  IntegrationStatus,
  MindFeedEntry,
  AgentWorkItem,
  AgentWorkType,
  AgentWorkPriority,
  AgentWorkStatus,
  AuditEntry,
  IntakeItem,
  IntakeSource,
  IntakeDestination,
  IntakeReviewOwner,
  ApprovalRoute,
  MemoryCandidate,
  MemoryDestination,
  MindMeldTimelineEvent,
  Classification,
} from "@/types";
import {
  defaultSettings,
} from "@/data/seed";
import {
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
}

interface AppState extends PersistedState {
  feedbackItems: FeedbackItem[];
  feedbackLoading: boolean;
  sentimentSignals: SentimentSignal[];
  sops: SOP[];
  teamPulseExtrasLoading: boolean;
  settings: AppSettings;
  settingsLoading: boolean;
  projects: Project[];
  blockers: Blocker[];
  buildPlans: ProjectBuildPlan[];
  projectTasks: Task[];
  projectsLoading: boolean;
  companyRecords: CompanyRecord[];
  decisions: Decision[];
  automations: Automation[];
  duplicateRisks: DuplicateRisk[];
  alerts: Alert[];
  buildItems: BuildItem[];
  registryLoading: boolean;
  marketSignals: MarketSignal[];
  competitors: Competitor[];
  marketPulseLoading: boolean;
  reports: Report[];
  reportsLoading: boolean;
  integrations: IntegrationStatus[];
  integrationsLoading: boolean;
  agentWorkItems: AgentWorkItem[];
  agentWorkLoading: boolean;
  memoryCandidates: MemoryCandidate[];
  memoryCandidatesLoading: boolean;
  intakeItems: IntakeItem[];
  intakeLoading: boolean;
  ideas: Idea[];
  ideasLoading: boolean;
  mindMeldItems: MindMeldItem[];
  handoffs: Handoff[];
  meldTimeline: MindMeldTimelineEvent[];
  mindFeed: MindFeedEntry[];
  mindMeldLoading: boolean;
  recommendations: Recommendation[];
  recommendationsLoading: boolean;
  setCurrentRole: (role: Role) => void;
  isRoseBrainOpen: boolean;
  setRoseBrainOpen: (open: boolean) => void;
  roseBrainContext: string;
  setRoseBrainContext: (ctx: string) => void;
  submitIdea: (idea: Omit<Idea, "id" | "createdAt">) => void;
  updateIdeaStatus: (id: string, status: IdeaStatus) => void;
  setRecommendationStatus: (id: string, status: ApprovalStatus, actor: string) => Promise<boolean>;
  addRecommendation: (rec: Omit<Recommendation, "id" | "history" | "status">) => Promise<void>;
  carmenfy: (itemId: string, note: string) => void;
  rosify: (itemId: string, note: string) => void;
  addMindMeldThought: (itemId: string, owner: "Rose" | "Carmen", text: string) => void;
  createMindMeldThread: (input: { title: string; owner: "Rose" | "Carmen"; initialThought?: string }) => Promise<string | null>;
  addFeedback: (item: Omit<FeedbackItem, "id" | "count">) => void;
  createAgentWork: (input: {
    title: string;
    description: string;
    requestType: AgentWorkType;
    priority: AgentWorkPriority;
    affectedModule: string;
    desiredOutcome: string;
    owner?: string | null;
    approvalRoute: ApprovalRoute;
    risk: AgentWorkItem["risk"];
    source?: string;
    verificationSteps?: string[];
  }) => Promise<{ id: number } | null>;
  updateAgentWork: (id: string, patch: Partial<Pick<AgentWorkItem, "priority" | "status" | "owner" | "approvalRoute" | "risk" | "branchName" | "commitSha" | "mergeRequestUrl" | "verificationSteps" | "agentNotes" | "finalOutcome">>) => Promise<void>;
  addAgentWorkItemEvent: (id: string, action: string, note?: string, actor?: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  addIntakeItem: (input: {
    source: IntakeSource;
    sourceChannel: string;
    senderName: string;
    senderHandle: string;
    senderRole?: string | null;
    rawMessage: string;
    reviewOwner?: IntakeReviewOwner;
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
  createCompanyRecordEntry: (input: {
    title: string;
    type: string;
    summary: string;
    classification: Classification;
    keywords: string[];
  }) => Promise<void>;
  updateCompanyRecordEntry: (id: string, patch: {
    title?: string;
    type?: string;
    summary?: string;
    classification?: Classification;
    keywords?: string[];
  }) => Promise<void>;
  createProjectTaskEntry: (input: {
    title: string;
    projectId: string;
    owner?: string | null;
    status?: Task["status"];
    due?: string | null;
  }) => Promise<void>;
  updateProjectTaskEntry: (id: string, patch: Partial<{
    title: string;
    projectId: string;
    owner: string | null;
    status: Task["status"];
    due: string | null;
  }>) => Promise<void>;
  updateBuildPlanEntry: (projectId: string, patch: Partial<{
    summary: string;
    progress: number;
    carmenPlanNotes: string;
  }>) => Promise<void>;
  createBlockerEntry: (input: {
    title: string;
    projectId: string;
    owner?: string | null;
    risk?: Blocker["risk"];
  }) => Promise<void>;
  deleteBlockerEntry: (id: string) => Promise<void>;
  resetData: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

function freshState(): PersistedState {
  return { currentRole: "Rose" };
}

function load(): PersistedState {
  if (typeof localStorage === "undefined") return freshState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<
      PersistedState & {
        recommendations?: unknown;
        ideas?: unknown;
        mindMeldItems?: unknown;
        handoffs?: unknown;
        meldTimeline?: unknown;
        intakeItems?: unknown;
        memoryCandidates?: unknown;
        feedbackItems?: unknown;
        settings?: unknown;
      }
    >;
    const {
      recommendations: _dropRec,
      ideas: _dropIdeas,
      mindMeldItems: _dropMeld,
      handoffs: _dropHandoffs,
      meldTimeline: _dropTimeline,
      intakeItems: _dropIntake,
      memoryCandidates: _dropMemory,
      feedbackItems: _dropFeedback,
      settings: _dropSettings,
      ...rest
    } = parsed;
    return { ...freshState(), ...rest };
  } catch {
    return freshState();
  }
}

const now = () =>
  new Date().toISOString().slice(0, 16).replace("T", " ");

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function toRecommendation(rec: RecommendationRecord): Recommendation {
  return {
    id: String(rec.id),
    source: rec.source,
    category: rec.category,
    recommendation: rec.recommendation,
    classification: rec.classification,
    risk: rec.risk,
    requiredApprover: rec.requiredApprover,
    status: rec.status,
    approvals: rec.approvals,
    history: rec.history,
    projectId: rec.projectId != null ? String(rec.projectId) : null,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

function toIdea(row: IdeaRecord): Idea {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    submittedBy: row.submittedBy,
    status: row.status,
    momentum: row.momentum,
    cluster: row.cluster ?? null,
    benefits: row.benefits,
    risks: row.risks,
    dependencies: row.dependencies,
    approvalRoute: row.approvalRoute,
    createdAt: row.createdAt,
  };
}

function toMindMeldItem(row: MindMeldItemRecord): MindMeldItem {
  return {
    id: String(row.id),
    title: row.title,
    source: row.source,
    owner: row.owner,
    status: row.status as MindMeldItem["status"],
    roseThoughts: row.roseThoughts,
    carmenThoughts: row.carmenThoughts,
    synthesis: row.synthesis,
    openQuestions: row.openQuestions,
    alignment: row.alignment,
    alignmentScore: row.alignmentScore,
    risk: row.risk,
    privacy: row.privacy,
    nextHandoff: row.nextHandoff,
    finalOutcome: row.finalOutcome,
    layers: row.layers as MindMeldItem["layers"],
    focusAreas: row.focusAreas,
    roseFeedback: row.roseFeedback,
    carmenFeedback: row.carmenFeedback,
    sensitive: row.sensitive,
    history: row.history,
  };
}

function toHandoff(row: MindMeldHandoffRecord): Handoff {
  return {
    id: String(row.id),
    itemId: String(row.itemId),
    itemTitle: row.itemTitle,
    from: row.from,
    to: row.to,
    layer: row.layer as Handoff["layer"],
    timestamp: row.timestamp,
    note: row.note,
  };
}

function toTimelineEvent(row: MindMeldTimelineRecord): MindMeldTimelineEvent {
  return {
    id: String(row.id),
    itemTitle: row.itemTitle,
    type: row.type as MindMeldTimelineEvent["type"],
    actor: row.actor,
    text: row.text,
    timestamp: row.timestamp,
    sensitive: row.sensitive,
    needs: row.needs ?? null,
    readyTo: row.readyTo ?? null,
    finalized: row.finalized,
  };
}

function toIntakeItem(row: IntakeItemRecord): IntakeItem {
  return {
    id: String(row.id),
    source: row.source,
    sourceChannel: row.sourceChannel,
    senderName: row.senderName,
    senderHandle: row.senderHandle,
    senderRole: row.senderRole ?? null,
    receivedAt: row.receivedAt,
    rawMessage: row.rawMessage,
    cleanedSummary: row.cleanedSummary,
    detectedType: row.detectedType,
    suggestedDestination: row.suggestedDestination,
    sensitivity: row.sensitivity,
    reviewOwner: row.reviewOwner,
    status: row.status,
    duplicateRisk: row.duplicateRisk,
    relatedProjectNames: row.relatedProjectNames,
    reviewerNotes: row.reviewerNotes,
    finalActionTaken: row.finalActionTaken,
    nextStep: row.nextStep,
    classificationReason: row.classificationReason,
    auditLog: row.auditLog,
  };
}

function toMemoryCandidate(row: MemoryCandidateRecord): MemoryCandidate {
  return {
    id: String(row.id),
    sourceIntakeId: row.sourceIntakeId != null ? String(row.sourceIntakeId) : null,
    summary: row.summary,
    destination: row.destination,
    status: row.status,
    sensitive: row.sensitive,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function toFeedbackItem(row: FeedbackItemRecord): FeedbackItem {
  return {
    id: String(row.id),
    type: row.type,
    summary: row.summary,
    submittedBy: row.submittedBy,
    department: row.department,
    privacy: row.privacy,
    supportNeed: row.supportNeed,
    approvalRoute: row.approvalRoute,
    count: row.count,
  };
}

function toSentimentSignal(row: SentimentSignalRecord): SentimentSignal {
  return {
    team: row.team,
    score: row.score,
    trend: row.trend,
    theme: row.theme,
  };
}

function toSop(row: SopRecord): SOP {
  return {
    id: String(row.id),
    title: row.title,
    area: row.area,
    status: row.status,
    owner: row.owner,
  };
}

function toAppSettings(row: AppSettingsRecord): AppSettings {
  return {
    duplicateSensitivity: row.duplicateSensitivity,
    alertThreshold: row.alertThreshold,
    reportCadence: row.reportCadence,
    competitors: row.competitors,
    marketKeywords: row.marketKeywords,
    mindMeldPrivate: row.mindMeldPrivate,
    emailAlerts: row.emailAlerts,
    zohoCliqMode: row.zohoCliqMode,
    whatsappMode: row.whatsappMode,
    lastTestMessageAt: row.lastTestMessageAt,
  };
}

function toProject(row: ProjectRecord): Project {
  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    department: row.department,
    owner: row.owner,
    status: row.status,
    risk: row.risk,
    progress: row.progress,
    source: row.source,
    classification: row.classification as Project["classification"],
    lastActivity: row.lastActivity,
    deadline: row.deadline,
    tags: row.tags,
    lastSyncedAt: row.lastSyncedAt ?? null,
    sortOrder: row.sortOrder ?? Number(row.id),
    stage: row.stage ?? "",
    finalIntention: row.finalIntention ?? "",
    confidence: row.confidence ?? "",
    cleanupPriority: row.cleanupPriority ?? "",
    sourceOfTruth: row.sourceOfTruth ?? "",
    agreementStatus: row.agreementStatus ?? "",
    doNotClaim: row.doNotClaim ?? null,
    cleanupWave: row.cleanupWave ?? 0,
    repoExists: row.repoExists ?? null,
  };
}

function toBuildPlan(row: ProjectBuildPlanRecord): ProjectBuildPlan {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    summary: row.summary,
    currentPhaseId: row.currentPhaseId,
    currentPhaseTitle: row.currentPhaseTitle,
    progress: row.progress,
    visibleProgress: row.visibleProgress,
    phases: row.phases,
    roseInstructions: row.roseInstructions,
    carmenPlanNotes: row.carmenPlanNotes,
    source: row.source,
    updatedBy: row.updatedBy,
    canUnblock: row.canUnblock,
    updatedAt: row.updatedAt,
  };
}

function toBlocker(row: BlockerRecord): Blocker {
  return {
    id: String(row.id),
    title: row.title,
    projectId: String(row.projectId),
    owner: row.owner,
    risk: row.risk,
    age: row.age,
  };
}

function toProjectTask(row: ProjectTaskRecord): Task {
  return {
    id: String(row.id),
    title: row.title,
    projectId: String(row.projectId),
    owner: row.owner,
    status: row.status,
    due: row.due,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
  };
}

function toCompanyRecord(row: ApiCompanyRecord): CompanyRecord {
  return {
    id: String(row.id),
    title: row.title,
    type: row.type,
    summary: row.summary,
    source: row.source,
    classification: row.classification as CompanyRecord["classification"],
    keywords: row.keywords,
  };
}

function toDecision(row: DecisionRecord): Decision {
  return {
    id: String(row.id),
    title: row.title,
    context: row.context,
    status: row.status,
    owner: row.owner,
    approvalRoute: row.approvalRoute,
    risk: row.risk,
  };
}

function toAutomation(row: AutomationRecord): Automation {
  return {
    id: String(row.id),
    name: row.name,
    system: row.system,
    status: row.status,
    owner: row.owner,
    description: row.description,
  };
}

function toDuplicateRisk(row: DuplicateRiskRecord): DuplicateRisk {
  return {
    id: String(row.id),
    title: row.title,
    similarity: row.similarity,
    overlappingItems: row.overlappingItems,
    reason: row.reason,
    sourceRecords: row.sourceRecords,
    affectedOwners: row.affectedOwners,
    risk: row.risk,
    recommendation: row.recommendation,
    approvalRoute: row.approvalRoute,
    category: row.category,
  };
}

function toAlert(row: AlertRecord): Alert {
  return {
    id: String(row.id),
    type: row.type,
    message: row.message,
    risk: row.risk,
    source: row.source,
    createdAt: row.createdAt,
  };
}

function toBuildItem(row: BuildItemRecord): BuildItem {
  return {
    id: String(row.id),
    name: row.name,
    projectId: String(row.projectId),
    readiness: row.readiness,
    status: row.status,
    owner: row.owner,
    source: row.source,
  };
}

function toMarketSignal(row: MarketSignalRecord): MarketSignal {
  return {
    id: String(row.id),
    source: row.source,
    dateFound: row.dateFound,
    signalType: row.signalType as MarketSignal["signalType"],
    summary: row.summary,
    opportunity: row.opportunity,
    risk: row.risk,
    recommendedResponse: row.recommendedResponse,
    reviewOwner: row.reviewOwner,
  };
}

function toCompetitor(row: MarketCompetitorRecord): Competitor {
  return {
    id: String(row.id),
    name: row.name,
    threat: row.threat,
    trend: row.trend,
    newsCount: row.newsCount,
    movement: row.movement,
    series: row.series,
  };
}

function toReport(row: ReportTemplateRecord): Report {
  return {
    id: String(row.id),
    type: row.type,
    title: row.title,
    date: row.date,
    summary: row.summary,
    findings: row.findings,
    sourceData: row.sourceData,
    risks: row.risks,
    recommendations: row.recommendations,
    decisionsNeeded: row.decisionsNeeded,
    owners: row.owners,
    nextSteps: row.nextSteps,
  };
}

function toIntegrationStatus(row: IntegrationStatusRecord): IntegrationStatus {
  return {
    name: row.name,
    status: row.status,
    state: row.state,
  };
}

function toMindFeedEntry(row: MindFeedRecord): MindFeedEntry {
  return {
    id: String(row.id),
    actor: row.actor,
    action: row.action,
    layer: row.layer as MindFeedEntry["layer"],
    timestamp: row.timestamp,
  };
}

function toAgentWorkItem(row: AgentWorkItemRecord): AgentWorkItem {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    requestType: row.requestType,
    priority: row.priority,
    affectedModule: row.affectedModule,
    desiredOutcome: row.desiredOutcome,
    status: row.status,
    owner: row.owner,
    approvalRoute: row.approvalRoute,
    risk: row.risk,
    source: row.source,
    relatedIntakeId: row.relatedIntakeId != null ? String(row.relatedIntakeId) : null,
    relatedRecommendationId: row.relatedRecommendationId != null ? String(row.relatedRecommendationId) : null,
    relatedProjectId: row.relatedProjectId != null ? String(row.relatedProjectId) : null,
    branchName: row.branchName,
    commitSha: row.commitSha,
    mergeRequestUrl: row.mergeRequestUrl,
    verificationSteps: row.verificationSteps,
    agentNotes: row.agentNotes,
    finalOutcome: row.finalOutcome,
    events: row.events,
    createdByName: row.createdByName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attachmentCount: row.attachmentCount ?? 0,
  };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: apiRecommendations = [], isLoading: recommendationsLoading } = useListRecommendations();
  const { data: apiIdeas = [], isLoading: ideasLoading } = useListIdeas();
  const { data: apiMindMeldItems = [], isLoading: mindMeldItemsLoading } = useListMindMeldItems();
  const { data: apiHandoffs = [], isLoading: mindMeldHandoffsLoading } = useListMindMeldHandoffs();
  const { data: apiTimeline = [], isLoading: mindMeldTimelineLoading } = useListMindMeldTimeline();
  const { data: apiMindFeed = [], isLoading: mindFeedLoading } = useListMindMeldFeed();
  const { data: apiIntakeItems = [], isLoading: intakeLoading } = useListIntakeItems();
  const { data: apiMemoryCandidates = [], isLoading: memoryCandidatesLoading } = useListMemoryCandidates();
  const { data: apiFeedbackItems = [], isLoading: feedbackLoading } = useListFeedbackItems();
  const { data: apiSentimentSignals = [], isLoading: sentimentLoading } = useListSentimentSignals();
  const { data: apiSops = [], isLoading: sopsLoading } = useListSops();
  const { data: apiSettings, isLoading: settingsLoading } = useGetAppSettings();
  const { data: apiProjects = [], isLoading: projectsLoading } = useListProjects();
  const { data: apiBlockers = [], isLoading: blockersLoading } = useListProjectBlockers();
  const { data: apiBuildPlans = [], isLoading: buildPlansLoading } = useListProjectBuildPlans();
  const { data: apiProjectTasks = [], isLoading: projectTasksLoading } = useListProjectTasks();
  const { data: apiCompanyRecords = [], isLoading: companyRecordsLoading } = useListCompanyRecords();
  const { data: apiDecisions = [], isLoading: decisionsLoading } = useListDecisions();
  const { data: apiAutomations = [], isLoading: automationsLoading } = useListAutomations();
  const { data: apiDuplicateRisks = [], isLoading: duplicateRisksLoading } = useListDuplicateRisks();
  const { data: apiAlerts = [], isLoading: alertsLoading } = useListAlerts();
  const { data: apiBuildItems = [], isLoading: buildItemsLoading } = useListBuildItems();
  const { data: apiMarketSignals = [], isLoading: marketSignalsLoading } = useListMarketSignals();
  const { data: apiMarketCompetitors = [], isLoading: marketCompetitorsLoading } = useListMarketCompetitors();
  const { data: apiReports = [], isLoading: reportsLoading } = useListReportTemplates();
  const { data: apiIntegrations = [], isLoading: integrationsLoading } = useListIntegrationStatus();
  const { data: apiAgentWorkItems = [], isLoading: agentWorkLoading } = useListAgentWorkItems();

  const recommendations = useMemo(
    () => apiRecommendations.map(toRecommendation),
    [apiRecommendations],
  );
  const ideas = useMemo(() => apiIdeas.map(toIdea), [apiIdeas]);
  const mindMeldItems = useMemo(() => apiMindMeldItems.map(toMindMeldItem), [apiMindMeldItems]);
  const handoffs = useMemo(() => apiHandoffs.map(toHandoff), [apiHandoffs]);
  const meldTimeline = useMemo(() => apiTimeline.map(toTimelineEvent), [apiTimeline]);
  const intakeItems = useMemo(() => apiIntakeItems.map(toIntakeItem), [apiIntakeItems]);
  const memoryCandidates = useMemo(() => apiMemoryCandidates.map(toMemoryCandidate), [apiMemoryCandidates]);
  const feedbackItems = useMemo(() => apiFeedbackItems.map(toFeedbackItem), [apiFeedbackItems]);
  const sentimentSignals = useMemo(() => apiSentimentSignals.map(toSentimentSignal), [apiSentimentSignals]);
  const sops = useMemo(() => apiSops.map(toSop), [apiSops]);
  const teamPulseExtrasLoading = sentimentLoading || sopsLoading;
  const settings = useMemo(
    () => (apiSettings ? toAppSettings(apiSettings) : defaultSettings),
    [apiSettings],
  );
  const projects = useMemo(() => apiProjects.map(toProject), [apiProjects]);
  const blockers = useMemo(() => apiBlockers.map(toBlocker), [apiBlockers]);
  const buildPlans = useMemo(() => apiBuildPlans.map(toBuildPlan), [apiBuildPlans]);
  const projectTasks = useMemo(() => apiProjectTasks.map(toProjectTask), [apiProjectTasks]);
  const companyRecords = useMemo(() => apiCompanyRecords.map(toCompanyRecord), [apiCompanyRecords]);
  const decisions = useMemo(() => apiDecisions.map(toDecision), [apiDecisions]);
  const automations = useMemo(() => apiAutomations.map(toAutomation), [apiAutomations]);
  const duplicateRisks = useMemo(() => apiDuplicateRisks.map(toDuplicateRisk), [apiDuplicateRisks]);
  const alerts = useMemo(() => apiAlerts.map(toAlert), [apiAlerts]);
  const buildItems = useMemo(() => apiBuildItems.map(toBuildItem), [apiBuildItems]);
  const marketSignals = useMemo(() => apiMarketSignals.map(toMarketSignal), [apiMarketSignals]);
  const competitors = useMemo(() => apiMarketCompetitors.map(toCompetitor), [apiMarketCompetitors]);
  const reports = useMemo(() => apiReports.map(toReport), [apiReports]);
  const integrations = useMemo(() => apiIntegrations.map(toIntegrationStatus), [apiIntegrations]);
  const mindFeed = useMemo(() => apiMindFeed.map(toMindFeedEntry), [apiMindFeed]);
  const agentWorkItems = useMemo(() => apiAgentWorkItems.map(toAgentWorkItem), [apiAgentWorkItems]);
  const mindMeldLoading = mindMeldItemsLoading || mindMeldHandoffsLoading || mindMeldTimelineLoading || mindFeedLoading;
  const projectsLoadingCombined = projectsLoading || blockersLoading || buildPlansLoading || projectTasksLoading;
  const registryLoading =
    companyRecordsLoading ||
    decisionsLoading ||
    automationsLoading ||
    duplicateRisksLoading ||
    alertsLoading ||
    buildItemsLoading;
  const marketPulseLoading = marketSignalsLoading || marketCompetitorsLoading;

  const invalidateRecommendations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListRecommendationsQueryKey() });
  }, [queryClient]);
  const invalidateIdeas = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListIdeasQueryKey() });
  }, [queryClient]);
  const invalidateMindMeld = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListMindMeldItemsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListMindMeldHandoffsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListMindMeldTimelineQueryKey() }),
    ]);
  }, [queryClient]);
  const invalidateIntake = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListIntakeItemsQueryKey() });
  }, [queryClient]);
  const invalidateMemoryCandidates = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListMemoryCandidatesQueryKey() });
  }, [queryClient]);
  const invalidateFeedback = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListFeedbackItemsQueryKey() });
  }, [queryClient]);
  const invalidateSettings = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
  }, [queryClient]);
  const invalidateAgentWork = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListAgentWorkItemsQueryKey() });
  }, [queryClient]);
  const invalidateCompanyRecords = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListCompanyRecordsQueryKey() });
  }, [queryClient]);
  const invalidateProjectTasks = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListProjectTasksQueryKey() });
  }, [queryClient]);
  const invalidateBuildPlans = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListProjectBuildPlansQueryKey() });
  }, [queryClient]);
  const invalidateBlockers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getListProjectBlockersQueryKey() });
  }, [queryClient]);

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

  const submitIdea = useCallback(
    (idea: Omit<Idea, "id" | "createdAt">) => {
      if (!canSubmit(state.currentRole)) return;
      void createIdea({
        title: idea.title,
        description: idea.description,
        submittedBy: idea.submittedBy,
        status: idea.status,
        momentum: idea.momentum,
        cluster: idea.cluster,
        benefits: idea.benefits,
        risks: idea.risks,
        dependencies: idea.dependencies,
        approvalRoute: idea.approvalRoute,
        createdAt: now().slice(0, 10),
      })
        .then(() => invalidateIdeas())
        .catch(() => undefined);
    },
    [state.currentRole, invalidateIdeas],
  );

  const updateIdeaStatus = useCallback(
    (id: string, status: IdeaStatus) => {
      if (!canSubmit(state.currentRole)) return;
      void updateIdeaStatusApi(Number(id), { status })
        .then(() => invalidateIdeas())
        .catch(() => undefined);
    },
    [state.currentRole, invalidateIdeas],
  );

  const setRecommendationStatus = useCallback(
    async (id: string, nextStatus: ApprovalStatus, actor: string): Promise<boolean> => {
      const rec = recommendations.find((r) => r.id === id);
      if (!rec || !canApprove(actor as Role, rec.requiredApprover)) return false;
      try {
        await changeRecommendationStatus(Number(id), { status: nextStatus });
        await Promise.all([invalidateRecommendations(), invalidateProjectTasks()]);
        return true;
      } catch {
        return false;
      }
    },
    [recommendations, invalidateRecommendations, invalidateProjectTasks],
  );

  const addRecommendation = useCallback(
    async (rec: Omit<Recommendation, "id" | "history" | "status">) => {
      if (!canSubmit(state.currentRole)) return;
      try {
        await createRecommendation({
          source: rec.source,
          category: rec.category,
          recommendation: rec.recommendation,
          classification: rec.classification,
          risk: rec.risk,
          requiredApprover: rec.requiredApprover,
        });
        await invalidateRecommendations();
      } catch {
        /* ignore */
      }
    },
    [state.currentRole, invalidateRecommendations],
  );

  const carmenfy = useCallback(
    (itemId: string, note: string) => {
      void carmenfyMindMeldItem(Number(itemId), { note })
        .then(() => invalidateMindMeld())
        .catch(() => undefined);
    },
    [invalidateMindMeld],
  );

  const rosify = useCallback(
    (itemId: string, note: string) => {
      void rosifyMindMeldItem(Number(itemId), { note })
        .then(() => invalidateMindMeld())
        .catch(() => undefined);
    },
    [invalidateMindMeld],
  );

  const addMindMeldThought = useCallback(
    (itemId: string, owner: "Rose" | "Carmen", text: string) => {
      void addMindMeldThoughtApi(Number(itemId), { owner, text })
        .then(() => invalidateMindMeld())
        .catch(() => undefined);
    },
    [invalidateMindMeld],
  );

  const createMindMeldThread = useCallback(
    async (input: { title: string; owner: "Rose" | "Carmen"; initialThought?: string }): Promise<string | null> => {
      const thought = input.initialThought?.trim() ?? "";
      try {
        const created = await createMindMeldItem({
          title: input.title.trim(),
          source: "Mind Meld Room",
          owner: input.owner,
          status: input.owner === "Rose" ? "rose-thinking" : "carmen-thinking",
          roseThoughts: input.owner === "Rose" ? thought : "",
          carmenThoughts: input.owner === "Carmen" ? thought : "",
          synthesis: "New thread — add thoughts from both sides to begin alignment.",
          openQuestions: thought ? ["What does success look like?"] : [],
          alignment: "needs-clarity",
          alignmentScore: thought ? 15 : 10,
          risk: "low",
          privacy: "leadership-only",
          layers: ["Vision"],
          focusAreas: [],
          sensitive: false,
          history: [{ id: uid("h"), timestamp: now(), actor: input.owner, action: "Created thread" }],
        });
        await invalidateMindMeld();
        return String(created.id);
      } catch {
        return null;
      }
    },
    [invalidateMindMeld],
  );

  const addFeedback = useCallback(
    (item: Omit<FeedbackItem, "id" | "count">) => {
      if (!canSubmit(state.currentRole)) return;
      void createFeedbackItem({
        type: item.type,
        summary: item.summary,
        submittedBy: item.submittedBy,
        department: item.department,
        privacy: item.privacy,
        supportNeed: item.supportNeed,
        approvalRoute: item.approvalRoute,
        count: 1,
      })
        .then(() => invalidateFeedback())
        .catch(() => undefined);
    },
    [state.currentRole, invalidateFeedback],
  );

  const createAgentWork = useCallback(
    async (input: {
      title: string;
      description: string;
      requestType: AgentWorkType;
      priority: AgentWorkPriority;
      affectedModule: string;
      desiredOutcome: string;
      owner?: string | null;
      approvalRoute: ApprovalRoute;
      risk: AgentWorkItem["risk"];
      source?: string;
      verificationSteps?: string[];
    }) => {
      if (!canSubmit(state.currentRole)) return null;
      try {
        const created = await createAgentWorkItem({
          title: input.title,
          description: input.description,
          requestType: input.requestType,
          priority: input.priority,
          affectedModule: input.affectedModule,
          desiredOutcome: input.desiredOutcome,
          owner: input.owner ?? null,
          approvalRoute: input.approvalRoute,
          risk: input.risk,
          source: input.source ?? "CollabOS",
          verificationSteps: input.verificationSteps ?? [],
        });
        await invalidateAgentWork();
        return created;
      } catch {
        return null;
      }
    },
    [state.currentRole, invalidateAgentWork],
  );

  const updateAgentWork = useCallback(
    async (
      id: string,
      patch: Partial<Pick<AgentWorkItem, "priority" | "status" | "owner" | "approvalRoute" | "risk" | "branchName" | "commitSha" | "mergeRequestUrl" | "verificationSteps" | "agentNotes" | "finalOutcome">>,
    ) => {
      try {
        await updateAgentWorkItem(Number(id), {
          priority: patch.priority,
          status: patch.status,
          owner: patch.owner,
          approvalRoute: patch.approvalRoute,
          risk: patch.risk,
          branchName: patch.branchName,
          commitSha: patch.commitSha,
          mergeRequestUrl: patch.mergeRequestUrl,
          verificationSteps: patch.verificationSteps,
          agentNotes: patch.agentNotes,
          finalOutcome: patch.finalOutcome,
        });
        await invalidateAgentWork();
      } catch {
        /* ignore */
      }
    },
    [invalidateAgentWork],
  );

  const addAgentWorkItemEvent = useCallback(
    async (id: string, action: string, note?: string, actor?: string) => {
      try {
        await addAgentWorkEvent(Number(id), { actor, action, note });
        await invalidateAgentWork();
      } catch {
        /* ignore */
      }
    },
    [invalidateAgentWork],
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      void updateAppSettings(patch)
        .then(() => invalidateSettings())
        .catch(() => undefined);
    },
    [invalidateSettings],
  );

  const addIntakeItem = useCallback(
    (input: {
      source: IntakeSource;
      sourceChannel: string;
      senderName: string;
      senderHandle: string;
      senderRole?: string | null;
      rawMessage: string;
      reviewOwner?: IntakeReviewOwner;
    }) => {
      const classification = classifyIntakeMessage(input.rawMessage);
      const dup = detectIntakeDuplicates(
        input.rawMessage,
        projects.map((p) => ({ name: p.name, keywords: p.tags })),
      );
      const isInternalNote = input.source === "manual" && /rose/i.test(input.sourceChannel) && /carmen/i.test(input.sourceChannel);
      const sourceLabel = isInternalNote
        ? "CollabOS note"
        : input.source === "zoho_cliq"
          ? "Zoho Cliq"
          : input.source === "whatsapp"
            ? "WhatsApp"
            : "CollabOS note";
      void createIntakeItem({
        source: input.source,
        sourceChannel: input.sourceChannel,
        senderName: input.senderName,
        senderHandle: input.senderHandle,
        senderRole: input.senderRole ?? null,
        receivedAt: now(),
        rawMessage: input.rawMessage,
        cleanedSummary: summarizeIntakeMessage(input.rawMessage),
        detectedType: isInternalNote ? "question" : classification.detectedType,
        suggestedDestination: isInternalNote ? "no-action" : classification.suggestedDestination,
        sensitivity: isInternalNote ? "private_leadership" : classification.sensitivity,
        reviewOwner: input.reviewOwner ?? (isInternalNote ? "Rose and Carmen" : classification.reviewOwner),
        classificationReason: isInternalNote
          ? "Internal Rose ↔ Carmen note in CollabOS — not from WhatsApp or Cliq."
          : classification.reason,
        status: "new",
        duplicateRisk: dup.risk,
        relatedProjectNames: dup.relatedNames,
        reviewerNotes: "",
        nextStep: isInternalNote
          ? "Read and reply here, or copy a reusable prompt from Prompt Library."
          : classification.nextStep,
        auditLog: [
          {
            id: uid("al"),
            timestamp: now(),
            actor: "System",
            action: isInternalNote
              ? `Internal note from ${input.senderName} for ${input.reviewOwner ?? "Rose and Carmen"}.`
              : `Captured from ${sourceLabel} (test mode) and classified as ${classification.detectedType.replace(/_/g, " ")}.`,
          },
        ],
      })
        .then(() => invalidateIntake())
        .catch(() => undefined);
      if (!isInternalNote) {
        void updateAppSettings({ lastTestMessageAt: now() })
          .then(() => invalidateSettings())
          .catch(() => undefined);
      }
    },
    [invalidateIntake, invalidateSettings, projects],
  );

  const updateIntakeItem = useCallback(
    (id: string, patch: Partial<IntakeItem>, actor: string, action: string) => {
      void updateIntakeItemApi(Number(id), {
        status: patch.status,
        reviewOwner: patch.reviewOwner,
        reviewerNotes: patch.reviewerNotes,
        finalActionTaken: patch.finalActionTaken,
        auditEntry: { actor, action },
      })
        .then(() => invalidateIntake())
        .catch(() => undefined);
    },
    [invalidateIntake],
  );

  const routeIntakeItem = useCallback(
    (id: string, destination: IntakeDestination, actor: string, ownerOverride?: IntakeReviewOwner) => {
      const item = intakeItems.find((it) => it.id === id);
      if (!item) return;

      const sensitive = item.sensitivity !== "normal";
      const effectiveOwner: IntakeReviewOwner = ownerOverride ?? item.reviewOwner;
      const approver: ApprovalRoute =
        effectiveOwner === "Rose"
          ? "rose"
          : effectiveOwner === "Carmen"
            ? "carmen"
            : "both";

      let meld: Parameters<typeof createMindMeldItem>[0] | null = null;
      let idea: Parameters<typeof createIdea>[0] | null = null;
      let agentWork: Parameters<typeof createAgentWorkItem>[0] | null = null;
      let pending: Omit<Recommendation, "id" | "history" | "status"> | null = null;
      let actionLabel = "";

      if (destination === "mind-meld") {
        meld = {
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
        actionLabel = "Sent to Rose/Carmen Mind Meld (private, safe summary only).";
      } else if (destination === "idea-backlog") {
        idea = {
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
        actionLabel = "Draft idea created in the Idea Backlog (pending review).";
      } else if (destination === "command-center-task") {
        agentWork = {
          title: item.cleanedSummary.slice(0, 80),
          description: item.rawMessage,
          requestType: "fix",
          priority: "medium",
          affectedModule: "Cursor Direct Requests",
          desiredOutcome: item.nextStep || "Resolve the follow-up described in intake.",
          owner: effectiveOwner === "Rose" ? "Rose" : effectiveOwner === "Carmen" ? "Carmen" : null,
          approvalRoute: approver,
          risk: sensitive ? "high" : "medium",
          source: "External Intake",
          relatedIntakeId: Number(id),
        };
        actionLabel = "Routed to Cursor Direct Requests (awaiting approval before agent execution).";
      } else if (destination === "no-action") {
        actionLabel = "Archived — no action taken.";
      } else {
        const destLabel: Record<string, string> = {
          "review-queue": "CollabOS Review Queue draft",
          "build-registry": "Build Registry suggestion",
          "requirements-registry": "Requirements Registry suggestion",
          "automation-registry": "Automation Registry suggestion",
          "decision-log": "Decision Log suggestion",
          "company-brain-update": "Company Brain update proposal",
        };
        pending = {
          source: "External Intake",
          category: "external-intake",
          recommendation: `${destLabel[destination]}: ${item.cleanedSummary}`,
          classification: sensitive ? "sensitive" : "pending-approval",
          risk: sensitive ? "high" : "medium",
          requiredApprover: approver,
        };
        actionLabel = `${destLabel[destination]} created (pending approval).`;
      }

      const overrideNote = ownerOverride && ownerOverride !== item.reviewOwner
        ? ` Reviewer set to ${ownerOverride}.`
        : "";

      void updateIntakeItemApi(Number(id), {
        status: destination === "no-action" ? "archived" : "routed",
        reviewOwner: effectiveOwner,
        finalActionTaken: actionLabel,
        auditEntry: { actor, action: `${actionLabel}${overrideNote}` },
      })
        .then(() => invalidateIntake())
        .catch(() => undefined);

      if (meld) {
        void createMindMeldItem(meld)
          .then(() => invalidateMindMeld())
          .catch(() => undefined);
      }
      if (idea) {
        void createIdea(idea)
          .then(() => invalidateIdeas())
          .catch(() => undefined);
      }
      if (agentWork) {
        void createAgentWorkItem(agentWork)
          .then(() => invalidateAgentWork())
          .catch(() => undefined);
      }
      if (pending) {
        void createRecommendation({
          source: pending.source,
          category: pending.category,
          recommendation: pending.recommendation,
          classification: pending.classification,
          risk: pending.risk,
          requiredApprover: pending.requiredApprover,
        })
          .then(() => invalidateRecommendations())
          .catch(() => undefined);
      }
    },
    [intakeItems, invalidateRecommendations, invalidateIdeas, invalidateMindMeld, invalidateIntake, invalidateAgentWork],
  );

  const addMemoryCandidate = useCallback(
    (input: {
      sourceIntakeId: string | null;
      summary: string;
      destination: MemoryDestination;
      sensitive: boolean;
      createdBy: string;
    }) => {
      void createMemoryCandidate({
        sourceIntakeId: input.sourceIntakeId ? Number(input.sourceIntakeId) : null,
        summary: input.summary,
        destination: input.destination,
        sensitive: input.sensitive,
        createdBy: input.createdBy,
        createdAt: now(),
      })
        .then(() => invalidateMemoryCandidates())
        .catch(() => undefined);
      if (input.sourceIntakeId) {
        void updateIntakeItemApi(Number(input.sourceIntakeId), {
          auditEntry: {
            actor: input.createdBy,
            action: `Preserved as memory candidate (${input.destination.replace(/-/g, " ")}) - pending approval, nothing written yet.`,
          },
        })
          .then(() => invalidateIntake())
          .catch(() => undefined);
      }
    },
    [invalidateIntake, invalidateMemoryCandidates],
  );

  const setMemoryCandidateStatus = useCallback(
    (id: string, status: MemoryCandidate["status"], actor: string) => {
      const mc = memoryCandidates.find((m) => m.id === id);
      void updateMemoryCandidateStatus(Number(id), { status })
        .then(() => invalidateMemoryCandidates())
        .catch(() => undefined);
      if (mc?.sourceIntakeId) {
        void updateIntakeItemApi(Number(mc.sourceIntakeId), {
          auditEntry: { actor, action: `Memory candidate ${status} by ${actor}.` },
        })
          .then(() => invalidateIntake())
          .catch(() => undefined);
      }
    },
    [memoryCandidates, invalidateIntake, invalidateMemoryCandidates],
  );

  const resetData = useCallback(() => {
    const fresh = freshState();
    fresh.currentRole = state.currentRole;
    setState(fresh);
  }, [state.currentRole]);

  const createCompanyRecordEntry = useCallback(
    async (input: {
      title: string;
      type: string;
      summary: string;
      classification: Classification;
      keywords: string[];
    }) => {
      if (!canSubmit(state.currentRole)) return;
      await createCompanyRecord({
        title: input.title,
        type: input.type,
        summary: input.summary,
        classification: input.classification,
        keywords: input.keywords,
        source: "User entry",
      });
      await invalidateCompanyRecords();
    },
    [state.currentRole, invalidateCompanyRecords],
  );

  const updateCompanyRecordEntry = useCallback(
    async (id: string, patch: {
      title?: string;
      type?: string;
      summary?: string;
      classification?: Classification;
      keywords?: string[];
    }) => {
      if (!canSubmit(state.currentRole)) return;
      await updateCompanyRecord(Number(id), patch);
      await invalidateCompanyRecords();
    },
    [state.currentRole, invalidateCompanyRecords],
  );

  const createProjectTaskEntry = useCallback(
    async (input: {
      title: string;
      projectId: string;
      owner?: string | null;
      status?: Task["status"];
      due?: string | null;
    }) => {
      if (!canSubmit(state.currentRole)) return;
      await createProjectTask({
        title: input.title,
        projectId: Number(input.projectId),
        owner: input.owner ?? null,
        status: input.status ?? "todo",
        due: input.due ?? null,
        source: "manual",
      });
      await invalidateProjectTasks();
    },
    [state.currentRole, invalidateProjectTasks],
  );

  const updateProjectTaskEntry = useCallback(
    async (id: string, patch: Partial<{
      title: string;
      projectId: string;
      owner: string | null;
      status: Task["status"];
      due: string | null;
    }>) => {
      if (!canSubmit(state.currentRole)) return;
      await updateProjectTask(Number(id), {
        title: patch.title,
        projectId: patch.projectId !== undefined ? Number(patch.projectId) : undefined,
        owner: patch.owner,
        status: patch.status,
        due: patch.due,
      });
      await invalidateProjectTasks();
    },
    [state.currentRole, invalidateProjectTasks],
  );

  const updateBuildPlanEntry = useCallback(
    async (projectId: string, patch: Partial<{
      summary: string;
      progress: number;
      carmenPlanNotes: string;
    }>) => {
      if (!canSubmit(state.currentRole)) return;
      await updateProjectBuildPlan(Number(projectId), patch);
      await invalidateBuildPlans();
    },
    [state.currentRole, invalidateBuildPlans],
  );

  const createBlockerEntry = useCallback(
    async (input: {
      title: string;
      projectId: string;
      owner?: string | null;
      risk?: Blocker["risk"];
    }) => {
      if (!canSubmit(state.currentRole)) return;
      await createProjectBlocker({
        title: input.title,
        projectId: Number(input.projectId),
        owner: input.owner ?? null,
        risk: input.risk ?? "medium",
      });
      await invalidateBlockers();
    },
    [state.currentRole, invalidateBlockers],
  );

  const deleteBlockerEntry = useCallback(
    async (id: string) => {
      if (!canSubmit(state.currentRole)) return;
      await deleteProjectBlocker(Number(id));
      await invalidateBlockers();
    },
    [state.currentRole, invalidateBlockers],
  );

  return (
    <AppStateContext.Provider
      value={{
        ...state,
        feedbackItems,
        feedbackLoading,
        sentimentSignals,
        sops,
        teamPulseExtrasLoading,
        settings,
        settingsLoading,
        projects,
        blockers,
        buildPlans,
        projectTasks,
        projectsLoading: projectsLoadingCombined,
        companyRecords,
        decisions,
        automations,
        duplicateRisks,
        alerts,
        buildItems,
        registryLoading,
        marketSignals,
        competitors,
        marketPulseLoading,
        reports,
        reportsLoading,
        integrations,
        integrationsLoading,
        agentWorkItems,
        agentWorkLoading,
        intakeItems,
        intakeLoading,
        memoryCandidates,
        memoryCandidatesLoading,
        ideas,
        ideasLoading,
        mindMeldItems,
        handoffs,
        meldTimeline,
        mindFeed,
        mindMeldLoading,
        recommendations,
        recommendationsLoading,
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
        createMindMeldThread,
        addFeedback,
        createAgentWork,
        updateAgentWork,
        addAgentWorkItemEvent,
        updateSettings,
        addIntakeItem,
        updateIntakeItem,
        routeIntakeItem,
        addMemoryCandidate,
        setMemoryCandidateStatus,
        createCompanyRecordEntry,
        updateCompanyRecordEntry,
        createProjectTaskEntry,
        updateProjectTaskEntry,
        updateBuildPlanEntry,
        createBlockerEntry,
        deleteBlockerEntry,
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
