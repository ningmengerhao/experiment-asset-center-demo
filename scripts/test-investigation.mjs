import assert from "node:assert/strict";
import {
  allowedTransitions,
  buildInvestigationHash,
  loadInvestigationContext,
  mergeEvidenceEvents,
  parseInvestigationLocation,
  recoverInvestigationLocation,
  saveInvestigationContext,
  transitionInvestigation,
} from "../src/investigation.mjs";

const context = {
  caseId: "CASE-240820-001",
  experimentId: "EXP-240611-017",
  alertId: "ALT-003",
  timeRange: "14d",
  entrySource: "monitor",
  evidenceFocus: "rollout",
  status: "investigating",
  owner: "赵晨",
  collaborators: ["陈露"],
  resolution: "",
  updatedAt: "2026-08-20 10:30",
  actions: [],
};

assert.equal(Object.isFrozen(allowedTransitions), true, "transition map is frozen");
assert.equal(Object.values(allowedTransitions).every((targets) => Object.isFrozen(targets)), true, "transition targets are frozen");
const investigatingTargets = [...allowedTransitions.investigating];
assert.throws(() => allowedTransitions.investigating.push("closed"), TypeError, "nested transition targets reject mutation");
assert.throws(() => { allowedTransitions.idle = ["closed"]; }, TypeError, "transition map rejects mutation");
assert.deepEqual(allowedTransitions.investigating, investigatingTargets, "mutation does not alter transition rules");

const hash = buildInvestigationHash("investigate", context);
assert.equal(hash, "#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=rollout");

const parsed = parseInvestigationLocation(hash);
assert.equal(parsed.tab, "investigate");
assert.equal(parsed.context?.experimentId, context.experimentId);
assert.equal(parsed.context?.alertId, context.alertId);
assert.equal(parsed.context?.timeRange, context.timeRange);
assert.equal(parsed.context?.evidenceFocus, context.evidenceFocus);

const invalidLocationCases = [
  ["invalid route", "#invalid-route?<img src=x onerror=alert(1)>"],
  ["invalid query encoding", "#investigate?experiment=%E0%A4%A"],
  ["dangerous experiment", "#investigate?experiment=EXP%3Cscript%3E"],
  ["dangerous alert", "#investigate?experiment=EXP-240611-017&alert=ALT%3Cscript%3E"],
  ["invalid range", "#investigate?experiment=EXP-240611-017&range=365d"],
  ["invalid focus", "#investigate?experiment=EXP-240611-017&focus=script"],
];
for (const [name, location] of invalidLocationCases) {
  assert.deepEqual(parseInvestigationLocation(location), { tab: "evaluate", context: null }, name);
}

assert.equal(parseInvestigationLocation("#governance").tab, "governance");
assert.equal(buildInvestigationHash("not-a-tab", context), "#evaluate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=rollout");

const buildCases = [
  ["valid context", context, "#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=rollout"],
  ["dangerous experiment", { ...context, experimentId: "EXP&<script>" }, "#investigate"],
  ["dangerous alert", { ...context, alertId: "ALT&<script>" }, "#investigate?experiment=EXP-240611-017&range=14d&focus=rollout"],
];
for (const [name, input, expected] of buildCases) {
  const built = buildInvestigationHash("investigate", input);
  assert.equal(built, expected, name);
  if (input.experimentId === context.experimentId) assert.equal(buildInvestigationHash(parseInvestigationLocation(built).tab, parseInvestigationLocation(built).context), built, `${name} roundtrip`);
}

assert.deepEqual(
  mergeEvidenceEvents([
    { id: "2", occurredAt: "2026-08-19 10:00", title: "older" },
    { id: "1", occurredAt: "2026-08-20 10:00", title: "newer" },
    { id: "1", occurredAt: "2026-08-20 10:00", title: "duplicate" },
    { id: "3", occurredAt: "2026-08-20 10:00", title: "same-time" },
  ]).map((item) => item.id),
  ["1", "3", "2"],
);

const resolved = transitionInvestigation(context, "resolved", "已定位到放量变更");
assert.equal(resolved.status, "resolved");
assert.equal(resolved.resolution, "已定位到放量变更");
assert.equal(resolved.actions.length, 1);
assert.equal(resolved.actions[0].from, "investigating");
assert.equal(resolved.actions[0].to, "resolved");
assert.equal(context.actions.length, 0);
assert.equal(transitionInvestigation({ ...context, status: "idle" }, "investigating", "开始排查").status, "investigating");
assert.equal(transitionInvestigation(context, "collaborating", "邀请协作").status, "collaborating");
assert.equal(transitionInvestigation(resolved, "closed", "完成归档").status, "closed");
assert.throws(() => transitionInvestigation(context, "closed", "跳过定位"), /invalid transition/);
assert.throws(() => transitionInvestigation({ ...context, status: "unknown" }, "investigating", "非法状态"), /invalid transition/);

const memoryStorage = new Map();
const storage = {
  getItem(key) {
    return memoryStorage.get(key) ?? null;
  },
  setItem(key, value) {
    memoryStorage.set(key, value);
  },
  removeItem(key) {
    memoryStorage.delete(key);
  },
};
saveInvestigationContext(context, storage);
assert.equal(loadInvestigationContext(storage)?.experimentId, context.experimentId);
saveInvestigationContext(null, storage);
assert.equal(loadInvestigationContext(storage), null);
memoryStorage.set("experiment-asset-investigation-v1", "not json");
assert.equal(loadInvestigationContext(storage), null);

const validAction = {
  id: "action-1",
  from: "investigating",
  to: "resolved",
  operator: "赵晨",
  note: "已定位到放量变更",
  occurredAt: "2026-08-20 10:40",
};
const invalidStoredContextCases = [
  ["invalid experiment", { experimentId: "EXP<script>" }],
  ["invalid alert", { alertId: "ALT<script>" }],
  ["invalid status", { status: "unknown" }],
  ["action missing id", { actions: [{ ...validAction, id: 1 }] }],
  ["action invalid from status", { actions: [{ ...validAction, from: "unknown" }] }],
  ["action invalid to status", { actions: [{ ...validAction, to: "unknown" }] }],
  ["action invalid operator", { actions: [{ ...validAction, operator: 1 }] }],
  ["action invalid note", { actions: [{ ...validAction, note: 1 }] }],
  ["action invalid time", { actions: [{ ...validAction, occurredAt: 1 }] }],
];
for (const [name, overrides] of invalidStoredContextCases) {
  memoryStorage.set("experiment-asset-investigation-v1", JSON.stringify({ ...context, ...overrides }));
  assert.equal(loadInvestigationContext(storage), null, name);
}

function createRecoveryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const recoveryCases = [
  {
    name: "same experiment URL fields override stored context",
    hash: "#investigate?experiment=EXP-240611-017&range=7d&focus=seed",
    expected: ["investigate", "EXP-240611-017", "CASE-240820-001", "7d", "seed", false, true],
  },
  {
    name: "cross experiment URL wins over stored context",
    hash: "#investigate?experiment=EXP-240615-022&range=7d&focus=rollout",
    expected: ["investigate", "EXP-240615-022", "", "7d", "rollout", false, true],
  },
  {
    name: "invalid hash preserves a valid stored context",
    hash: "#invalid-route?experiment=EXP-240615-022",
    expected: ["evaluate", "EXP-240611-017", "CASE-240820-001", "14d", "rollout", true, false],
  },
  {
    name: "empty-tab malformed hash preserves a valid stored context",
    hash: "#?bad",
    expected: ["evaluate", "EXP-240611-017", "CASE-240820-001", "14d", "rollout", true, false],
  },
  {
    name: "bare hash is normal evaluation recovery",
    hash: "",
    expected: ["evaluate", "EXP-240611-017", "CASE-240820-001", "14d", "rollout", false, false],
  },
  {
    name: "no contextual URL restores stored context without persistence",
    hash: "#lineage",
    expected: ["lineage", "EXP-240611-017", "CASE-240820-001", "14d", "rollout", false, false],
  },
  {
    name: "direct contextual URL without storage requests persistence",
    hash: "#investigate?experiment=EXP-240615-022&range=30d&focus=validation",
    stored: false,
    expected: ["investigate", "EXP-240615-022", "", "30d", "validation", false, true],
  },
];

for (const { name, hash: recoveryHash, stored = true, expected } of recoveryCases) {
  const recoveryStorage = createRecoveryStorage();
  if (stored) saveInvestigationContext(context, recoveryStorage);
  const recovered = recoverInvestigationLocation(recoveryHash, recoveryStorage);
  assert.deepEqual(
    [
      recovered.tab,
      recovered.context?.experimentId,
      recovered.context?.caseId,
      recovered.context?.timeRange,
      recovered.context?.evidenceFocus,
      recovered.invalidHash,
      recovered.shouldPersist,
    ],
    expected,
    name,
  );
}

const crossExperimentStorage = createRecoveryStorage();
saveInvestigationContext(context, crossExperimentStorage);
const crossExperimentRecovery = recoverInvestigationLocation(
  "#investigate?experiment=EXP-240615-022&range=7d&focus=rollout",
  crossExperimentStorage,
);
saveInvestigationContext(crossExperimentRecovery.context, crossExperimentStorage);
assert.equal(
  recoverInvestigationLocation("#rollout", crossExperimentStorage).context?.experimentId,
  "EXP-240615-022",
  "persisting a cross-experiment URL prevents the old experiment from resurfacing",
);

const unavailableStorage = {
  getItem() {
    throw new Error("storage unavailable");
  },
  setItem() {
    throw new Error("storage unavailable");
  },
  removeItem() {
    throw new Error("storage unavailable");
  },
};
assert.equal(loadInvestigationContext(unavailableStorage), null);
assert.doesNotThrow(() => saveInvestigationContext(context, unavailableStorage));
assert.doesNotThrow(() => saveInvestigationContext(null, unavailableStorage));

console.log("Investigation logic verification passed.");
