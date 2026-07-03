export type Role =
  | "Rose"
  | "Carmen"
  | "Admin"
  | "Department Lead"
  | "Team Member"
  | "Viewer";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type Classification =
  | "documented-fact"
  | "user-update"
  | "ai-recommendation"
  | "draft-idea"
  | "pending-approval"
  | "approved-decision"
  | "sensitive";

export type ApprovalRoute = "rose" | "carmen" | "both" | "none";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "needs-revision";

export type PrivacyLevel = "public" | "internal" | "private" | "leadership-only";

export interface Person {
  id: string;
  name: string;
  role: Role;
  title: string;
  department: string;
  initials: string;
  color: string;
}

export interface Department {
  id: string;
  name: string;
  lead: string;
  headcount: number;
  color: string;
}

export type ProjectStatus =
  | "active"
  | "at-risk"
  | "blocked"
  | "stale"
  | "complete"
  | "planning";

export interface Project {
  id: string;
  name: string;
  description: string;
  department: string;
  owner: string | null;
  status: ProjectStatus;
  risk: RiskLevel;
  progress: number;
  source: string;
  classification: Classification;
  lastActivity: string;
  deadline: string | null;
  tags: string[];
}

export interface Task {
  id: string;
  title: string;
  projectId: string;
  owner: string | null;
  status: "todo" | "in-progress" | "review" | "done";
  due: string | null;
}

export type IdeaStatus =
  | "draft-idea"
  | "related-to-existing"
  | "needs-research"
  | "needs-carmen-review"
  | "needs-rose-review"
  | "approved-for-build"
  | "parked";

export interface Idea {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  status: IdeaStatus;
  momentum: number;
  cluster: string | null;
  benefits: string[];
  risks: string[];
  dependencies: string[];
  approvalRoute: ApprovalRoute;
  createdAt: string;
}

export interface BuildItem {
  id: string;
  name: string;
  projectId: string;
  readiness: number;
  status: "scoping" | "ready" | "in-build" | "blocked" | "shipped";
  owner: string | null;
  source: string;
}

export interface Requirement {
  id: string;
  title: string;
  area: string;
  status: "draft" | "approved" | "implemented";
  owner: string | null;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  status: "open" | "decided" | "deferred";
  owner: string | null;
  approvalRoute: ApprovalRoute;
  risk: RiskLevel;
}

export interface Automation {
  id: string;
  name: string;
  system: string;
  status: "live" | "draft" | "proposed" | "paused";
  owner: string | null;
  description: string;
}

export interface SOP {
  id: string;
  title: string;
  area: string;
  status: "current" | "needs-update" | "missing";
  owner: string | null;
}

export interface CompanyRecord {
  id: string;
  title: string;
  type: string;
  summary: string;
  source: string;
  classification: Classification;
  keywords: string[];
}

export type FeedbackType =
  | "help-request"
  | "blocker"
  | "repeated-question"
  | "confusion"
  | "workload"
  | "missing-docs"
  | "training-need"
  | "tool-friction";

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  summary: string;
  submittedBy: string;
  department: string;
  privacy: PrivacyLevel;
  supportNeed: string;
  approvalRoute: ApprovalRoute;
  count: number;
}

export interface Blocker {
  id: string;
  title: string;
  projectId: string;
  owner: string | null;
  risk: RiskLevel;
  age: number;
}

export interface SentimentSignal {
  team: string;
  score: number;
  trend: "up" | "down" | "flat";
  theme: string;
}

export interface DuplicateRisk {
  id: string;
  title: string;
  similarity: number;
  overlappingItems: string[];
  reason: string;
  sourceRecords: string[];
  affectedOwners: string[];
  risk: RiskLevel;
  recommendation: string;
  approvalRoute: ApprovalRoute;
  category: string;
}

export interface Alert {
  id: string;
  type: "overlap" | "risk" | "blocker" | "missing-owner" | "duplicate" | "stale";
  message: string;
  risk: RiskLevel;
  source: string;
  createdAt: string;
}

export interface ReportSection {
  heading: string;
  items: string[];
}

export interface Report {
  id: string;
  type: string;
  title: string;
  date: string;
  summary: string;
  findings: string[];
  sourceData: string[];
  risks: string[];
  recommendations: string[];
  decisionsNeeded: string[];
  owners: string[];
  nextSteps: string[];
}

export type MarketSignalType =
  | "competitor"
  | "new-product"
  | "positioning"
  | "content-change"
  | "pricing"
  | "job-posting"
  | "trend"
  | "tech-shift"
  | "compliance-opportunity";

export interface MarketSignal {
  id: string;
  source: string;
  dateFound: string;
  signalType: MarketSignalType;
  summary: string;
  opportunity: string;
  risk: RiskLevel;
  recommendedResponse: string;
  reviewOwner: ApprovalRoute;
}

export interface Competitor {
  id: string;
  name: string;
  threat: "low" | "medium" | "high" | "watch";
  trend: "up" | "down" | "flat";
  newsCount: number;
  movement: number;
  series: number[];
}

export interface MockupRequest {
  id: string;
  ideaName: string;
  targetUser: string;
  purpose: string;
  mustHaveFeatures: string;
  brandSystem: string;
  screenType: string;
  desiredOutput: string;
}

export interface GeneratedConcept {
  id: string;
  requestId: string;
  screenSummary: string;
  layoutDescription: string;
  keyUISections: string[];
  dataNeeded: string[];
  userWorkflow: string[];
  risks: string[];
  buildPrompt: string;
}

export type MindMeldStatus =
  | "rose-thinking"
  | "carmen-thinking"
  | "ready-to-carmenfy"
  | "ready-to-rosify"
  | "with-carmen"
  | "with-rose"
  | "aligned"
  | "decided";

export type AlignmentStatus = "strong" | "partial" | "needs-clarity";

export type ThoughtLayer =
  | "Vision"
  | "Strategy"
  | "Execution"
  | "Experience"
  | "Impact";

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
}

export interface MindMeldItem {
  id: string;
  title: string;
  source: string;
  owner: "Rose" | "Carmen";
  status: MindMeldStatus;
  roseThoughts: string;
  carmenThoughts: string;
  synthesis: string;
  openQuestions: string[];
  alignment: AlignmentStatus;
  alignmentScore: number;
  risk: RiskLevel;
  privacy: PrivacyLevel;
  nextHandoff: "rose" | "carmen" | null;
  finalOutcome: string | null;
  layers: ThoughtLayer[];
  focusAreas: string[];
  roseFeedback?: string[];
  carmenFeedback?: string[];
  sensitive: boolean;
  history: AuditEntry[];
}

export interface Handoff {
  id: string;
  itemId: string;
  itemTitle: string;
  from: "Rose" | "Carmen";
  to: "Rose" | "Carmen";
  layer: ThoughtLayer;
  timestamp: string;
  note: string;
}

export interface MindFeedEntry {
  id: string;
  actor: "Rose" | "Carmen" | "Rose OS";
  action: string;
  layer: ThoughtLayer;
  timestamp: string;
}

export interface Recommendation {
  id: string;
  source: string;
  category:
    | "duplicate"
    | "team-pulse"
    | "sop-update"
    | "automation"
    | "mockup-prompt"
    | "market"
    | "mind-meld-handoff"
    | "company-record"
    | "sensitive"
    | "final-decision"
    | "external-intake";
  recommendation: string;
  classification: Classification;
  risk: RiskLevel;
  requiredApprover: ApprovalRoute;
  status: ApprovalStatus;
  approvals?: { rose: boolean; carmen: boolean };
  history: AuditEntry[];
}

export interface IntegrationStatus {
  name: string;
  status: string;
  state: "simulated" | "future" | "planned" | "disabled" | "sample";
}

export interface AppSettings {
  duplicateSensitivity: number;
  alertThreshold: number;
  reportCadence: "daily" | "weekly" | "monthly";
  competitors: string[];
  marketKeywords: string[];
  mindMeldPrivate: boolean;
  emailAlerts: boolean;
  zohoCliqMode: IntegrationMode;
  whatsappMode: IntegrationMode;
  lastTestMessageAt: string | null;
}

export type IntegrationMode = "off" | "test" | "live";

export type IntakeSource = "zoho_cliq" | "whatsapp" | "manual";

export type IntakeDetectedType =
  | "idea"
  | "todo"
  | "build_request"
  | "decision_candidate"
  | "blocker"
  | "question"
  | "process_update"
  | "crm_or_zoho_request"
  | "automation_request"
  | "rose_carmen_mind_meld"
  | "company_brain_update_suggestion"
  | "sensitive_private_item"
  | "ignore_or_noise";

export type IntakeDestination =
  | "mind-meld"
  | "review-queue"
  | "command-center-task"
  | "idea-backlog"
  | "build-registry"
  | "requirements-registry"
  | "automation-registry"
  | "decision-log"
  | "company-brain-update"
  | "no-action";

export type IntakeSensitivity =
  | "normal"
  | "private_leadership"
  | "client_sensitive"
  | "hr_sensitive"
  | "financial_sensitive"
  | "legal_sensitive"
  | "unclear";

export type IntakeReviewOwner =
  | "Rose"
  | "Carmen"
  | "Rose and Carmen"
  | "Assigned team member"
  | "Unassigned";

export type IntakeStatus =
  | "new"
  | "needs_review"
  | "routed"
  | "approved"
  | "rejected"
  | "archived";

export type IntakeDuplicateRisk = "none" | "possible" | "likely";

export interface IntakeClassification {
  detectedType: IntakeDetectedType;
  suggestedDestination: IntakeDestination;
  sensitivity: IntakeSensitivity;
  reviewOwner: IntakeReviewOwner;
  nextStep: string;
  reason: string;
}

export type ReadinessLevel = "not-ready" | "needs-details" | "review-ready" | "build-ready";

export interface ReadinessCategoryScore {
  category:
    | "Vision clarity"
    | "Systems clarity"
    | "Owner clarity"
    | "Next-step clarity"
    | "Source support"
    | "Privacy readiness"
    | "Build readiness"
    | "Approval readiness";
  score: number;
  note: string;
}

export interface ReadinessResult {
  level: ReadinessLevel;
  overall: number;
  categories: ReadinessCategoryScore[];
  missing: string[];
  recommendedNextStep: string;
}

export interface FrictionFlag {
  label: string;
  detail: string;
  suggestedFix: string;
  severity: "low" | "medium" | "high";
}

export type MemoryDestination =
  | "private-rose-carmen-memory"
  | "company-brain-suggestion"
  | "project-note"
  | "future-idea"
  | "decision-candidate"
  | "knowledge-gap-report";

export interface MemoryCandidate {
  id: string;
  sourceIntakeId: string | null;
  summary: string;
  destination: MemoryDestination;
  status: "proposed" | "approved" | "rejected";
  sensitive: boolean;
  createdBy: string;
  createdAt: string;
}

export type MindMeldTimelineEventType =
  | "original-message"
  | "rose-thought"
  | "carmen-thought"
  | "synthesis"
  | "open-question"
  | "routing-action"
  | "decision-candidate"
  | "approved-direction"
  | "brain-update-suggestion"
  | "build-request"
  | "archived";

export interface MindMeldTimelineEvent {
  id: string;
  itemTitle: string;
  type: MindMeldTimelineEventType;
  actor: "Rose" | "Carmen" | "Rose OS" | "System";
  text: string;
  timestamp: string;
  sensitive: boolean;
  needs: "rose" | "carmen" | "both" | null;
  readyTo: "carmenfy" | "rosify" | null;
  finalized: boolean;
}

export interface IntakeItem {
  id: string;
  source: IntakeSource;
  sourceChannel: string;
  senderName: string;
  senderHandle: string;
  senderRole: string | null;
  receivedAt: string;
  rawMessage: string;
  cleanedSummary: string;
  detectedType: IntakeDetectedType;
  suggestedDestination: IntakeDestination;
  sensitivity: IntakeSensitivity;
  reviewOwner: IntakeReviewOwner;
  status: IntakeStatus;
  duplicateRisk: IntakeDuplicateRisk;
  relatedProjectNames: string[];
  reviewerNotes: string;
  finalActionTaken: string | null;
  nextStep: string;
  classificationReason: string;
  auditLog: AuditEntry[];
}
