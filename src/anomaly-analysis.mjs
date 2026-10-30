export const ANALYSIS_RANGES = Object.freeze(["7d", "14d", "30d"]);

export const EFFECT_INVERSION_EVENTS = Object.freeze([
  {
    id: "EIE-240611-017-14D",
    experimentId: "EXP-240611-017",
    range: "14d",
    metric: "会员开通率",
    expectedDirection: "up",
    actualEffect: -0.62,
    pValue: 0.018,
    consecutiveWindows: 2,
    affectedTraffic: 0.2,
    startedAt: "2026-06-20 00:00",
    detectedAt: "2026-06-24 18:12",
    trend: [0.14, 0.08, -0.31, -0.62],
  },
  {
    id: "EIE-240611-017-7D",
    experimentId: "EXP-240611-017",
    range: "7d",
    metric: "会员开通率",
    expectedDirection: "up",
    actualEffect: -0.51,
    pValue: 0.031,
    consecutiveWindows: 2,
    affectedTraffic: 0.2,
    startedAt: "2026-06-21 00:00",
    detectedAt: "2026-06-24 18:12",
    trend: [0.08, -0.26, -0.51],
  },
  {
    id: "EIE-240611-017-30D",
    experimentId: "EXP-240611-017",
    range: "30d",
    metric: "会员开通率",
    expectedDirection: "up",
    actualEffect: -0.48,
    pValue: 0.024,
    consecutiveWindows: 2,
    affectedTraffic: 0.2,
    startedAt: "2026-06-20 00:00",
    detectedAt: "2026-06-24 18:12",
    trend: [0.2, 0.12, -0.18, -0.48],
  },
  {
    id: "EIE-260901-101-14D",
    experimentId: "EXP-260901-101",
    range: "14d",
    metric: "首购转化率",
    expectedDirection: "up",
    actualEffect: -0.74,
    pValue: 0.009,
    consecutiveWindows: 3,
    affectedTraffic: 0.45,
    startedAt: "2026-10-24 00:00",
    detectedAt: "2026-10-28 17:10",
    trend: [0.12, -0.22, -0.48, -0.74],
  },
  {
    id: "EIE-260902-102-14D",
    experimentId: "EXP-260902-102",
    range: "14d",
    metric: "支付成功率",
    expectedDirection: "up",
    actualEffect: -0.51,
    pValue: 0.032,
    consecutiveWindows: 2,
    affectedTraffic: 0.3,
    startedAt: "2026-10-25 00:00",
    detectedAt: "2026-10-28 16:40",
    trend: [0.08, -0.17, -0.51],
  },
  {
    id: "EIE-240615-022-14D",
    experimentId: "EXP-240615-022",
    range: "14d",
    metric: "支付成功率",
    expectedDirection: "up",
    actualEffect: -0.56,
    pValue: 0.021,
    consecutiveWindows: 2,
    affectedTraffic: 0.35,
    startedAt: "2026-06-19 00:00",
    detectedAt: "2026-06-22 17:25",
    trend: [0.11, -0.24, -0.56],
  },
]);

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const scorePart = (value, weight) => Math.round(clamp(value) * weight * 10) / 10;

export function findEffectInversionEvent(experimentId, range) {
  return EFFECT_INVERSION_EVENTS.find((event) => event.experimentId === experimentId && event.range === range) ?? null;
}

export function detectEffectInversion(event, mde, expectedDirection = "up") {
  if (!event) return { detected: false, severity: "info", reason: "当前范围未定位异常" };
  const direction = (event.expectedDirection ?? expectedDirection) === "down" ? -1 : 1;
  const opposite = event.actualEffect * direction < 0;
  const magnitude = Math.abs(event.actualEffect);
  const threshold = Math.abs(Number(mde) || 0);
  const detected = opposite && event.consecutiveWindows >= 2 && magnitude >= threshold && event.pValue < 0.05;
  const impact = magnitude * (Number(event.affectedTraffic) || 0);
  const severity = !detected ? "info" : impact >= 0.12 || magnitude >= threshold * 2 ? "critical" : "warning";
  return {
    detected,
    severity,
    direction: direction === 1 ? "up" : "down",
    magnitude,
    threshold,
    reason: detected ? "连续两个观测窗口的实际效果与预期方向相反，且反向幅度达到 MDE，p < 0.05。" : "当前范围未定位异常",
  };
}

export function buildLayerDrilldowns() {
  return [
    { dimension: "用户类型", value: "新会员候选", loss: 0.31, contribution: 42, detail: "近两窗口负向变化集中" },
    { dimension: "流量入口", value: "首购引导页", loss: 0.22, contribution: 28, detail: "放量后贡献明显增加" },
    { dimension: "设备", value: "Android", loss: 0.16, contribution: 17, detail: "与整体方向一致" },
    { dimension: "地域", value: "华东", loss: 0.09, contribution: 8, detail: "需要继续观察" },
    { dimension: "实验组", value: "实验组 B", loss: 0.05, contribution: 5, detail: "低贡献切片" },
  ];
}

function fixtureForCandidate(experimentId, index) {
  if (experimentId === "EXP-240610-001") return { sampleOverlap: 0.86, rolloutAlignment: 0.92, layerOverlap: 0.72, metricSync: 0.78 };
  if (experimentId === "EXP-240615-022") return { sampleOverlap: 0.63, rolloutAlignment: 0.58, layerOverlap: 0.5, metricSync: 0.66 };
  return { sampleOverlap: [0.46, 0.36, 0.28][index] ?? 0.25, rolloutAlignment: [0.47, 0.35, 0.31][index] ?? 0.2, layerOverlap: [0.25, 0.34, 0.2][index] ?? 0.2, metricSync: [0.35, 0.28, 0.22][index] ?? 0.2 };
}

export function scanRunningExperiments(target, experiments, relationships = []) {
  return experiments
    .filter((candidate) => candidate.id !== target.id && candidate.status === "running")
    .map((candidate, index) => {
      const signals = fixtureForCandidate(candidate.id, index);
      const registeredRelation = relationships.some((relation) =>
        [relation.sourceExperimentId, relation.targetExperimentId].includes(target.id)
        && [relation.sourceExperimentId, relation.targetExperimentId].includes(candidate.id)) ? 1 : 0;
      const score = scorePart(signals.sampleOverlap, 35)
        + scorePart(signals.rolloutAlignment, 25)
        + scorePart(signals.layerOverlap, 20)
        + scorePart(signals.metricSync, 15)
        + scorePart(registeredRelation, 5);
      const highConfidence = score >= 80
        && signals.sampleOverlap >= 0.7
        && signals.rolloutAlignment >= 0.7
        && (signals.layerOverlap >= 0.6 || signals.metricSync >= 0.7);
      return {
        experimentId: candidate.id,
        owner: candidate.owner,
        score: Math.round(score * 10) / 10,
        status: highConfidence ? "high_confidence" : "pending_verification",
        ...signals,
        registeredRelation,
      };
    })
    .sort((left, right) => right.score - left.score || left.experimentId.localeCompare(right.experimentId));
}

export function projectCandidateVerification(verification, experiment, canView) {
  const genericConclusion = "交叉验证检测到样本、放量或分流信号重叠，建议持续核验。";
  if (canView) {
    return {
      ...verification,
      disclosure: "full",
      displayName: experiment.name,
      owner: experiment.owner,
      strategy: `${experiment.trafficLayer} · ${experiment.userGroup}`,
      metric: experiment.coreMetric,
      rollout: experiment.rollout,
      conclusion: genericConclusion,
    };
  }
  return {
    ...verification,
    disclosure: "identified",
    displayName: verification.experimentId,
    owner: verification.owner,
    riskCategory: "交叉流量风险",
    conclusion: verification.status === "high_confidence"
      ? "自动定位，建议关注：多项交叉信号达到高置信阈值。"
      : genericConclusion,
  };
}

export function isCollaborationNoticeEligible(verification) {
  return Number(verification?.score) >= 60;
}

export function createCollaborationNotice({ caseId, verification, targetExperimentId, createdAt }) {
  return {
    id: `notice-${caseId}-${verification.experimentId}`,
    caseId,
    candidateExperimentId: verification.experimentId,
    targetExperimentId,
    recipient: verification.owner,
    createdAt,
    read: false,
    text: verification.status === "high_confidence"
      ? "您负责的实验可能影响另一实验，已自动定位，建议关注。"
      : "您负责的实验与另一实验存在待核验交叉信号，请关注。",
  };
}

export function buildMissingCollaborationNotices(cases, existingNotices = []) {
  const knownNoticeKeys = new Set(existingNotices.map((notice) => `${notice.caseId}:${notice.candidateExperimentId}`));
  return (cases ?? []).flatMap((caseRecord) => (caseRecord.verifications ?? [])
    .filter(isCollaborationNoticeEligible)
    .map((verification) => createCollaborationNotice({
      caseId: caseRecord.id,
      verification,
      targetExperimentId: caseRecord.experimentId,
      createdAt: caseRecord.updatedAt,
    }))
    .filter((notice) => !knownNoticeKeys.has(`${notice.caseId}:${notice.candidateExperimentId}`)));
}
