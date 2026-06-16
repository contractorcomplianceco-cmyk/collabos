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
    | "final-decision";
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
}
