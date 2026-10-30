import assert from "node:assert/strict";
import { INITIAL_IMPORT_BATCHES, INITIAL_METRICS, INITIAL_SAMPLE_SOURCES, ROLE_PERMISSION_OPTIONS, appendFilterCondition, canAccess, canApproveExperimentRequest, canListExperiment, canRequestExperimentPermission, canRequestMetricEdit, createInitialDemoState, getAccount, hasDomainAccess, loadDemoState, resolveHistoricalSnapshot, sortExperimentsByResourceAccess, validateFilterCondition, validateSampleSql } from "../src/demo-access.mjs";

const state = createInitialDemoState();
assert.deepEqual(state.businessDomains, ["增长", "会员", "推荐", "交易", "搜索"], "fresh demo state must persist the global business-domain catalog");
assert.equal(ROLE_PERMISSION_OPTIONS.find((option) => option.value === "experiment.view")?.label, "实验管理-查看", "role permissions must expose module-action Chinese UI labels");
const admin = getAccount("admin.zhao", state);
const fullEditor = getAccount("editor.wu", state);
const owner = getAccount("owner.chen", state);
const viewer = getAccount("viewer.sun", state);
const growthMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-001");
const tradeMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-005");
const memberMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-003");
const growthSource = INITIAL_SAMPLE_SOURCES.find((source) => source.id === "SRC-GROWTH-TABLE");

assert.equal(INITIAL_METRICS.every((metric) => !("type" in metric)), true);

assert.equal(canAccess(state, admin, "metric.edit", growthMetric), true);
assert.equal(canAccess(state, fullEditor, "metric.edit", tradeMetric), false, "metric editor qualification must not directly edit an existing metric");
assert.equal(canRequestMetricEdit(state, fullEditor, tradeMetric), true, "metric editor qualification may request a resource-level edit grant");
assert.equal(canAccess(state, fullEditor, "metric.edit", { domain: "交易" }), true, "metric editor qualification may create a metric in its domain");
assert.equal(hasDomainAccess(state, viewer, { domain: "增长" }), true);
assert.equal(hasDomainAccess(state, viewer, { domain: "搜索" }), false);
assert.equal(canAccess(state, viewer, "experiment.view", { id: "EXP-240618-006", domain: "搜索", owner: "刘昕" }), false, "resource grants and ownership cannot bypass domain visibility");
assert.equal(canAccess(state, viewer, "experiment.view", { id: "EXP-240611-017", domain: "会员", owner: "陈露" }), false);
const growthExperiment = { id: "EXP-240610-001", businessLine: "增长", owner: "赵晨" };
const memberOwnedExperiment = { id: "EXP-240611-017", businessLine: "会员", owner: "陈露" };
assert.equal(canListExperiment(state, viewer, growthExperiment), true, "business-domain view qualification may list an experiment");
assert.equal(canAccess(state, viewer, "experiment.view", growthExperiment), false, "business-domain visibility is not a resource-level view grant");
assert.equal(canRequestExperimentPermission(state, viewer, "experiment.view", growthExperiment), true);
assert.equal(canRequestExperimentPermission(state, viewer, "experiment.edit", growthExperiment), false, "view-only users may not request resource edit access");
assert.equal(canRequestExperimentPermission(state, fullEditor, "experiment.edit", growthExperiment), true);
assert.equal(canAccess(state, fullEditor, "experiment.edit", growthExperiment), false, "experiment editor qualification must not directly edit another experiment");
assert.equal(canAccess(state, owner, "experiment.edit", memberOwnedExperiment), true, "the owner may edit their own experiment in an accessible domain");
assert.equal(canAccess(state, owner, "experiment.lifecycle", memberOwnedExperiment), true, "the owner may operate their own experiment lifecycle");
assert.equal(canApproveExperimentRequest(state, owner, { scope: "experiment", status: "pending" }, memberOwnedExperiment), true, "the responsible owner may approve their own experiment's request");
assert.equal(canApproveExperimentRequest(state, fullEditor, { scope: "experiment", status: "pending" }, memberOwnedExperiment), false, "another editor may not approve the responsible owner's request");
assert.equal(canAccess(state, fullEditor, "access.approve"), false);
assert.equal(canAccess(state, viewer, "sample.use", growthSource), false);

const grantState = {
  ...state,
  grants: [
    { id: "GRANT-METRIC-EDIT", accountId: viewer.id, scope: "metric", resourceId: growthMetric.id, permissions: ["metric.edit"], expiresAt: "2026-12-31" },
    { id: "GRANT-EXPERIMENT-EDIT", accountId: viewer.id, scope: "experiment", resourceId: "EXP-240610-001", permissions: ["experiment.edit"], expiresAt: "2026-12-31" },
    { id: "GRANT-EXPERIMENT-VIEW", accountId: viewer.id, scope: "experiment", resourceId: "EXP-VIEW", permissions: ["experiment.view"], expiresAt: "2026-12-31" },
  ],
};
assert.equal(canAccess(grantState, viewer, "metric.edit", growthMetric), true);
assert.equal(canAccess(grantState, viewer, "metric.view", growthMetric), true, "metric edit grants must imply view access");
assert.equal(canAccess(grantState, viewer, "experiment.edit", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), true);
assert.equal(canAccess(grantState, viewer, "experiment.view", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), true, "experiment edit grants must imply view access");
assert.equal(canAccess(grantState, viewer, "experiment.lifecycle", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), true, "editing must permit experiment status operations");
assert.equal(canAccess({ ...state, grants: [{ id: "GRANT-PERMANENT", accountId: viewer.id, scope: "experiment", resourceId: "EXP-240610-001", permissions: ["experiment.edit"], expiresAt: null }] }, viewer, "experiment.edit", growthExperiment), true, "permanent grants without an expiry must remain active");
assert.equal(canAccess({ ...grantState, grants: [{ id: "GRANT-HIDDEN", accountId: viewer.id, scope: "metric", resourceId: memberMetric.id, permissions: ["metric.edit"], expiresAt: "2026-12-31" }] }, viewer, "metric.view", memberMetric), false, "resource-level grants cannot reveal a hidden business domain");
assert.equal(canAccess(state, viewer, "metric.view", growthMetric), true, "business-domain access grants metric viewing and use");
const orderedExperiments = sortExperimentsByResourceAccess(grantState, viewer, [
  { id: "EXP-REQUEST", domain: "增长", owner: "赵晨" },
  { id: "EXP-240610-001", domain: "增长", owner: "赵晨" },
  { id: "EXP-VIEW", domain: "增长", owner: "赵晨" },
]);
assert.deepEqual(orderedExperiments.map((experiment) => experiment.id), ["EXP-240610-001", "EXP-VIEW", "EXP-REQUEST"], "resource editors, viewers, and pending requests must sort by access priority");
assert.equal(INITIAL_IMPORT_BATCHES.every((batch) => batch.status !== "待管理员审核"), true);

const storage = new Map();
storage.set("experiment-asset-demo-access-v1", JSON.stringify({ requests: [{ id: "REQ-OLD", permission: "metric.view" }] }));
const migratedState = loadDemoState({ getItem: (key) => storage.get(key) ?? null });
assert.deepEqual(migratedState.requests[0].permissions, ["metric.view"], "legacy scalar request permissions must migrate");
assert.equal(migratedState.accounts.every((account) => ["admin", "user"].includes(account.role)), true, "legacy accounts must migrate to the two account types");
assert.equal(migratedState.businessDomains.includes("增长"), true, "legacy storage must receive the default business-domain catalog");

const catalogStorage = new Map();
catalogStorage.set("experiment-asset-demo-access-v1", JSON.stringify({
  businessDomains: ["增长运营"],
  roles: [{ id: "role-custom", name: "自定义", domains: ["增长运营"], permissions: ["experiment.view"], status: "active" }],
  accounts: [{ id: "custom.viewer", name: "自定义查看者", role: "user", roleIds: ["role-custom"], domains: ["增长运营"], ownedExperimentIds: [], status: "active" }],
  experimentOverrides: { "EXP-CUSTOM": { id: "EXP-CUSTOM", businessLine: "增长运营" } },
}));
const catalogState = loadDemoState({ getItem: (key) => catalogStorage.get(key) ?? null });
const catalogViewer = getAccount("custom.viewer", catalogState);
assert.deepEqual(catalogState.businessDomains, ["增长运营"], "saved business-domain catalogs must not be replaced by defaults");
assert.equal(hasDomainAccess(catalogState, catalogViewer, { domain: "增长运营" }), true, "new role-domain assignments must take effect globally");
assert.equal(catalogState.experimentOverrides["EXP-CUSTOM"].businessLine, "增长运营", "experiment overrides must survive state reloads");

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
