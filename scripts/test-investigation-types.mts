import {
  allowedTransitions,
  buildInvestigationHash,
  mergeEvidenceEvents,
  parseInvestigationLocation,
  recoverInvestigationLocation,
  transitionInvestigation,
  type EvidenceEvent,
  type InvestigationContext,
} from "../src/investigation.mjs";

const context: InvestigationContext = {
  caseId: "CASE-240820-001",
  experimentId: "EXP-240611-017",
  timeRange: "14d",
  entrySource: "monitor",
  evidenceFocus: "overview",
  status: "investigating",
  owner: "赵晨",
  collaborators: [],
  resolution: "",
  updatedAt: "2026-08-20 10:30",
  actions: [],
};

const evidence: EvidenceEvent[] = [{
  id: "event-1",
  experimentId: context.experimentId,
  occurredAt: "2026-08-20 10:30",
  type: "alert",
  title: "指标异常",
  summary: "需要排查",
  sourcePlatform: "实验平台",
  operator: "赵晨",
  severity: "warning",
  requiresAction: true,
}];

const location = parseInvestigationLocation(buildInvestigationHash("investigate", context));
const recovery = recoverInvestigationLocation(buildInvestigationHash("investigate", context));
const nextContext: InvestigationContext = transitionInvestigation(context, "resolved", "已定位到放量变更");
const merged: EvidenceEvent[] = mergeEvidenceEvents(evidence);

void location;
void recovery.tab;
void recovery.context;
void recovery.invalidHash;
void recovery.shouldPersist;
void nextContext;
void merged;

// @ts-expect-error Transition target arrays are immutable for consumers.
allowedTransitions.investigating.push("closed");
// @ts-expect-error The transition map is immutable for consumers.
allowedTransitions.idle = ["closed"];

// @ts-expect-error Invalid statuses must be rejected for consumers.
transitionInvestigation(context, "invalid", "不允许的状态");
