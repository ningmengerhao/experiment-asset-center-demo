export type AnalysisRange = "7d" | "14d" | "30d";
export type CandidateStatus = "high_confidence" | "pending_verification";
export interface EffectInversionEvent { id: string; experimentId: string; range: AnalysisRange; metric: string; expectedDirection: "up" | "down"; actualEffect: number; pValue: number; consecutiveWindows: number; affectedTraffic: number; startedAt: string; detectedAt: string; trend: number[] }
export interface CandidateVerification { experimentId: string; owner: string; score: number; status: CandidateStatus; sampleOverlap: number; rolloutAlignment: number; layerOverlap: number; metricSync: number; registeredRelation: number }
export interface AttributionCase { id: string; experimentId: string; eventId: string; range: AnalysisRange; createdAt: string; updatedAt: string; status: "investigating" | "collaborating" | "resolved"; verifications: CandidateVerification[] }
export interface CollaborationNotice { id: string; caseId: string; candidateExperimentId: string; targetExperimentId: string; recipient: string; createdAt: string; read: boolean; text: string }
export const ANALYSIS_RANGES: readonly AnalysisRange[];
export const EFFECT_INVERSION_EVENTS: readonly EffectInversionEvent[];
export function findEffectInversionEvent(experimentId: string, range: AnalysisRange): EffectInversionEvent | null;
export function detectEffectInversion(event: EffectInversionEvent | null, mde: number, expectedDirection?: "up" | "down"): { detected: boolean; severity: "info" | "warning" | "critical"; direction?: "up" | "down"; magnitude?: number; threshold?: number; reason: string };
export function buildLayerDrilldowns(): Array<{ dimension: string; value: string; loss: number; contribution: number; detail: string }>;
export function scanRunningExperiments(target: any, experiments: any[], relationships?: any[]): CandidateVerification[];
export function projectCandidateVerification(verification: CandidateVerification, experiment: any, canView: boolean): any;
export function isCollaborationNoticeEligible(verification: CandidateVerification): boolean;
export function createCollaborationNotice(input: { caseId: string; verification: CandidateVerification; targetExperimentId: string; createdAt: string }): CollaborationNotice;
export function buildMissingCollaborationNotices(cases: AttributionCase[], existingNotices?: CollaborationNotice[]): CollaborationNotice[];
