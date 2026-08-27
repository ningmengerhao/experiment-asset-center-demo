export const CREATE_STEPS = ["basic", "sample", "seed", "validation"];
export const CREATE_DRAFT_STORAGE_KEY = "experiment-asset-create-draft-v1";
export const CREATED_RECORDS_STORAGE_KEY = "experiment-asset-created-records-v1";
export const DEFAULT_SPLIT_GROUPS = [
  { id: "group-a", label: "A", ratio: 50 },
  { id: "group-b", label: "B", ratio: 50 },
];

export function normalizeSplitGroups(value) {
  const groups = Array.isArray(value) ? value.slice(0, 8) : [];
  if (groups.length < 2) return DEFAULT_SPLIT_GROUPS.map((group) => ({ ...group }));
  return groups.map((group, index) => ({
    id: String(group?.id || `group-${index + 1}`),
    label: String(group?.label || String.fromCharCode(65 + index)).slice(0, 12),
    ratio: Number(group?.ratio),
  }));
}

export function validateSplitGroups(value) {
  if (!Array.isArray(value) || value.length < 2) return ["至少保留两个实验组"];
  const groups = normalizeSplitGroups(value);
  if (groups.some((group) => !group.label.trim())) return ["实验组名称"];
  if (groups.some((group) => !Number.isInteger(group.ratio) || group.ratio <= 0)) return ["分流比例应为正整数"];
  if (groups.reduce((total, group) => total + group.ratio, 0) !== 100) return ["分流比例之和应为 100%"];
  return [];
}

export function calculateSplitSamplePlan(perGroup, value) {
  const groups = normalizeSplitGroups(value);
  const minimumRatio = Math.min(...groups.map((group) => Math.max(0, group.ratio))) / 100;
  const total = minimumRatio > 0 ? Math.ceil(Number(perGroup) / minimumRatio) : 0;
  const raw = groups.map((group) => ({ ...group, raw: total * group.ratio / 100 }));
  const allocated = raw.map((group) => ({ ...group, samples: Math.floor(group.raw) }));
  let remainder = Math.max(0, total - allocated.reduce((sum, group) => sum + group.samples, 0));
  raw
    .map((group, index) => ({ index, fraction: group.raw - Math.floor(group.raw) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
    .forEach(({ index }) => {
      if (remainder > 0) {
        allocated[index].samples += 1;
        remainder -= 1;
      }
    });
  return { total, minimumRatio, groups: allocated.map(({ raw: _raw, ...group }) => group) };
}

export function rankCandidateResults(candidates) {
  const rank = { passed: 0, warning: 1, critical: 2 };
  return [...candidates].sort((left, right) => (rank[left.quality] ?? 3) - (rank[right.quality] ?? 3) || right.score - left.score || left.seed.localeCompare(right.seed));
}

export function createShortSeedSuffix(generationKey, index) {
  let hash = 2166136261;
  const source = `${generationKey}:${index}`;
  for (let offset = 0; offset < source.length; offset += 1) {
    hash ^= source.charCodeAt(offset);
    hash = Math.imul(hash, 16777619);
  }
  const length = 4 + (hash >>> 0) % 5;
  const modulus = 10 ** length;
  return String((hash >>> 0) % modulus).padStart(length, "0");
}

export function normalizeCreateStep(value) {
  return CREATE_STEPS.includes(value) ? value : "basic";
}

export function createDefaultDraft() {
  return {
    savedStep: "basic",
    basic: {
      name: "",
      businessLine: "增长",
      domain: "增长",
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
      splitGroups: DEFAULT_SPLIT_GROUPS.map((group) => ({ ...group })),
      dailyTraffic: 180000,
      identityCoverage: 88,
      maxDays: 21,
      stableDays: 21,
      guardrailCount: 2,
      businessValue: 3.5,
    },
    seed: {
      sampleUnit: "用户",
      candidateCount: 6,
      template: "",
      selectedSeed: "",
      generated: {
        key: "initial",
        domain: "增长",
        sampleUnit: "用户",
        candidateCount: 6,
        template: "",
        attempts: 0,
        splitGroups: DEFAULT_SPLIT_GROUPS.map((group) => ({ ...group })),
      },
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
      ["domain", "实验域"],
      ["owner", "负责人"],
      ["coreMetric", "核心指标"],
      ["guardrailMetric", "护栏指标"],
      ["hypothesis", "实验假设"],
    ].filter(([key]) => !String(draft.basic[key] ?? "").trim()).map(([, label]) => label);
  }

  if (step === "sample") {
    const numericFields = ["baseline", "mde", "confidence", "power", "dailyTraffic", "identityCoverage", "maxDays", "stableDays", "guardrailCount", "businessValue"];
    const invalidField = numericFields.find((key) => !Number.isFinite(Number(draft.sample[key])) || Number(draft.sample[key]) <= 0);
    return invalidField ? [invalidField] : validateSplitGroups(draft.sample.splitGroups);
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
    const defaults = createDefaultDraft();
    const basic = { ...defaults.basic, ...parsed.basic, domain: parsed.basic.domain || parsed.seed.domain || parsed.basic.businessLine || defaults.basic.domain };
    const splitGroups = normalizeSplitGroups(parsed.sample.splitGroups);
    const generated = parsed.seed.generated && typeof parsed.seed.generated === "object"
      ? { ...defaults.seed.generated, ...parsed.seed.generated, splitGroups: normalizeSplitGroups(parsed.seed.generated.splitGroups) }
      : { ...defaults.seed.generated, domain: basic.domain, sampleUnit: parsed.seed.sampleUnit || defaults.seed.sampleUnit, candidateCount: parsed.seed.candidateCount || defaults.seed.candidateCount, template: parsed.seed.template || "", splitGroups };
    return { ...defaults, ...parsed, savedStep: normalizeCreateStep(parsed.savedStep), basic, sample: { ...defaults.sample, ...parsed.sample, splitGroups }, seed: { ...defaults.seed, ...parsed.seed, generated }, validation: { ...defaults.validation, ...parsed.validation } };
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
