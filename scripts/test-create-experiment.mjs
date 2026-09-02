import assert from "node:assert/strict";
import {
  calculateSplitSamplePlan,
  canDeleteExperiment,
  calculateCreateSampleAssessment,
  CREATED_RECORDS_STORAGE_KEY,
  CREATE_DRAFT_STORAGE_KEY,
  clearCreateDraft,
  createDraftFromExperimentRecord,
  createShortSeedSuffix,
  getExperimentStatusAction,
  getExperimentStatusActions,
  createDefaultDraft,
  createHash,
  loadCreateDraft,
  loadCreatedRecords,
  isSeedGenerationCurrent,
  isValidCustomSeed,
  normalizeCreateStep,
  normalizeCreatedRecords,
  readCreateStep,
  rankCandidateResults,
  saveCreateDraft,
  saveCreatedRecords,
  validateSplitGroups,
  validateCreateStep,
} from "../src/create-experiment.mjs";

const values = new Map();
const storage = {
  getItem(key) { return values.get(key) ?? null; },
  setItem(key, value) { values.set(key, value); },
  removeItem(key) { values.delete(key); },
};

const draft = createDefaultDraft();
assert.equal(draft.recordId, "");
assert.equal(isSeedGenerationCurrent(draft), true);
assert.equal(isSeedGenerationCurrent({ ...draft, basic: { ...draft.basic, domain: "会员" } }), false);
assert.equal(isValidCustomSeed("custom_seed:01"), true);
assert.equal(isValidCustomSeed("bad seed"), false);
assert.deepEqual(getExperimentStatusAction("pending"), { action: "上线", next: "running" });
assert.deepEqual(getExperimentStatusAction("running"), { action: "下线", next: "paused" });
assert.deepEqual(getExperimentStatusAction("paused"), { action: "上线", next: "running" });
assert.deepEqual(getExperimentStatusActions("paused"), [{ action: "上线", next: "running" }, { action: "终止", next: "ended" }]);
assert.equal(getExperimentStatusAction("ended"), null);
assert.equal(canDeleteExperiment("draft"), true);
assert.equal(canDeleteExperiment("pending"), true);
assert.equal(canDeleteExperiment("running"), false);
assert.equal(normalizeCreateStep("seed"), "seed");
assert.equal(normalizeCreateStep("unknown"), "basic");
assert.equal(createHash("validation"), "#create?step=validation");
assert.equal(readCreateStep("#create?step=sample"), "sample");
assert.equal(readCreateStep("#create?step=unsafe"), "basic");
assert.deepEqual(validateCreateStep(draft, "basic"), ["实验名称", "负责人", "核心指标", "护栏指标", "实验假设"]);

const completedBasic = {
  ...draft,
  savedStep: "sample",
  basic: { ...draft.basic, name: "新增首页引导", domain: "会员", owner: "赵晨", coreMetric: "转化率", guardrailMetric: "投诉率", hypothesis: "新引导可提升转化" },
};
assert.deepEqual(validateCreateStep(completedBasic, "basic"), []);
assert.deepEqual(validateCreateStep({ ...completedBasic, sample: { ...completedBasic.sample, dailyTraffic: 0 } }, "sample"), ["dailyTraffic"]);
assert.deepEqual(validateSplitGroups([{ id: "a", label: "A", ratio: 50 }, { id: "b", label: "B", ratio: 40 }]), ["分流比例之和应为 100%"]);
assert.deepEqual(validateSplitGroups([{ id: "a", label: "A", ratio: 100 }]), ["至少保留两个实验组"]);
assert.deepEqual(validateSplitGroups([{ id: "a", label: "A", ratio: 70 }, { id: "b", label: "B", ratio: 20 }, { id: "c", label: "C", ratio: 10 }]), []);
const splitPlan = calculateSplitSamplePlan(100, [{ id: "a", label: "A", ratio: 70 }, { id: "b", label: "B", ratio: 20 }, { id: "c", label: "C", ratio: 10 }]);
assert.equal(splitPlan.total, 1000);
assert.equal(splitPlan.groups.reduce((total, group) => total + group.samples, 0), 1000);
assert.equal(splitPlan.groups.find((group) => group.label === "C")?.samples, 100);
const createAssessment = calculateCreateSampleAssessment({ ...draft.sample, splitGroups: [{ id: "a", label: "A", ratio: 70 }, { id: "b", label: "B", ratio: 30 }] });
assert.equal(createAssessment.splitMessage, "合计 100%");
assert.equal(createAssessment.periodStatus, "passed");
assert.equal(createAssessment.dimensions.every((item) => item.status === "passed"), true);
assert.equal(calculateCreateSampleAssessment({ ...draft.sample, splitGroups: [{ id: "a", label: "A", ratio: 50 }, { id: "b", label: "B", ratio: 40 }] }).splitMessage, "还差 10%");
assert.equal(calculateCreateSampleAssessment({ ...draft.sample, maxDays: 2.1 }).periodStatus, "warning");
assert.equal(calculateCreateSampleAssessment({ ...draft.sample, maxDays: 1 }).periodStatus, "critical");
assert.equal(calculateCreateSampleAssessment({ ...draft.sample, stableDays: 1 }).dimensions.find((item) => item.label === "基线稳定")?.status, "critical");
const shortSuffixes = Array.from({ length: 12 }, (_, index) => createShortSeedSuffix("generation-key", index));
assert.equal(shortSuffixes.every((suffix) => /^\d{4,8}$/.test(suffix)), true);
assert.equal(new Set(shortSuffixes).size, shortSuffixes.length);
assert.deepEqual(validateCreateStep({ ...completedBasic, seed: { ...completedBasic.seed, candidateCount: 13 } }, "seed"), ["候选种子数量"]);

assert.deepEqual(rankCandidateResults([
  { seed: "warning-low", quality: "warning", score: 83 },
  { seed: "passed-low", quality: "passed", score: 88 },
  { seed: "critical-high", quality: "critical", score: 99 },
  { seed: "passed-high", quality: "passed", score: 92 },
]).map((candidate) => candidate.seed), ["passed-high", "passed-low", "warning-low", "critical-high"]);

assert.equal(saveCreateDraft(completedBasic, storage), true);
assert.equal(storage.getItem(CREATE_DRAFT_STORAGE_KEY) !== null, true);
assert.equal(loadCreateDraft(storage)?.savedStep, "sample");
assert.equal(loadCreateDraft(storage)?.recordId, "");
clearCreateDraft(storage);
assert.equal(loadCreateDraft(storage), null);

const legacyDraft = JSON.parse(JSON.stringify(completedBasic));
delete legacyDraft.basic.domain;
legacyDraft.seed.domain = "推荐";
delete legacyDraft.seed.generated;
delete legacyDraft.sample.splitGroups;
storage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(legacyDraft));
const migratedDraft = loadCreateDraft(storage);
assert.equal(migratedDraft?.basic.domain, "推荐");
assert.equal(migratedDraft?.recordId, "");
assert.deepEqual(migratedDraft?.sample.splitGroups.map((group) => group.ratio), [50, 50]);
assert.equal(migratedDraft?.seed.generated.domain, "推荐");

const migratedRecord = normalizeCreatedRecords([{
  id: "LOCAL-OLD-001",
  sourcePlatform: "直接新增",
  status: "paused",
  name: "旧版本地实验",
  businessLine: "增长",
  owner: "赵晨",
  coreMetric: "转化率",
  guardrailMetric: "投诉率",
  metricConfig: { baseline: 8.2, mde: 0.35, confidence: 95, power: 80, dailyTraffic: 180000 },
  sampleDefinition: { domain: "增长", unit: "用户" },
  checkSnapshot: { target: "增长_用户_1234" },
  reviewSummary: { conclusion: "已完成本地新增向导与上线前检查。" },
}])[0];
assert.equal(migratedRecord.status, "pending");
assert.equal(migratedRecord.createDraft.recordId, "LOCAL-OLD-001");
assert.equal(migratedRecord.createDraft.seed.selectedSeed, "增长_用户_1234");

const copiedDraft = createDraftFromExperimentRecord({
  id: "EXP-COPY-001",
  name: "原实验",
  businessLine: "会员",
  owner: "陈露",
  coreMetric: "开通率",
  guardrailMetric: "退订率",
  metricConfig: { baseline: 6.4, mde: 0.28, confidence: 95, power: 80, dailyTraffic: 96000 },
  sampleDefinition: { domain: "会员", unit: "用户" },
  checkSnapshot: { target: "member_seed:01" },
});
assert.equal(copiedDraft.recordId, "EXP-COPY-001");
assert.equal(copiedDraft.basic.name, "原实验");
assert.equal(copiedDraft.seed.selectedSeed, "member_seed:01");

assert.equal(saveCreatedRecords([{ id: "LOCAL-001" }], storage), true);
assert.deepEqual(loadCreatedRecords(storage), [{ id: "LOCAL-001" }]);
values.set(CREATED_RECORDS_STORAGE_KEY, "invalid");
assert.deepEqual(loadCreatedRecords(storage), []);

console.log("Create experiment workflow verification passed.");
