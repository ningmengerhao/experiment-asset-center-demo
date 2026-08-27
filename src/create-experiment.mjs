export const CREATE_STEPS = ["basic", "sample", "seed", "validation"];
export const CREATE_DRAFT_STORAGE_KEY = "experiment-asset-create-draft-v1";
export const CREATED_RECORDS_STORAGE_KEY = "experiment-asset-created-records-v1";

export function normalizeCreateStep(value) {
  return CREATE_STEPS.includes(value) ? value : "basic";
}

export function createDefaultDraft() {
  return {
    savedStep: "basic",
    basic: {
      name: "",
      businessLine: "增长",
      owner: "",
      coreMetric: "",
      guardrailMetric: "",
      hypothesis: "",
    },
    sample: {
      baseline: 8.2,
      mde: 0.35,
      confidence: 95,
      power: 80,
      groups: 2,
      dailyTraffic: 180000,
      identityCoverage: 88,
      maxDays: 21,
      stableDays: 21,
      guardrailCount: 2,
      businessValue: 3.5,
    },
    seed: {
      sampleUnit: "用户",
      domain: "增长",
      candidateCount: 6,
      template: "",
      selectedSeed: "",
    },
    validation: {
      scope: "全部运行实验",
      manualExperimentIds: [],
    },
  };
}

export function createHash(step) {
  return `#create?step=${normalizeCreateStep(step)}`;
}

export function readCreateStep(hash) {
  if (typeof hash !== "string" || !hash.startsWith("#create")) return "basic";
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return normalizeCreateStep(new URLSearchParams(query).get("step"));
}

export function validateCreateStep(draft, step) {
  if (step === "basic") {
    return [
      ["name", "实验名称"],
      ["businessLine", "业务线"],
      ["owner", "负责人"],
      ["coreMetric", "核心指标"],
      ["guardrailMetric", "护栏指标"],
      ["hypothesis", "实验假设"],
    ].filter(([key]) => !String(draft.basic[key] ?? "").trim()).map(([, label]) => label);
  }

  if (step === "sample") {
    return Object.entries(draft.sample)
      .filter(([, value]) => !Number.isFinite(Number(value)) || Number(value) <= 0)
      .map(([key]) => key);
  }

  if (step === "seed") {
    const count = Number(draft.seed.candidateCount);
    if (!Number.isInteger(count) || count < 1 || count > 12) return ["候选种子数量"];
  }

  return [];
}

export function loadCreateDraft(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(CREATE_DRAFT_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || !parsed.basic || !parsed.sample || !parsed.seed || !parsed.validation) return null;
    return { ...createDefaultDraft(), ...parsed, savedStep: normalizeCreateStep(parsed.savedStep), basic: { ...createDefaultDraft().basic, ...parsed.basic }, sample: { ...createDefaultDraft().sample, ...parsed.sample }, seed: { ...createDefaultDraft().seed, ...parsed.seed }, validation: { ...createDefaultDraft().validation, ...parsed.validation } };
  } catch {
    return null;
  }
}

export function saveCreateDraft(draft, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearCreateDraft(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(CREATE_DRAFT_STORAGE_KEY);
  } catch {
    // Local storage can be unavailable in private browsing contexts.
  }
}

export function loadCreatedRecords(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(CREATED_RECORDS_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCreatedRecords(records, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CREATED_RECORDS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
