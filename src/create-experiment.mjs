export const CREATE_STEPS = ["basic", "sample", "seed", "validation"];
export const CREATE_DRAFT_STORAGE_KEY = "experiment-asset-create-draft-v1";
export const CREATED_RECORDS_STORAGE_KEY = "experiment-asset-created-records-v1";
export const CUSTOM_SEED_PATTERN = /^[A-Za-z0-9_.:-]{4,64}$/;
export const EXPERIMENT_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze({ action: "上线", next: "running" }),
  running: Object.freeze({ action: "下线", next: "paused" }),
  paused: Object.freeze({ action: "终止", next: "ended" }),
});
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

export function calculateCreateSampleAssessment(sample) {
  const baseline = Number(sample?.baseline);
  const mde = Number(sample?.mde);
  const confidence = Number(sample?.confidence);
  const power = Number(sample?.power);
  const dailyTraffic = Number(sample?.dailyTraffic);
  const maxDays = Number(sample?.maxDays);
  const stableDays = Number(sample?.stableDays);
  const identityCoverage = Number(sample?.identityCoverage);
  const guardrailCount = Number(sample?.guardrailCount);
  const businessValue = Number(sample?.businessValue);
  const splitGroups = normalizeSplitGroups(sample?.splitGroups);
  const splitTotal = splitGroups.reduce((total, group) => total + group.ratio, 0);
  const splitErrors = validateSplitGroups(splitGroups);
  const zAlpha = confidence === 99 ? 2.576 : confidence === 90 ? 1.645 : 1.96;
  const zBeta = power === 95 ? 1.64 : power === 90 ? 1.28 : 0.84;
  const perGroup = Math.ceil((2 * (zAlpha + zBeta) ** 2 * (baseline / 100) * (1 - baseline / 100)) / Math.max(0.0000001, (mde / 100) ** 2));
  const splitPlan = calculateSplitSamplePlan(perGroup, splitGroups);
  const days = Math.max(1, Math.ceil(splitPlan.total / Math.max(1, dailyTraffic)));
  const periodStatus = days > maxDays ? "critical" : days > maxDays * 0.9 ? "warning" : "passed";
  const splitMessage = splitTotal === 100 ? "合计 100%" : splitTotal < 100 ? `还差 ${100 - splitTotal}%` : `超出 ${splitTotal - 100}%`;
  const recommendation = periodStatus === "passed"
    ? { label: "可行性结论：周期在可接受范围内", advice: `预计 ${days} 天，不超过最长可接受周期 ${maxDays} 天。` }
    : periodStatus === "warning"
      ? { label: "可行性结论：接近最长可接受周期", advice: `预计 ${days} 天，已超过最长周期的 90%，建议预留流量和稳定性缓冲。` }
      : { label: "可行性结论：预计周期超过上限", advice: `预计 ${days} 天，超过最长可接受周期 ${maxDays} 天，建议扩大客群、调整 MDE 或延长周期。` };
  const dimensions = [
    { label: "流量覆盖", status: identityCoverage >= 85 ? "passed" : identityCoverage >= 70 ? "warning" : "critical", detail: `身份覆盖 ${identityCoverage}%` },
    { label: "基线稳定", status: stableDays >= days ? "passed" : stableDays >= days * 0.9 ? "warning" : "critical", detail: `历史稳定 ${stableDays} 天 / 预计周期 ${days} 天` },
    { label: "实验污染", status: splitGroups.length <= 3 ? "passed" : "warning", detail: `${splitGroups.length} 组分流` },
    { label: "护栏完整", status: guardrailCount >= 2 ? "passed" : "critical", detail: `已配置 ${guardrailCount} 个护栏` },
    { label: "业务价值", status: businessValue >= mde ? "passed" : "warning", detail: `预期提升 ${businessValue}% / MDE ${mde}pp` },
  ];
  return { perGroup, total: splitPlan.total, days, periodStatus, splitTotal, splitErrors, splitMessage, splitPlan, recommendation, dimensions };
}

export function isSeedGenerationCurrent(draft) {
  const generated = draft?.seed?.generated;
  if (!generated) return false;
  const currentRatio = (draft.sample?.splitGroups ?? []).map((group) => `${group.label}:${group.ratio}%`).join(" ");
  const generatedRatio = (generated.splitGroups ?? []).map((group) => `${group.label}:${group.ratio}%`).join(" ");
  return generated.domain === draft.basic?.domain && generated.sampleUnit === draft.seed?.sampleUnit && generated.candidateCount === draft.seed?.candidateCount && generated.template === draft.seed?.template && generatedRatio === currentRatio;
}

export function isValidCustomSeed(value) {
  return typeof value === "string" && CUSTOM_SEED_PATTERN.test(value.trim());
}

export function getExperimentStatusAction(status) {
  return EXPERIMENT_STATUS_TRANSITIONS[status] ?? null;
}

export function canDeleteExperiment(status) {
  return status === "draft" || status === "pending";
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
    recordId: "",
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
      customSeed: "",
      customCandidate: "",
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
    return { ...defaults, ...parsed, recordId: typeof parsed.recordId === "string" ? parsed.recordId : "", savedStep: normalizeCreateStep(parsed.savedStep), basic, sample: { ...defaults.sample, ...parsed.sample, splitGroups }, seed: { ...defaults.seed, ...parsed.seed, customSeed: typeof parsed.seed.customSeed === "string" ? parsed.seed.customSeed : "", customCandidate: typeof parsed.seed.customCandidate === "string" ? parsed.seed.customCandidate : "", generated }, validation: { ...defaults.validation, ...parsed.validation } };
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
    return Array.isArray(parsed) ? normalizeCreatedRecords(parsed) : [];
  } catch {
    return [];
  }
}

export function createDraftFromExperimentRecord(record) {
  const defaults = createDefaultDraft();
  const selectedSeed = record?.checkSnapshot?.target && record.checkSnapshot.target !== "待生成" ? record.checkSnapshot.target : "";
  return {
    ...defaults,
    ...(record?.createDraft ?? {}),
    recordId: record?.id ?? "",
    savedStep: record?.createDraft?.savedStep ?? "validation",
    basic: { ...defaults.basic, ...record?.createDraft?.basic, name: record?.name ?? "", businessLine: record?.businessLine ?? defaults.basic.businessLine, domain: record?.sampleDefinition?.domain ?? record?.businessLine ?? defaults.basic.domain, owner: record?.owner ?? "", coreMetric: record?.coreMetric ?? "", guardrailMetric: record?.guardrailMetric ?? "" },
    sample: { ...defaults.sample, ...record?.createDraft?.sample, baseline: record?.metricConfig?.baseline ?? defaults.sample.baseline, mde: record?.metricConfig?.mde ?? defaults.sample.mde, confidence: record?.metricConfig?.confidence ?? defaults.sample.confidence, power: record?.metricConfig?.power ?? defaults.sample.power, dailyTraffic: record?.metricConfig?.dailyTraffic ?? defaults.sample.dailyTraffic },
    seed: { ...defaults.seed, ...record?.createDraft?.seed, sampleUnit: record?.sampleDefinition?.unit ?? defaults.seed.sampleUnit, selectedSeed, generated: { ...defaults.seed.generated, ...record?.createDraft?.seed?.generated } },
    validation: { ...defaults.validation, ...record?.createDraft?.validation },
  };
}

export function normalizeCreatedRecords(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => {
    if (!record || typeof record !== "object") return record;
    const isLegacyCompletedLocal = record.sourcePlatform === "直接新增" && record.status === "paused" && record.reviewSummary?.conclusion === "已完成本地新增向导与上线前检查。";
    if (!isLegacyCompletedLocal) return record;
    const draft = createDraftFromExperimentRecord(record);
    return { ...record, status: "pending", createDraft: draft };
  });
}

export function saveCreatedRecords(records, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CREATED_RECORDS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
