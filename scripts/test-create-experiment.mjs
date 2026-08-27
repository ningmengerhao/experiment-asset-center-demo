import assert from "node:assert/strict";
import {
  calculateSplitSamplePlan,
  CREATED_RECORDS_STORAGE_KEY,
  CREATE_DRAFT_STORAGE_KEY,
  clearCreateDraft,
  createDefaultDraft,
  createHash,
  loadCreateDraft,
  loadCreatedRecords,
  normalizeCreateStep,
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
assert.deepEqual(migratedDraft?.sample.splitGroups.map((group) => group.ratio), [50, 50]);
assert.equal(migratedDraft?.seed.generated.domain, "推荐");

assert.equal(saveCreatedRecords([{ id: "LOCAL-001" }], storage), true);
assert.deepEqual(loadCreatedRecords(storage), [{ id: "LOCAL-001" }]);
values.set(CREATED_RECORDS_STORAGE_KEY, "invalid");
assert.deepEqual(loadCreatedRecords(storage), []);

console.log("Create experiment workflow verification passed.");
