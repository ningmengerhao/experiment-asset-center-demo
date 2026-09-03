export type CreateStep = "basic" | "sample" | "seed" | "validation";
export interface CreateSplitGroup { id: string; label: string; ratio: number }
export interface GeneratedSeedConfig { key: string; domain: string; sampleUnit: string; candidateCount: number; template: string; attempts: number; splitGroups: CreateSplitGroup[] }

export interface CreateExperimentDraft {
  savedStep: CreateStep;
  recordId: string;
  basic: { name: string; businessLine: string; domain: string; owner: string; experimentType: string; planStartDate: string; coreMetricId: string; guardrailMetricIds: string[]; sampleRange: { sourceKind: "sql" | "task"; sourceId: string; sql: string; taskId: string; startDate: string; endDate: string; filterCondition: string }; coreMetric: string; guardrailMetric: string; hypothesis: string };
  sample: { baseline: number; mde: number; confidence: number; power: number; splitGroups: CreateSplitGroup[]; dailyTraffic: number; identityCoverage: number; maxDays: number; stableDays: number; guardrailCount: number; businessValue: number };
  seed: { sampleUnit: string; candidateCount: number; template: string; customSeed: string; customCandidate: string; selectedSeed: string; generated: GeneratedSeedConfig };
  validation: { scope: "全部运行实验" | "同业务域" | "同分流层" | "手动指定"; manualExperimentIds: string[] };
}

export const CREATE_STEPS: CreateStep[];
export const CREATE_DRAFT_STORAGE_KEY: string;
export const CREATED_RECORDS_STORAGE_KEY: string;
export const CUSTOM_SEED_PATTERN: RegExp;
export const EXPERIMENT_STATUS_TRANSITIONS: Readonly<Record<string, Readonly<{ action: string; next: string }>>>;
export const EXPERIMENT_STATUS_ACTIONS: Readonly<Record<string, readonly Readonly<{ action: string; next: string }>[]>>;
export const DEFAULT_SPLIT_GROUPS: CreateSplitGroup[];
export function normalizeSplitGroups(value: unknown): CreateSplitGroup[];
export function validateSplitGroups(value: unknown): string[];
export function calculateSplitSamplePlan(perGroup: number, value: unknown): { total: number; minimumRatio: number; groups: Array<CreateSplitGroup & { samples: number }> };
export interface CreateFeasibilityDimension { label: string; status: "passed" | "warning" | "critical"; detail: string }
export interface CreateSampleAssessment { perGroup: number; total: number; days: number; periodStatus: "passed" | "warning" | "critical"; splitTotal: number; splitErrors: string[]; splitMessage: string; splitPlan: { total: number; minimumRatio: number; groups: Array<CreateSplitGroup & { samples: number }> }; recommendation: { label: string; advice: string }; dimensions: CreateFeasibilityDimension[] }
export function calculateCreateSampleAssessment(sample: CreateExperimentDraft["sample"]): CreateSampleAssessment;
export function isSeedGenerationCurrent(draft: CreateExperimentDraft): boolean;
export function isValidCustomSeed(value: unknown): boolean;
export function getExperimentStatusAction(status: unknown): { action: string; next: string } | null;
export function getExperimentStatusActions(status: unknown): readonly { action: string; next: string }[];
export function canDeleteExperiment(status: unknown): boolean;
export function rankCandidateResults<T extends { quality: "passed" | "warning" | "critical"; score: number; seed: string }>(candidates: T[]): T[];
export function createShortSeedSuffix(generationKey: unknown, index: number): string;
export function normalizeCreateStep(value: unknown): CreateStep;
export function createDefaultDraft(): CreateExperimentDraft;
export function createHash(step: unknown): string;
export function readCreateStep(hash: string): CreateStep;
export function validateCreateStep(draft: CreateExperimentDraft, step: CreateStep): string[];
export function migrateFilterCondition(sampleRange: unknown, defaults?: CreateExperimentDraft["basic"]["sampleRange"]): CreateExperimentDraft["basic"]["sampleRange"];
export function loadCreateDraft(storage?: Storage): CreateExperimentDraft | null;
export function saveCreateDraft(draft: CreateExperimentDraft, storage?: Storage): boolean;
export function clearCreateDraft(storage?: Storage): void;
export function loadCreatedRecords(storage?: Storage): unknown[];
export function createDraftFromExperimentRecord(record: unknown): CreateExperimentDraft;
export function normalizeCreatedRecords(records: unknown): unknown[];
export function saveCreatedRecords(records: unknown[], storage?: Storage): boolean;
