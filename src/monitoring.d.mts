export type RuleActor = {
  role: "admin" | "experimentOwner" | "viewer";
  name: string;
};

export type AlertRuleAudit = {
  id: string;
  actor: string;
  action: string;
  note: string;
  occurredAt: string;
};

export type AlertRule = {
  id: string;
  name: string;
  experimentId: string;
  owner: string;
  metric: string;
  operator: string;
  threshold: number;
  consecutiveWindows: number;
  severity: string;
  status: "draft" | "enabled" | "disabled";
  version: number;
  updatedAt?: string;
  audit: AlertRuleAudit[];
};

export type AlertRuleLimits = {
  threshold: { min: number; max: number };
  consecutiveWindows: { min: number; max: number };
};

export type AttributionCandidate = {
  experimentId: string;
  owner: string;
  sampleOverlap: number;
  rolloutAlignment: number;
  layerOverlap: number;
  metricSync: number;
  registeredRelation: number;
  visible: boolean;
  strategy?: string;
  metricDetail?: string;
  [key: string]: unknown;
};

export function validateAlertRule(rule: AlertRule, limits: AlertRuleLimits): { valid: boolean; errors: string[] };
export function canManageRule(actor: RuleActor, rule: AlertRule): boolean;
export function transitionAlertRule(rule: AlertRule, action: "enable" | "disable", actor: RuleActor, note?: string): AlertRule;
export function rankAttributionCandidates(
  target: { experimentId: string },
  candidates: AttributionCandidate[],
): Array<AttributionCandidate & { score: number; evidence: Array<{ key: string; label: string; value: number; weight: number; contribution: number }> }>;
export const attributionWeights: Readonly<Record<"sampleOverlap" | "rolloutAlignment" | "layerOverlap" | "metricSync" | "registeredRelation", number>>;
