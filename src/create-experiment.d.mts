export type CreateStep = "basic" | "sample" | "seed" | "validation";

export interface CreateExperimentDraft {
  savedStep: CreateStep;
  basic: { name: string; businessLine: string; owner: string; coreMetric: string; guardrailMetric: string; hypothesis: string };
  sample: { baseline: number; mde: number; confidence: number; power: number; groups: number; dailyTraffic: number; identityCoverage: number; maxDays: number; stableDays: number; guardrailCount: number; businessValue: number };
  seed: { sampleUnit: string; domain: string; candidateCount: number; template: string; selectedSeed: string };
  validation: { scope: "全部运行实验" | "同业务域" | "同分流层" | "手动指定"; manualExperimentIds: string[] };
}

export const CREATE_STEPS: CreateStep[];
export const CREATE_DRAFT_STORAGE_KEY: string;
export const CREATED_RECORDS_STORAGE_KEY: string;
export function normalizeCreateStep(value: unknown): CreateStep;
export function createDefaultDraft(): CreateExperimentDraft;
export function createHash(step: unknown): string;
export function readCreateStep(hash: string): CreateStep;
export function validateCreateStep(draft: CreateExperimentDraft, step: CreateStep): string[];
export function loadCreateDraft(storage?: Storage): CreateExperimentDraft | null;
export function saveCreateDraft(draft: CreateExperimentDraft, storage?: Storage): boolean;
export function clearCreateDraft(storage?: Storage): void;
export function loadCreatedRecords(storage?: Storage): unknown[];
export function saveCreatedRecords(records: unknown[], storage?: Storage): boolean;
