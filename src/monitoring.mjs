const attributionWeights = Object.freeze({
  sampleOverlap: 35,
  rolloutAlignment: 25,
  layerOverlap: 20,
  metricSync: 15,
  registeredRelation: 5,
});

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateAlertRule(rule, limits) {
  const errors = [];
  const thresholdLimits = limits?.threshold ?? { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY };
  const periodLimits = limits?.consecutiveWindows ?? { min: 1, max: 12 };

  if (!rule?.name?.trim()) errors.push("规则名称不能为空");
  if (!isFiniteNumber(rule?.threshold) || rule.threshold < thresholdLimits.min || rule.threshold > thresholdLimits.max) {
    errors.push(`阈值必须在 ${thresholdLimits.min}-${thresholdLimits.max} 之间`);
  }
  if (!Number.isInteger(rule?.consecutiveWindows) || rule.consecutiveWindows < periodLimits.min || rule.consecutiveWindows > periodLimits.max) {
    errors.push(`连续周期必须在 ${periodLimits.min}-${periodLimits.max} 之间`);
  }

  return { valid: errors.length === 0, errors };
}

export function canManageRule(actor, rule) {
  if (!actor || !rule) return false;
  if (actor.role === "admin") return true;
  return actor.role === "experimentOwner" && actor.name === rule.owner;
}

export function transitionAlertRule(rule, action, actor, note = "") {
  if (!canManageRule(actor, rule)) throw new Error("permission denied");

  const nextStatus = action === "enable" ? "enabled" : action === "disable" ? "disabled" : null;
  if (!nextStatus) throw new Error(`unsupported action: ${action}`);

  const occurredAt = new Date().toISOString().slice(0, 16).replace("T", " ");
  return {
    ...rule,
    status: nextStatus,
    version: rule.version + 1,
    updatedAt: occurredAt,
    audit: [
      ...(Array.isArray(rule.audit) ? rule.audit : []),
      {
        id: `audit-${rule.id}-${rule.version + 1}`,
        actor: actor.name,
        action: nextStatus === "enabled" ? "启用规则" : "停用规则",
        note,
        occurredAt,
      },
    ],
  };
}

function normalizeScore(value) {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildEvidence(candidate) {
  return [
    { key: "sampleOverlap", label: "样本重叠", value: normalizeScore(candidate.sampleOverlap), weight: attributionWeights.sampleOverlap },
    { key: "rolloutAlignment", label: "放量时间吻合", value: normalizeScore(candidate.rolloutAlignment), weight: attributionWeights.rolloutAlignment },
    { key: "layerOverlap", label: "分流层/规则交叉", value: normalizeScore(candidate.layerOverlap), weight: attributionWeights.layerOverlap },
    { key: "metricSync", label: "指标同步变化", value: normalizeScore(candidate.metricSync), weight: attributionWeights.metricSync },
    { key: "registeredRelation", label: "已登记关系", value: normalizeScore(candidate.registeredRelation), weight: attributionWeights.registeredRelation },
  ].map((item) => ({ ...item, contribution: Number((item.value * item.weight).toFixed(1)) }));
}

export function rankAttributionCandidates(target, candidates) {
  const targetId = target?.experimentId;
  return (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => candidate?.experimentId && candidate.experimentId !== targetId)
    .map((candidate) => {
      const evidence = buildEvidence(candidate);
      const score = Number(evidence.reduce((sum, item) => sum + item.contribution, 0).toFixed(1));
      const result = { ...candidate, score, evidence };
      if (candidate.visible !== false) return result;
      const { strategy: _strategy, metricDetail: _metricDetail, ...safeResult } = result;
      return safeResult;
    })
    .sort((left, right) => right.score - left.score || left.experimentId.localeCompare(right.experimentId));
}

export { attributionWeights };
