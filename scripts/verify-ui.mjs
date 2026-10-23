import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("src/App.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
const css = read("src/styles.css");
const demoAccess = read("src/demo-access.mjs");
const investigation = read("src/investigation.mjs");
const dist = read("dist/index.html");
const builder = read("scripts/build-static.mjs");
const browserVerifier = read("scripts/verify-browser.mjs");
const packageManifest = JSON.parse(read("package.json"));
const seedPage = app.slice(app.indexOf("function renderSeedTool"), app.indexOf("function renderInvestigationWorkbench"));
const monitorPage = app.slice(app.indexOf("function renderInvestigationWorkbench"), app.indexOf("function renderImportReview"));
const permissionPage = app.slice(app.indexOf("function renderRoles"), app.indexOf("function renderSampleTool"));
const evaluationPage = app.slice(app.indexOf("function renderEvaluation"), app.indexOf("function renderExperimentList"));
const checkPage = app.slice(app.indexOf("function renderTestTool"), app.indexOf("function renderConflict"));
const metricLibraryPage = app.slice(app.indexOf("function renderMetricLibrary"), app.indexOf("function renderEvaluation"));

const checks = [];
function check(name, condition) {
  checks.push([name, Boolean(condition)]);
}
function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

const inlineScripts = [...dist.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inlineStyles = [...dist.slice(0, dist.search(/<script\b/i)).matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
const externalAssets = /<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["'][^"']+["']/i.test(dist);

check("generated artifact has one inline script", inlineScripts.length === 1 && inlineScripts[0][2].trim().length > 10_000);
check("generated artifact has one inline stylesheet", inlineStyles.length === 1 && inlineStyles[0][2].trim().length > 10_000);
check("generated artifact is direct-open and self-contained", dist.includes('<div id="root"></div>') && !externalAssets);
check("generated artifact carries a source fingerprint", /<meta name="experiment-static-fingerprint" content="[a-f0-9]{64}">/.test(dist));
check("artifact is generated from React production source", includesAll(builder, ["esbuild.build", 'format: "iife"', "process.env.NODE_ENV", "computeStaticFingerprint"]));
check("artifact does not contain the React development runtime", !dist.includes("react.development.js") && !dist.includes("Download the React DevTools"));
check("legacy hand-written static DOM contract is absent", !dist.includes('data-page="evaluate"') && !dist.includes('id="rolloutBody"') && !dist.includes("function switchTab"));

check("ordinary-user navigation starts with the home dashboard and removes legacy stage groups", /title:\s*"总览"[\s\S]*key:\s*"home"[\s\S]*label:\s*"首页"/.test(app) && /title:\s*"实验管理"[\s\S]*key:\s*"list"[\s\S]*label:\s*"实验管理"/.test(app) && !app.includes('title: "实验前"') && !app.includes('title: "分流阶段"') && !app.includes('title: "上线前"'));
check("experiment management keeps only the ledger", /title:\s*"实验管理"[\s\S]*key:\s*"list"/.test(app) && !app.includes('key: "myImports"') && !app.includes('key: "importReview"') && !app.includes('key: "access"'));
check("legacy evaluation split and check pages are not rendered", !includesAll(app, ['activeTab === "evaluate"', 'activeTab === "seed"', 'activeTab === "check"']));
check("monitor workbench has alerts attribution and rule configuration", includesAll(monitorPage, ["告警中心", "异常归因", "规则配置", "data-monitor-view", "分析影响来源", "关联嫌疑，不代表因果"]));
check("alert rules expose permission status version and audit feedback", includesAll(monitorPage, ["告警规则", "连续周期", "通知对象", "版本", "变更记录", "validateAlertRule", "transitionAlertRule"]));
check("permission configuration supports role and person management", includesAll(permissionPage, ["角色管理", "人员管理", "业务域范围", "功能权限", "分配角色", "至少保留一个启用管理员"]));
check("ordinary-user pages are real render targets", includesAll(app, [
  'activeTab === "home"', 'activeTab === "investigate"', 'activeTab === "list"',
  'activeTab === "metrics"', 'selected ? renderExperimentDetail(selected)',
]));
check("admin pages remain role gated", includesAll(app, ['roleView === "admin"', 'activeTab === "roles"', 'activeTab === "people"']) && !app.includes('activeTab === "importReview"'));
check("navigation and hash share one entry point", includesAll(app, ["function navigateToTab", 'window.addEventListener("hashchange"', "buildInvestigationHash", "recoverInvestigationLocation"]));
check("navigation clears any open experiment detail before rendering the destination", includesAll(app, ["function navigateToTab", 'setSelected(null);', 'setDetailTab("basic");']));
check("left navigation exposes current-page semantics", includesAll(app, ['aria-label="主导航"', 'aria-current={activeTab === item.key ? "page" : undefined}']));
check("stage controls are semantic buttons", includesAll(app, ["stageTargets.map", "stage-step", 'aria-current={stageByTab[activeTab] === step.tab ? "step" : undefined}']));
check("help trigger is accessible and stable", includesAll(app, ['id="headerHelpButton"', 'aria-label="帮助文档"']));
check("drawers expose dialog semantics", includesAll(app, ['role="dialog"', 'aria-modal="true"', "closeTopmostDrawer", "trapDrawerFocus"]));
check("ledger exposes four default filters and a draft-backed filter dialog", includesAll(app, ["data-ledger-default-filters", "data-open-filter-dialog", "filterDialogOpen", "filterDraft", "applyFilterDraft", "data-filter-dialog"]));
check("ledger pagination supports direct pages previous next and page jumps", includesAll(app, ["paginate(filteredExperiments", "data-ledger-page-prev", "data-ledger-page-next", "data-ledger-page-input", "data-ledger-page-jump", "goToLedgerPage", "submitLedgerPageJump", "pagedExperiments.map"]) && includesAll(css, [".pagination-jump", ".pagination-jump input"]));
check("ledger fields place filter names inside extended inputs and owner supports fuzzy input", includesAll(app, ["data-ledger-filter=\"keyword\"", "placeholder=\"实验 ID / 名称\"", "data-ledger-filter=\"owner\"", "placeholder=\"负责人\"", "const ownerKeyword", "includes(ownerKeyword)", "owner-options"]));
check("ledger filters use a white single-row toolbar", includesAll(css, [".ledger-filter-bar", "background: var(--surface)", ".ledger-filter-grid", "flex-wrap: nowrap", "overflow-x: auto", ".ledger-keyword-field", "flex: 0 0 192px", ".ledger-owner-field", "flex: 0 0 152px", ".ledger-filter-actions"]));
check("ledger filter dialog uses a responsive two-column layout", includesAll(css, [".filter-dialog-grid", "grid-template-columns: repeat(2", ".filter-dialog-mask"]));
check("new experiment control opens a creation-method dialog", includesAll(app, ["data-open-create-experiment", "createExperimentOpen", "data-create-experiment-dialog", "data-create-method=\"import\"", "data-create-method=\"direct\""]) && includesAll(css, [".create-experiment-dialog", ".create-experiment-options"]));
check("direct creation uses a hidden four-step wizard", includesAll(app, ["activeTab === \"create\"", "renderCreateFlow", "data-page-id=\"create\"", "data-create-basic", "data-create-next", "data-create-complete", "navigateToCreateStep"]) && includesAll(css, [".create-progress", ".create-sample-grid", ".create-seed-grid", ".create-validation-context", ".create-flow-footer"]));
check("creation wizard owns its domain split ratios and generated seed snapshot", includesAll(app, ["data-create-basic=\"domain\"", "data-create-split-config", "calculateCreateSampleAssessment", "data-create-allocation-summary", "data-create-seed-summary", "data-create-seed-generate", "buildCreateSeedCandidates", "maxAttempts = 20", "isGeneratedConfigCurrent", "isSeedGenerationCurrent", "rankCandidateResults"]) && !app.includes("data-create-seed-attempts") && includesAll(css, [".create-split-config", ".create-split-groups", ".create-seed-summary", ".create-seed-stale"]));
check("creation wizard selects one seed before the next step", includesAll(app, ["选择随机数种子", 'type="radio"', 'name="create-seed-choice"', "请选择一个随机数种子", 'createStep === "seed"']) && includesAll(css, [".create-seed-choice", ".create-manual-scope-list"]));
check("creation wizard evaluates split sums periods and feasibility in real time", includesAll(app, ["calculateCreateSampleAssessment", "data-create-split-total", "data-create-split-validation", "最小组所需样本量", "data-create-sample-results", "periodStatus", "data-create-period-recommendation", "data-create-feasibility-live"]) && includesAll(css, [".create-split-validation", ".create-feasibility-live"]));
check("new experiment saves editable ledger drafts and always starts fresh", includesAll(app, ["recordId", "saveCreateToLedger", "createLocalExperimentRecord(draft, \"draft\")", "data-edit-create-draft", "editCreateDraft", "createDefaultDraft()", "已保存到实验清单草稿，可继续当前编辑", "已开启新的实验登记"]) && !app.includes('navigateToTab("list");\n    showToast("已保存到实验清单草稿') && includesAll(css, [".status-dot.draft"]));
check("ledger uses unified statuses and conditional lifecycle actions", includesAll(app, ['"pending"', 'pending: "待上线"', 'getExperimentStatusActions', 'data-experiment-lifecycle', 'data-delete-experiment', 'updateExperimentLifecycle', 'deleteExperimentRecord', 'createLocalExperimentRecord({ ...createDraft, savedStep: "validation" }, "pending")']) && includesAll(css, [".ledger-delete-action", ".status-dot.draft"]));
check("only editable ledger records can be duplicated into drafts", includesAll(app, ["createDraftFromExperimentRecord", "duplicateExperimentRecord", "_copy", 'can("experiment.edit", item) ? <button type="button" data-duplicate-experiment', 'createLocalExperimentRecord(draft, "draft")']));
check("custom seeds can be validated in the creation flow", includesAll(app, ["自定义随机数种子", "data-create-custom-seed", "data-validate-custom-seed", "validateCustomCreateSeed", "customCandidate", "isValidCustomSeed"]) && includesAll(css, [".create-custom-seed-field", ".create-custom-seed-check"]));
check("metric library, permission dialogs, and experiment design share offline access data", includesAll(app, ["renderMetricLibrary", "openPermissionRequest", "data-permission-request-dialog", "data-message-center", "消息中心", "历史开始日期", "历史结束日期", "data-create-core-metric", "data-create-guardrail-add", "data-create-guardrail-remove", "data-create-filter-condition", "appendFilterCondition", "validateFilterCondition", "resolveHistoricalSnapshot", "selectDemoAccount"]) && !metricLibraryPage.includes("指标类型") && !metricLibraryPage.includes("type: ") && includesAll(css, [".metric-library-layout", ".demo-login", ".guardrail-metric-field", ".sample-sql-preview", ".message-center-dialog", ".permission-request-dialog"]));
check("ledger uses fixed actions and permission-safe rows", includesAll(app, ['data-experiment-access', 'data-request-experiment', 'openPermissionRequest("experiment", item)', '指标信息受限', '关系受限']) && includesAll(css, ['width: 256px', '.ledger-table.sticky-actions th:last-child', '.ledger-table .row-actions']));
check("create wizard marks actual first-step requirements", includesAll(app, ['className="required-marker"', '核心指标', '样本来源', '样本 SQL']) && includesAll(css, ['.required-marker', 'var(--danger-text)']));
check("message center stores local upload results without auto-opening after import", includesAll(app, ['messageCenterOpen', 'messageTab', '待我审批的权限申请', 'pendingApprovalRequests', '一键通过', 'submitBulkImport', '共上传', '下载失败记录', 'downloadImportTemplate', 'handleImportFile']) && !app.slice(app.indexOf('function submitBulkImport'), app.indexOf('function downloadImportTemplate')).includes('openMessageCenter') && !app.includes('activeTab === "myImports"') && !app.includes('activeTab === "access"'));
check("metric management uses a ledger and separate editor", includesAll(app, ['data-page-id="metrics"', 'data-page-id="metricEditor"', 'openMetricEditor', '启用中的指标不允许删除', 'metricReferenced', 'data-metric-access']) && includesAll(css, ['.ledger-table.sticky-actions']));
check("metric editor removes unit and denominator and the library supports ledger-style filters", includesAll(app, ['data-metric-filters', 'data-metric-filter="keyword"', 'data-metric-filter="domain"', 'data-metric-filter="status"', 'data-metric-filter="owner"']) && !metricLibraryPage.includes('<span>单位</span>') && !metricLibraryPage.includes('<span>分母</span>'));
check("home dashboard exposes editable-only observation cards and drill-downs", includesAll(app, ['function renderHome', 'data-page-id="home"', '运行中实验', '待上线实验', '需关注异常', '已结束实验', 'dashboardExperiments', 'can("experiment.edit", experiment)', 'editableOnly: true', 'data-ledger-access-scope']) && includesAll(css, ['.home-dashboard', '.home-stat-grid', '.home-dashboard-grid']));
check("domain visibility gates resource rows before resource authorization", includesAll(app, ['hasDomainAccess', 'const canAccessDomain', 'if (!canList(item)) return false', 'if (!canAccessDomain(metric)) return false']) && includesAll(demoAccess, ['function canListExperiment', 'function canRequestExperimentPermission', 'function isExperimentOwner']) && includesAll(css, ['.ledger-access-scope']));
check("experiments require owner-approved resource grants while metrics retain domain visibility", includesAll(app, ['canApproveExperimentRequest', 'canApprovePermissionRequest', 'approverId', 'canRequestMetricEditPermission', '申请编辑权限']) && includesAll(demoAccess, ['function canApproveExperimentRequest', 'permission === "experiment.edit"', 'return isExperimentOwner(account, resource)', 'if (permission === "metric.view") return true']) && includesAll(css, ['.permission-request-summary', '.permission-request-options']));
check("message center keeps fixed dimensions and table columns", includesAll(app, ['message-action-link', '<colgroup><col /><col /><col /><col /><col /></colgroup>', 'approval-table']) && includesAll(css, ['grid-template-rows: auto auto minmax(0, 1fr)', 'height: min(720px', 'table-layout: fixed', '.message-action-link', '.message-center-panel']));
check("detail and editor return controls use the unified text action", includesAll(app, ['className="back-link" onClick={closeDetail}>返回', 'className="back-button" type="button" onClick={() => navigateToTab("metrics")}>返回', 'onClick={() => setRoleEditorMode(null)}>返回', 'onClick={() => setPersonEditorMode(null)}>返回']) && includesAll(css, ['.back-button', 'margin: 0 0 12px', 'background: transparent']));
check("import uses a centered dialog with template and upload entry points", includesAll(app, ['data-import-dialog-mask', 'data-import-dialog', 'import-template-tile', 'import-upload-zone']) && includesAll(css, ['.import-dialog', '.import-entry-layout', '.import-template-tile', '.import-upload-zone']));
check("role and people lists support searches and compact aligned permission choices", includesAll(app, ['data-role-filters', 'data-person-filters', 'compact-choice-grid', 'compact-choice', 'data-page-id="roleEditor"', 'data-page-id="personEditor"']) && includesAll(css, ['.compact-choice', 'width: 16px', '.permission-choice-grid', '.admin-editor-page']));
check("full detail uses accessible tabs and keeps investigation last", includesAll(app, ['data-page-id="detail"', 'role="tablist"', 'role="tab"', 'aria-selected={detailTab === item.id}', '"基础信息"', '"父子实验"', '"放量历史"', '"校验快照"', 'data-start-investigation={experiment.id}', 'onKeyDown={selectAdjacentTab}', 'openDetailTab(currentExperiment, "validation")']) && includesAll(css, [".experiment-detail-page", ".detail-tabs", ".detail-summary-grid", ".detail-tab-panel"]));
check("removed relationship and rollout routes fall back to the ledger", !/^\s*"lineage",/m.test(investigation) && !/^\s*"rollout",/m.test(investigation));
check("home is the route fallback", includesAll(investigation, ['return { tab: "home", context: null };', 'return { tab: "home", context: stored, invalidHash: true, shouldPersist: false };']));
check("investigation keeps its interaction selectors while hiding the global context bar", includesAll(app, ["data-start-investigation", "data-evidence-focus", "data-relationship-node", "data-rollout-event"]) && !app.includes('data-investigation-status'));
check("app and ordinary pages expose stable browser contracts", includesAll(app, [
  "data-active-page", "data-page-id=\"evaluate\"", "data-page-id=\"seed\"",
  "data-page-id=\"check\"", "data-page-id=\"investigate\"", "data-page-id=\"home\"", "data-page-id=\"list\"",
  "data-page-id=\"detail\"", "data-page-core=",
]));
check("global investigation context bar is not rendered", !app.includes('investigation-context-bar') && !app.includes('data-investigation-experiment'));
check("mobile navigation is a horizontal rail", includesAll(css, ["@media (max-width: 760px)", ".sidebar-nav {", "overflow-x: auto", ".nav-item {"]));
check("page shell permits only local table overflow", includesAll(css, [".table-wrap", "overflow-x: auto", ".app-shell", "min-width: 0"]));
check("keyboard focus styles are visible", includesAll(css, [":focus-visible", "outline: 2px solid"]));
check("layout-changing transitions stay absent", !/transition\s*:[^;]*(?:width|max-width|padding|margin|height)/i.test(css));

check("browser verifier uses system Edge CDP", includesAll(browserVerifier, ["Microsoft", "Edge", "--remote-debugging-port", "new WebSocket", "Runtime.evaluate"]));
check("browser verifier covers the investigation-to-detail chain", includesAll(browserVerifier, ["ALT-003", "relationship detail tab", "detail returns to its source page", "data-detail-tab=\"rollout\""]));
check("browser verifier covers Escape and focus restore", includesAll(browserVerifier, ["Input.dispatchKeyEvent", "headerHelpButton", "help trigger focus restoration"]));
check("browser verifier covers all required viewports", includesAll(browserVerifier, ["width: 1366", "width: 585", "width: 390", "page-level horizontal overflow"]));
check("browser verifier performs physical exact clicks", includesAll(browserVerifier, ["Input.dispatchMouseEvent", "elementFromPoint", "isContentEditable", "disabled"])
  && !browserVerifier.includes(".click()")
  && !browserVerifier.includes(".includes(expected)"));
check("browser verifier checks page identity, core regions, nav visibility and table containment", includesAll(browserVerifier, [
  "data-page-id", "data-page-core", "0.8", "table-wrap", "scrollWidth", "clientWidth",
]));
check("browser verifier guarantees cleanup", includesAll(browserVerifier, ["finally", 'cdp.send("Browser.close"', "taskkill", "fs.rmSync(userDataDir"]));
check("npm verification commands include browser and aggregate gates", packageManifest.scripts["verify:browser"] === "node scripts/verify-browser.mjs"
  && typeof packageManifest.scripts["verify:all"] === "string"
  && packageManifest.scripts["verify:all"].includes("verify:browser")
  && packageManifest.scripts["verify:all"].includes("verify:static")
  && packageManifest.scripts["verify:all"].includes("tsc -b"));
check("monitoring logic is part of the aggregate logic gate", packageManifest.scripts["verify:logic"].includes("test-monitoring.mjs"));

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error(`UI verification failed (${failed.length}/${checks.length}):`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

assert(checks.length >= 20, "UI verification lost too much coverage.");
console.log(`UI verification passed (${checks.length}/${checks.length}).`);
