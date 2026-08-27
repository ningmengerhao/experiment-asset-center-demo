import assert from "node:assert/strict";
import {
  CREATED_RECORDS_STORAGE_KEY,
  CREATE_DRAFT_STORAGE_KEY,
  clearCreateDraft,
  createDefaultDraft,
  createHash,
  loadCreateDraft,
  loadCreatedRecords,
  normalizeCreateStep,
  readCreateStep,
  saveCreateDraft,
  saveCreatedRecords,
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
  basic: { ...draft.basic, name: "新增首页引导", owner: "赵晨", coreMetric: "转化率", guardrailMetric: "投诉率", hypothesis: "新引导可提升转化" },
};
assert.deepEqual(validateCreateStep(completedBasic, "basic"), []);
assert.deepEqual(validateCreateStep({ ...completedBasic, sample: { ...completedBasic.sample, dailyTraffic: 0 } }, "sample"), ["dailyTraffic"]);
assert.deepEqual(validateCreateStep({ ...completedBasic, seed: { ...completedBasic.seed, candidateCount: 13 } }, "seed"), ["候选种子数量"]);

assert.equal(saveCreateDraft(completedBasic, storage), true);
assert.equal(storage.getItem(CREATE_DRAFT_STORAGE_KEY) !== null, true);
assert.equal(loadCreateDraft(storage)?.savedStep, "sample");
clearCreateDraft(storage);
assert.equal(loadCreateDraft(storage), null);

assert.equal(saveCreatedRecords([{ id: "LOCAL-001" }], storage), true);
assert.deepEqual(loadCreatedRecords(storage), [{ id: "LOCAL-001" }]);
values.set(CREATED_RECORDS_STORAGE_KEY, "invalid");
assert.deepEqual(loadCreatedRecords(storage), []);

console.log("Create experiment workflow verification passed.");
