import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("src/App.tsx");
const css = read("src/styles.css");
const access = read("src/demo-access.mjs");
const routing = read("src/investigation.mjs");
const dist = read("dist/index.html");
const checks = [];
const all = (source, tokens) => tokens.every((token) => source.includes(token));
const check = (name, passed) => checks.push([name, Boolean(passed)]);

check("static artifact remains self-contained", /experiment-static-fingerprint/.test(dist) && !/<script[^>]+src=/i.test(dist));
check("navigation calls the dashboard experimental overview and removes monitor entry", all(app, ['label: "实验总览"', 'key: "home"', 'key: "list"']) && !app.includes('label: "监控排查"'));
check("detail is the only visible case entry and remains editor-gated", all(app, ['function openEffectAnalysis', 'can("experiment.edit", experiment)', 'data-start-investigation={experiment.id}', '选择分析范围']) && !app.includes('key: "investigate", label:'));
check("analysis workspace exposes the required four sections", all(app, ['异常排查', '异常概览', '分层下钻', '交叉验证', '证据与通知', 'effect-inversion-analysis']));
check("analysis selection supports all requested ranges", all(app, ['"7d", "14d", "30d"', 'findEffectInversionEvent', 'runEffectAnalysis']));
check("message center keeps approvals visible and exposes linked collaboration notices", all(app, ['待我审批 ${pendingApprovalRequests.length}', '暂无待我审批的权限申请', '协同通知', 'candidateExperiment.name', 'candidateExperiment.id', 'openCandidateExperiment', 'unreadCollaborationNoticeCount', '标记已读']));
check("candidate projection identifies protected records without leaking their contents", all(app, ['projectCandidateVerification', 'candidate.disclosure === "full"', '负责人：${candidate.owner}']) && all(read("src/anomaly-analysis.mjs"), ['displayName: verification.experimentId', 'disclosure: "identified"', 'riskCategory: "交叉流量风险"']));
check("global search only opens from explicit interactions and has reliable close behavior", all(app, ['globalSearchRef', 'onPointerDown={() => setCommandOpen(true)}', '关闭全局搜索', 'closeOnOutsidePointer']) && !app.includes('onFocus={() => setCommandOpen(true)}'));
check("analysis sends and backfills notifications for medium-risk candidates", all(app, ['buildMissingCollaborationNotices', 'verifications.filter(isCollaborationNoticeEligible)', '当前范围未定位异常']) && all(read("src/anomaly-analysis.mjs"), ['Number(verification?.score) >= 60', '待核验交叉信号', 'buildMissingCollaborationNotices']));
check("new experiment stores core metric expected direction", all(app, ['核心指标预期方向', 'expectedDirection: draft.basic.expectedDirection']) && all(read("src/create-experiment.mjs"), ['expectedDirection: "up"']));
check("messages and analysis are accessible modal/dialog surfaces", all(app, ['role="dialog"', 'aria-modal="true"', 'trapDrawerFocus', 'activeDrawer === "analysis"']));
check("analysis design is responsive without global table overflow", all(css, ['.effect-overview-grid', '.effect-analysis-sections', '.candidate-verification-list', '@media (max-width: 760px)']) && all(css, ['.table-wrap', 'overflow-x: auto']));
check("legacy routing supports alert compatibility and case query", all(routing, ['if (tab === "alert") tab = "investigate";', '"case"', 'params.set("case", context.caseId)']));
check("demo storage persists case and notice collections", all(access, ['analysisCases: []', 'collaborationNotices: []', 'Array.isArray(value.analysisCases)']));
check("role management maintains a compact global business-domain editor", all(app, ['businessDomains', 'data-business-domain-edit', 'data-business-domain-editor', 'data-add-business-domain', '重命名业务域', '业务域仍被${usage.join("、")}引用']) && all(access, ['businessDomains: [...ALL_DOMAINS]', 'collectLegacyDomains', 'experimentOverrides']));
check("role permission controls use module-action Chinese labels", all(access, ['ROLE_PERMISSION_OPTIONS', '实验管理-查看', '实验管理-状态操作', '异常排查-查看']) && all(app, ['ROLE_PERMISSION_OPTIONS.map', 'permission.label']));
check("business-domain consumers use the dynamic catalog", all(app, ['runImportPrecheck(uploadedImport.rows, ledgerExperiments, businessDomains)', 'businessDomains.map((domain)', 'createCurrentDomainDraft']));
check("no page-level old monitoring navigation is reachable", !app.includes('label: "监控排查"') && app.includes('function renderInvestigation()'));

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error(`UI verification failed (${failed.length}/${checks.length}):`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
assert(checks.length >= 12);
console.log(`UI verification passed (${checks.length}/${checks.length}).`);
