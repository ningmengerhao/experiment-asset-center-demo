export type InvestigationStatus = "idle" | "investigating" | "collaborating" | "resolved" | "closed";
export type EvidenceFocus = "overview" | "relationship" | "rollout" | "seed" | "validation" | "metric";

export interface ResolutionAction {
  id: string;
  from: InvestigationStatus;
  to: InvestigationStatus;
  operator: string;
  note: string;
  occurredAt: string;
}

export interface InvestigationContext {
  caseId: string;
  experimentId: string;
  alertId?: string;
  timeRange: "7d" | "14d" | "30d";
  entrySource: "monitor" | "list" | "relationship" | "rollout" | "validation" | "detail";
  evidenceFocus: EvidenceFocus;
  status: InvestigationStatus;
  owner: string;
  collaborators: string[];
  resolution: string;
  updatedAt: string;
  actions: ResolutionAction[];
}

export interface EvidenceEvent {
  id: string;
  experimentId: string;
  occurredAt: string;
  type: "alert" | "rollout" | "seed" | "relationship" | "validation" | "audit";
  title: string;
  summary: string;
  sourcePlatform: string;
  operator: string;
  severity: "info" | "warning" | "critical";
  requiresAction: boolean;
}

export interface InvestigationLocationRecovery {
  tab: string;
  context: InvestigationContext | null;
  invalidHash: boolean;
  shouldPersist: boolean;
}

export const INVESTIGATION_STORAGE_KEY: "experiment-asset-investigation-v1";
export const allowedTransitions: Readonly<Record<InvestigationStatus, readonly InvestigationStatus[]>>;

export function parseInvestigationLocation(hash: string): { tab: string; context: InvestigationContext | null };
export function recoverInvestigationLocation(hash: string, storage?: Storage): InvestigationLocationRecovery;
export function buildInvestigationHash(tab: string, context?: InvestigationContext | null): string;
export function mergeEvidenceEvents(events: EvidenceEvent[]): EvidenceEvent[];
export function transitionInvestigation(context: InvestigationContext, next: InvestigationStatus, note: string): InvestigationContext;
export function loadInvestigationContext(storage?: Storage): InvestigationContext | null;
export function saveInvestigationContext(context: InvestigationContext | null, storage?: Storage): void;
