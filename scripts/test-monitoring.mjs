import assert from "node:assert/strict";
import {
  canManageRule,
  rankAttributionCandidates,
  transitionAlertRule,
  validateAlertRule,
} from "../src/monitoring.mjs";

const baseRule = {
  id: "RULE-001",
  name: "样本比例失衡",
  experimentId: "EXP-240611-017",
  owner: "陈露",
  metric: "样本比例",
  operator: ">",
  threshold: 2,
  consecutiveWindows: 2,
  severity: "critical",
  status: "enabled",
  version: 3,
  audit: [],
};

const limits = {
  threshold: { min: 0.1, max: 10 },
  consecutiveWindows: { min: 1, max: 6 },
};

assert.deepEqual(validateAlertRule(baseRule, limits), { valid: true, errors: [] });
assert.equal(validateAlertRule({ ...baseRule, threshold: 20 }, limits).valid, false);
assert.match(validateAlertRule({ ...baseRule, threshold: 20 }, limits).errors[0], /阈值/);
assert.equal(validateAlertRule({ ...baseRule, consecutiveWindows: 0 }, limits).valid, false);

assert.equal(canManageRule({ role: "admin", name: "赵晨" }, baseRule), true);
assert.equal(canManageRule({ role: "experimentOwner", name: "陈露" }, baseRule), true);
assert.equal(canManageRule({ role: "experimentOwner", name: "周一帆" }, baseRule), false);
assert.equal(canManageRule({ role: "viewer", name: "刘昕" }, baseRule), false);

const disabled = transitionAlertRule(baseRule, "disable", { role: "experimentOwner", name: "陈露" }, "维护窗口暂停");
assert.equal(disabled.status, "disabled");
assert.equal(disabled.version, 4);
assert.equal(disabled.audit.length, 1);
assert.equal(disabled.audit[0].actor, "陈露");
assert.equal(baseRule.status, "enabled", "状态流转不能修改原对象");
assert.throws(
  () => transitionAlertRule(baseRule, "disable", { role: "experimentOwner", name: "周一帆" }),
  /permission denied/,
);

const candidates = [
  {
    experimentId: "EXP-A",
    owner: "周一帆",
    sampleOverlap: 0.9,
    rolloutAlignment: 0.8,
    layerOverlap: 0.7,
    metricSync: 0.6,
    registeredRelation: 1,
    visible: true,
    strategy: "推荐排序策略",
    metricDetail: "入口点击率同向下降 5.2%",
  },
  {
    experimentId: "EXP-B",
    owner: "吴雅",
    sampleOverlap: 0.4,
    rolloutAlignment: 0.5,
    layerOverlap: 0.2,
    metricSync: 0.3,
    registeredRelation: 0,
    visible: false,
    strategy: "不可见策略",
    metricDetail: "不可见指标",
  },
];

const ranked = rankAttributionCandidates({ experimentId: "TARGET" }, candidates);
assert.deepEqual(ranked.map((item) => item.experimentId), ["EXP-A", "EXP-B"]);
assert.equal(ranked[0].score, 79.5);
assert.equal(ranked[0].evidence.length, 5);
assert.equal(ranked[1].strategy, undefined, "越出可见范围时必须脱敏策略");
assert.equal(ranked[1].metricDetail, undefined, "越出可见范围时必须脱敏指标明细");
assert.equal(ranked[1].owner, "吴雅", "脱敏后仍保留负责人以便协作");

console.log("Monitoring logic verification passed.");
