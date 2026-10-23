import assert from "node:assert/strict";
import { INITIAL_IMPORT_BATCHES, INITIAL_METRICS, INITIAL_SAMPLE_SOURCES, appendFilterCondition, canAccess, createInitialDemoState, getAccount, hasDomainAccess, loadDemoState, resolveHistoricalSnapshot, validateFilterCondition, validateSampleSql } from "../src/demo-access.mjs";

const state = createInitialDemoState();
const admin = getAccount("admin.zhao", state);
const fullEditor = getAccount("editor.wu", state);
const viewer = getAccount("viewer.sun", state);
const growthMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-001");
const tradeMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-005");
const memberMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-003");
const growthSource = INITIAL_SAMPLE_SOURCES.find((source) => source.id === "SRC-GROWTH-TABLE");

assert.equal(INITIAL_METRICS.every((metric) => !("type" in metric)), true);

assert.equal(canAccess(state, admin, "metric.edit", growthMetric), true);
assert.equal(canAccess(state, fullEditor, "metric.edit", tradeMetric), true);
assert.equal(canAccess(state, fullEditor, "metric.edit", memberMetric), true);
assert.equal(hasDomainAccess(state, viewer, { domain: "增长" }), true);
assert.equal(hasDomainAccess(state, viewer, { domain: "搜索" }), false);
assert.equal(canAccess(state, viewer, "experiment.view", { id: "EXP-240618-006", domain: "搜索", owner: "刘昕" }), false, "resource grants and ownership cannot bypass domain visibility");
assert.equal(canAccess(state, viewer, "experiment.view", { id: "EXP-240611-017", domain: "会员", owner: "陈露" }), false);
assert.equal(canAccess(state, fullEditor, "experiment.edit", { id: "EXP-240610-001", businessLine: "增长", owner: "赵晨" }), true);
assert.equal(canAccess(state, fullEditor, "access.approve"), false);
assert.equal(canAccess(state, viewer, "sample.use", growthSource), false);

const grantState = {
  ...state,
  grants: [
    { id: "GRANT-METRIC-EDIT", accountId: viewer.id, scope: "metric", resourceId: growthMetric.id, permissions: ["metric.edit"], expiresAt: "2026-12-31" },
    { id: "GRANT-EXPERIMENT-EDIT", accountId: viewer.id, scope: "experiment", resourceId: "EXP-240610-001", permissions: ["experiment.edit"], expiresAt: "2026-12-31" },
  ],
};
assert.equal(canAccess(grantState, viewer, "metric.edit", growthMetric), true);
assert.equal(canAccess(grantState, viewer, "metric.view", growthMetric), true, "metric edit grants must imply view access");
assert.equal(canAccess(grantState, viewer, "experiment.edit", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), true);
assert.equal(canAccess(grantState, viewer, "experiment.view", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), true, "experiment edit grants must imply view access");
assert.equal(canAccess(grantState, viewer, "experiment.lifecycle", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), true, "editing must permit experiment status operations");
assert.equal(canAccess({ ...grantState, grants: [{ id: "GRANT-HIDDEN", accountId: viewer.id, scope: "metric", resourceId: memberMetric.id, permissions: ["metric.edit"], expiresAt: "2026-12-31" }] }, viewer, "metric.view", memberMetric), false, "resource-level grants cannot reveal a hidden business domain");
assert.equal(INITIAL_IMPORT_BATCHES.every((batch) => batch.status !== "待管理员审核"), true);

const storage = new Map();
storage.set("experiment-asset-demo-access-v1", JSON.stringify({ requests: [{ id: "REQ-OLD", permission: "metric.view" }] }));
const migratedState = loadDemoState({ getItem: (key) => storage.get(key) ?? null });
assert.deepEqual(migratedState.requests[0].permissions, ["metric.view"], "legacy scalar request permissions must migrate");
assert.equal(migratedState.accounts.every((account) => ["admin", "user"].includes(account.role)), true, "legacy accounts must migrate to the two account types");

assert.equal(validateSampleSql("SELECT user_id FROM growth.user_activity_daily WHERE dt BETWEEN '${BATCH_DATE_START}' AND '${BATCH_DATE_END}'").valid, true);
assert.equal(validateSampleSql("SELECT * FROM t WHERE dt='${BATCH_DATE}'").valid, false);
assert.equal(validateSampleSql("DELETE FROM t").valid, false);
assert.equal(validateFilterCondition("entry = 'new_home'").valid, true);
assert.equal(validateFilterCondition("WHERE entry = 'new_home'").valid, false);
assert.equal(validateFilterCondition("1 = 1; DELETE FROM t").valid, false);
assert.equal(appendFilterCondition("SELECT user_id FROM growth.user_activity_daily", "entry = 'new_home'"), "SELECT user_id FROM growth.user_activity_daily\nWHERE entry = 'new_home'");
assert.equal(appendFilterCondition("SELECT user_id FROM growth.user_activity_daily WHERE dt = '${BATCH_DATE_START}'", "entry = 'new_home'"), "SELECT user_id FROM growth.user_activity_daily WHERE dt = '${BATCH_DATE_START}'\nAND (entry = 'new_home')");
assert.equal(appendFilterCondition("SELECT user_id FROM growth.user_activity_daily", ""), "SELECT user_id FROM growth.user_activity_daily");

const snapshot = resolveHistoricalSnapshot(growthSource, "2026-08-19", "2026-09-01");
assert.equal(snapshot.baseline, 8.2);
assert.equal(snapshot.dailyTraffic, 180000);
assert.equal(snapshot.startDate, "2026-08-19");

console.log("Demo access verification passed.");
