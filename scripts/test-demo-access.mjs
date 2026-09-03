import assert from "node:assert/strict";
import { INITIAL_METRICS, INITIAL_SAMPLE_SOURCES, appendFilterCondition, canAccess, createInitialDemoState, getAccount, resolveHistoricalSnapshot, validateFilterCondition, validateSampleSql } from "../src/demo-access.mjs";

const state = createInitialDemoState();
const admin = getAccount("admin.zhao");
const businessOwner = getAccount("business.liu");
const metricEditor = getAccount("metric.editor.wu");
const viewer = getAccount("viewer.sun");
const growthMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-001");
const tradeMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-005");
const memberMetric = INITIAL_METRICS.find((metric) => metric.id === "MET-003");
const growthSource = INITIAL_SAMPLE_SOURCES.find((source) => source.id === "SRC-GROWTH-TABLE");

assert.equal(INITIAL_METRICS.every((metric) => !("type" in metric)), true);

assert.equal(canAccess(state, admin, "metric.edit", growthMetric), true);
assert.equal(canAccess(state, metricEditor, "metric.edit", tradeMetric), true);
assert.equal(canAccess(state, metricEditor, "metric.edit", memberMetric), false);
assert.equal(canAccess(state, viewer, "experiment.view", { id: "EXP-240618-006", domain: "搜索", owner: "刘昕" }), true);
assert.equal(canAccess(state, viewer, "experiment.view", { id: "EXP-240610-001", domain: "增长", owner: "赵晨" }), false);
assert.equal(canAccess(state, businessOwner, "experiment.view", { id: "EXP-240610-001", businessLine: "增长", owner: "赵晨" }), true);
assert.equal(canAccess(state, viewer, "sample.use", growthSource), false);

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
