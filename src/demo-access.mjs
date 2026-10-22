export const DEMO_STATE_STORAGE_KEY = "experiment-asset-demo-access-v1";

export const TEST_ACCOUNTS = [
  { id: "admin.zhao", name: "赵晨", role: "admin", domains: ["增长", "会员", "推荐", "交易", "搜索"], ownedExperimentIds: [] },
  { id: "business.liu", name: "刘昕", role: "businessOwner", domains: ["增长"], ownedExperimentIds: [] },
  { id: "owner.zhao", name: "赵晨", role: "experimentOwner", domains: ["增长"], ownedExperimentIds: ["EXP-240610-001"] },
  { id: "owner.chen", name: "陈露", role: "experimentOwner", domains: ["会员"], ownedExperimentIds: ["EXP-240611-017"] },
  { id: "metric.editor.wu", name: "吴雅", role: "metricEditor", domains: ["交易"], ownedExperimentIds: [] },
  { id: "analyst.wu", name: "吴雅", role: "analyst", domains: ["增长"], ownedExperimentIds: [] },
  { id: "viewer.sun", name: "孙宁", role: "viewer", domains: [], ownedExperimentIds: ["EXP-240618-006"] },
];

export const INITIAL_METRICS = [
  { id: "MET-001", name: "首购转化率", domain: "增长", definition: "首购成功用户 / 进入首购流程用户", unit: "%", denominator: "进入首购流程用户", version: 3, sourceType: "table", sourceRef: "growth.order_conversion_daily", refreshFrequency: "日更", updatedAt: "2026-09-02 08:30", freshness: "新鲜", owner: "赵晨", status: "active", viewers: ["business.liu", "owner.zhao", "analyst.wu"], editors: ["metric.editor.wu"] },
  { id: "MET-002", name: "投诉率", domain: "增长", definition: "投诉用户 / 曝光用户", unit: "%", denominator: "曝光用户", version: 2, sourceType: "task", sourceRef: "TASK_GROWTH_COMPLAINT_01", refreshFrequency: "日更", updatedAt: "2026-09-02 09:10", freshness: "新鲜", owner: "吴雅", status: "active", viewers: ["business.liu", "owner.zhao", "analyst.wu"], editors: ["metric.editor.wu"] },
  { id: "MET-003", name: "会员开通率", domain: "会员", definition: "完成会员开通用户 / 会员入口曝光用户", unit: "%", denominator: "会员入口曝光用户", version: 1, sourceType: "table", sourceRef: "member.open_daily", refreshFrequency: "日更", updatedAt: "2026-09-01 07:30", freshness: "延迟", owner: "陈露", status: "active", viewers: ["owner.chen"], editors: [] },
  { id: "MET-004", name: "退订率", domain: "会员", definition: "退订用户 / 已开通会员用户", unit: "%", denominator: "已开通会员用户", version: 2, sourceType: "task", sourceRef: "TASK_MEMBER_CANCEL_02", refreshFrequency: "日更", updatedAt: "2026-09-02 06:40", freshness: "新鲜", owner: "陈露", status: "active", viewers: ["owner.chen"], editors: [] },
  { id: "MET-005", name: "支付成功率", domain: "交易", definition: "支付成功订单 / 发起支付订单", unit: "%", denominator: "发起支付订单", version: 4, sourceType: "table", sourceRef: "trade.payment_daily", refreshFrequency: "小时级", updatedAt: "2026-09-02 10:00", freshness: "新鲜", owner: "吴雅", status: "active", viewers: ["metric.editor.wu"], editors: ["metric.editor.wu"] },
];

export const INITIAL_SAMPLE_SOURCES = [
  { id: "SRC-GROWTH-TABLE", name: "增长用户行为日表", kind: "sql", domain: "增长", table: "growth.user_activity_daily", taskId: "", grain: "用户", updatedAt: "2026-09-02 08:00", frequency: "日更", viewers: ["business.liu", "owner.zhao", "analyst.wu"], editors: [] },
  { id: "SRC-GROWTH-TASK", name: "新客人群推送任务", kind: "task", domain: "增长", table: "", taskId: "TASK_GROWTH_NEW_USER_01", grain: "用户", updatedAt: "2026-09-02 07:50", frequency: "日更", viewers: ["business.liu", "owner.zhao"], editors: [] },
  { id: "SRC-MEMBER-TABLE", name: "会员行为日表", kind: "sql", domain: "会员", table: "member.member_activity_daily", taskId: "", grain: "用户", updatedAt: "2026-09-01 07:30", frequency: "日更", viewers: ["owner.chen"], editors: [] },
];

export const INITIAL_GRANTS = [
  { id: "GRANT-001", accountId: "viewer.sun", scope: "experiment", resourceId: "EXP-240618-006", permissions: ["experiment.view"], expiresAt: "2026-12-31" },
];

export const INITIAL_IMPORT_BATCHES = [
  {
    id: "IMP-20260703-01",
    file: "experiment_import_20260703.xlsx",
    submitter: "赵晨",
    submitterId: "admin.zhao",
    submittedAt: "2026-07-03 10:30",
    status: "部分导入",
    summary: "已导入 1 / 未导入 3",
    nextAction: "查看问题行并修正后重新导入",
    issues: [
      { row: 2, experimentId: "EXP-240701-009", level: "通过", issue: "字段完整，已导入" },
      { row: 3, experimentId: "EXP-240701-010", level: "需确认", issue: "负责人缺失；未导入" },
      { row: 4, experimentId: "EXP-240611-017", level: "阻断", issue: "实验 ID 已存在；未导入" },
      { row: 5, experimentId: "EXP-240701-011", level: "阻断", issue: "放量比例异常；未导入" },
    ],
  },
  {
    id: "IMP-20260702-03",
    file: "member_experiment_backfill.xlsx",
    submitter: "陈露",
    submitterId: "owner.chen",
    submittedAt: "2026-07-02 16:45",
    status: "部分导入",
    summary: "已导入 6 / 未导入 2",
    nextAction: "查看问题行并修正后重新导入",
    issues: [
      { row: 8, experimentId: "EXP-240628-021", level: "需确认", issue: "来源平台别名未命中；未导入" },
      { row: 9, experimentId: "EXP-240628-022", level: "需确认", issue: "父子关系原因为空；未导入" },
    ],
  },
];

export function createInitialDemoState() {
  return { sessionAccountId: null, metrics: INITIAL_METRICS.map((item) => ({ ...item })), sampleSources: INITIAL_SAMPLE_SOURCES.map((item) => ({ ...item })), grants: INITIAL_GRANTS.map((item) => ({ ...item })), requests: [], importBatches: INITIAL_IMPORT_BATCHES.map((item) => ({ ...item, issues: item.issues.map((issue) => ({ ...issue })) })), audit: [] };
}

export function loadDemoState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(DEMO_STATE_STORAGE_KEY);
    if (!raw) return createInitialDemoState();
    const value = JSON.parse(raw);
    const defaults = createInitialDemoState();
    const metrics = Array.isArray(value.metrics) ? value.metrics.map(({ type: _type, ...metric }) => metric) : defaults.metrics;
    const requests = Array.isArray(value.requests)
      ? value.requests.map((request) => ({ ...request, permissions: Array.isArray(request.permissions) ? request.permissions : request.permission ? [request.permission] : [] }))
      : [];
    return { ...defaults, ...value, metrics, sampleSources: Array.isArray(value.sampleSources) ? value.sampleSources : defaults.sampleSources, grants: Array.isArray(value.grants) ? value.grants : defaults.grants, requests, importBatches: Array.isArray(value.importBatches) ? value.importBatches : defaults.importBatches, audit: Array.isArray(value.audit) ? value.audit : [] };
  } catch {
    return createInitialDemoState();
  }
}

export function saveDemoState(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function getAccount(accountId) {
  return TEST_ACCOUNTS.find((account) => account.id === accountId) ?? null;
}

function grantAllows(grant, permission) {
  const permissions = Array.isArray(grant.permissions) ? grant.permissions : grant.permission ? [grant.permission] : [];
  if (permissions.includes(permission)) return true;
  if (permission === "metric.view" && permissions.includes("metric.edit")) return true;
  if (permission === "experiment.view" && permissions.includes("experiment.edit")) return true;
  return false;
}

function activeGrant(state, accountId, scope, resourceId, permission) {
  const today = new Date().toISOString().slice(0, 10);
  return (state.grants ?? []).some((grant) => grant.accountId === accountId && grant.scope === scope && grant.resourceId === resourceId && grantAllows(grant, permission) && (!grant.expiresAt || grant.expiresAt >= today));
}

export function canAccess(state, account, permission, resource = {}) {
  if (!account) return false;
  if (account.role === "admin") return true;
  const domain = resource.domain ?? resource.businessLine;
  const id = resource.id;
  if (permission.startsWith("metric.")) {
    if (permission === "metric.edit") return resource.editors?.includes(account.id) || activeGrant(state, account.id, "metric", id, permission);
    return resource.viewers?.includes(account.id) || resource.editors?.includes(account.id) || activeGrant(state, account.id, "metric", id, permission) || activeGrant(state, account.id, "domain", domain, permission);
  }
  if (permission === "sample.use") return resource.viewers?.includes(account.id) || activeGrant(state, account.id, "sampleSource", id, permission) || activeGrant(state, account.id, "domain", domain, permission);
  if (permission.startsWith("experiment.")) {
    const owner = resource.owner;
    const owns = owner === account.name || account.ownedExperimentIds.includes(id);
    const visible = owns || account.domains.includes(domain) || activeGrant(state, account.id, "experiment", id, permission) || activeGrant(state, account.id, "domain", domain, permission);
    if (permission === "experiment.edit") return owns || activeGrant(state, account.id, "experiment", id, permission);
    if (permission === "experiment.lifecycle") return owns;
    return visible;
  }
  if (permission === "access.approve") return account.role === "admin";
  return false;
}

export function validateSampleSql(sql) {
  const value = String(sql ?? "").trim();
  if (!value) return { valid: false, error: "请输入样本 SQL" };
  if (!/^select\s/i.test(value)) return { valid: false, error: "仅支持 SELECT 查询" };
  if (/;|--|\/\*|\b(insert|update|delete|drop|alter|create|merge|grant|revoke)\b/i.test(value)) return { valid: false, error: "SQL 包含不支持的语句或注释" };
  if (/\$\{BATCH_DATE\}(?![_A-Z])/i.test(value)) return { valid: false, error: "不支持 ${BATCH_DATE}，请使用 ${BATCH_DATE_START} 和 ${BATCH_DATE_END}" };
  return { valid: true, error: "" };
}

export function validateFilterCondition(condition) {
  const value = String(condition ?? "").trim();
  if (!value) return { valid: true, error: "" };
  if (/^where\b/i.test(value)) return { valid: false, error: "过滤条件无需填写 WHERE" };
  if (/;|--|\/\*|\b(select|insert|update|delete|drop|alter|create|merge|grant|revoke)\b/i.test(value)) return { valid: false, error: "过滤条件包含不支持的语句或注释" };
  if (/\$\{BATCH_DATE\}(?![_A-Z])/i.test(value)) return { valid: false, error: "不支持 ${BATCH_DATE}，请使用 ${BATCH_DATE_START} 和 ${BATCH_DATE_END}" };
  return { valid: true, error: "" };
}

export function appendFilterCondition(sql, condition) {
  const query = String(sql ?? "").trim();
  const predicate = String(condition ?? "").trim();
  if (!predicate) return query;
  return /\bwhere\b/i.test(query) ? `${query}\nAND (${predicate})` : `${query}\nWHERE ${predicate}`;
}

export function resolveHistoricalSnapshot(source, startDate, endDate) {
  const dayCount = Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1 || 14);
  if (!source) return { baseline: 0, dailyTraffic: 0, coverage: 0, stableDays: 0, startDate, endDate, sourceId: "", updatedAt: "", freshness: "未知" };
  const base = source?.domain === "会员" ? { baseline: 6.4, dailyTraffic: 96000, coverage: 82 } : source?.domain === "交易" ? { baseline: 18.4, dailyTraffic: 76000, coverage: 78 } : { baseline: 8.2, dailyTraffic: 180000, coverage: 88 };
  return { ...base, stableDays: Math.max(7, Math.min(30, dayCount)), startDate, endDate, sourceId: source?.id ?? "", updatedAt: source?.updatedAt ?? "", freshness: source?.updatedAt ? "新鲜" : "未知" };
}
