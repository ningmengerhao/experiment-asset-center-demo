import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("src/App.tsx");
const css = read("src/styles.css");
const investigation = read("src/investigation.mjs");
const dist = read("dist/index.html");
const builder = read("scripts/build-static.mjs");
const browserVerifier = read("scripts/verify-browser.mjs");
const packageManifest = JSON.parse(read("package.json"));
const seedPage = app.slice(app.indexOf("function renderSeedTool"), app.indexOf("function renderInvestigationWorkbench"));
const monitorPage = app.slice(app.indexOf("function renderInvestigationWorkbench"), app.indexOf("function renderImportReview"));
const permissionPage = app.slice(app.indexOf("function renderPermission"), app.indexOf("function renderSampleTool"));
const evaluationPage = app.slice(app.indexOf("function renderEvaluation"), app.indexOf("function renderExperimentList"));
const checkPage = app.slice(app.indexOf("function renderTestTool"), app.indexOf("function renderConflict"));

const checks = [];
function check(name, condition) {
  checks.push([name, Boolean(condition)]);
}
function includesAll(source, tokens) {
  return tokens.every((token) => source.includes(token));
}

const inlineScripts = [...dist.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const inlineStyles = [...dist.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)];
const externalAssets = /<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["'][^"']+["']/i.test(dist);

check("generated artifact has one inline script", inlineScripts.length === 1 && inlineScripts[0][2].trim().length > 10_000);
check("generated artifact has one inline stylesheet", inlineStyles.length === 1 && inlineStyles[0][2].trim().length > 10_000);
check("generated artifact is direct-open and self-contained", dist.includes('<div id="root"></div>') && !externalAssets);
check("generated artifact carries a source fingerprint", /<meta name="experiment-static-fingerprint" content="[a-f0-9]{64}">/.test(dist));
check("artifact is generated from React production source", includesAll(builder, ["esbuild.build", 'format: "iife"', "process.env.NODE_ENV", "computeStaticFingerprint"]));
check("artifact does not contain the React development runtime", !dist.includes("react.development.js") && !dist.includes("Download the React DevTools"));
check("legacy hand-written static DOM contract is absent", !dist.includes('data-page="evaluate"') && !dist.includes('id="rolloutBody"') && !dist.includes("function switchTab"));

check("ordinary-user navigation keeps a dedicated home before stage groups", /title:\s*"首页"[\s\S]*key:\s*"list"[\s\S]*label:\s*"首页"[\s\S]*title:\s*"实验前"/.test(app));
check("experiment management starts with lineage after moving the ledger home", /title:\s*"实验管理"[\s\S]*key:\s*"lineage"[\s\S]*key:\s*"rollout"[\s\S]*key:\s*"myImports"/.test(app));
check("feasibility assessment covers operational dimensions and alternatives", includesAll(evaluationPage, ["流量覆盖", "基线稳定", "实验污染", "护栏完整", "业务价值", "替代方案"]));
check("seed page owns traffic structure instead of statistical validation", includesAll(seedPage, ["分流方案", "分流层", "样本口径", "历史复用风险", "带入上线前检查"])
  && !includesAll(seedPage, ["<th>Pre-AA</th>", "<th>均匀性</th>", "<th>正交性</th>"]));
check("pre-launch validation supports explicit comparison scope", includesAll(checkPage, ["校验范围", "全部运行实验", "同业务域", "同分流层", "手动指定", "范围内实验"]));
check("monitor workbench has alerts attribution and rule configuration", includesAll(monitorPage, ["告警中心", "异常归因", "规则配置", "data-monitor-view", "分析影响来源", "关联嫌疑，不代表因果"]));
check("alert rules expose permission status version and audit feedback", includesAll(monitorPage, ["告警规则", "连续周期", "通知对象", "版本", "变更记录", "validateAlertRule", "transitionAlertRule"]));
check("permission page supports role profiles scopes and audit", includesAll(permissionPage, ["角色档案", "可见范围", "动作权限", "代理负责人", "规则阈值范围", "权限变更记录"]));
check("ordinary-user pages are real render targets", includesAll(app, [
  'activeTab === "evaluate"', 'activeTab === "seed"', 'activeTab === "seedHistory"',
  'activeTab === "check"', 'activeTab === "investigate"', 'activeTab === "list"',
  'activeTab === "lineage"', 'activeTab === "rollout"', 'activeTab === "myImports"',
]));
check("admin pages remain role gated", includesAll(app, ['roleView === "admin"', "importReview", "governance", "permission"]));
check("navigation and hash share one entry point", includesAll(app, ["function navigateToTab", 'window.addEventListener("hashchange"', "buildInvestigationHash", "recoverInvestigationLocation"]));
check("left navigation exposes current-page semantics", includesAll(app, ['aria-label="主导航"', 'aria-current={activeTab === item.key ? "page" : undefined}']));
check("stage controls are semantic buttons", includesAll(app, ["stageTargets.map", "stage-step", 'aria-current={stageByTab[activeTab] === step.tab ? "step" : undefined}']));
check("help trigger is accessible and stable", includesAll(app, ['id="headerHelpButton"', 'aria-label="帮助文档"']));
check("drawers expose dialog semantics", includesAll(app, ['role="dialog"', 'aria-modal="true"', "closeTopmostDrawer", "trapDrawerFocus"]));
check("ledger exposes four default filters and a draft-backed filter dialog", includesAll(app, ["data-ledger-default-filters", "data-open-filter-dialog", "filterDialogOpen", "filterDraft", "applyFilterDraft", "data-filter-dialog"]));
check("ledger fields place filter names inside extended inputs and owner supports fuzzy input", includesAll(app, ["data-ledger-filter=\"keyword\"", "placeholder=\"实验 ID / 名称\"", "data-ledger-filter=\"owner\"", "placeholder=\"负责人\"", "const ownerKeyword", "includes(ownerKeyword)", "owner-options"]));
check("ledger filters use a white single-row toolbar", includesAll(css, [".ledger-filter-bar", "background: var(--surface)", ".ledger-filter-grid", "flex-wrap: nowrap", "overflow-x: auto", ".ledger-keyword-field", "flex: 0 0 192px", ".ledger-owner-field", "flex: 0 0 152px", ".ledger-filter-actions"]));
check("ledger filter dialog uses a responsive two-column layout", includesAll(css, [".filter-dialog-grid", "grid-template-columns: repeat(2", ".filter-dialog-mask"]));
check("new experiment control opens a creation-method dialog", includesAll(app, ["data-open-create-experiment", "createExperimentOpen", "data-create-experiment-dialog", "data-create-method=\"import\"", "data-create-method=\"direct\""]) && includesAll(css, [".create-experiment-dialog", ".create-experiment-options"]));
check("direct creation uses a hidden four-step wizard", includesAll(app, ["activeTab === \"create\"", "renderCreateFlow", "data-page-id=\"create\"", "data-create-basic", "data-create-next", "data-create-complete", "navigateToCreateStep"]) && includesAll(css, [".create-progress", ".create-sample-grid", ".create-seed-grid", ".create-validation-context", ".create-flow-footer"]));
check("creation wizard owns its domain split ratios and generated seed snapshot", includesAll(app, ["data-create-basic=\"domain\"", "data-create-split-config", "calculateSplitSamplePlan", "data-create-allocation-summary", "data-create-seed-summary", "data-create-seed-generate", "isGeneratedConfigCurrent", "rankCandidateResults"]) && includesAll(css, [".create-split-config", ".create-split-groups", ".create-seed-summary", ".create-seed-stale"]));
check("new experiment persistence is isolated from legacy workflows", includesAll(app, ["loadCreateDraft", "saveCreateDraft", "loadCreatedRecords", "saveCreatedRecords", "ledgerExperiments"]) && includesAll(investigation, ['"create"']));
check("home is the route fallback", includesAll(investigation, ['return { tab: "list", context: null };', 'return { tab: "list", context: stored, invalidHash: true, shouldPersist: false };']));
check("investigation browser selectors exist", includesAll(app, ["data-start-investigation", "data-investigation-status", "data-evidence-focus", "data-relationship-node", "data-rollout-event"]));
check("app and ordinary pages expose stable browser contracts", includesAll(app, [
  "data-active-page", "data-page-id=\"evaluate\"", "data-page-id=\"seed\"", "data-page-id=\"seedHistory\"",
  "data-page-id=\"check\"", "data-page-id=\"investigate\"", "data-page-id=\"list\"",
  "data-page-id=\"lineage\"", "data-page-id=\"rollout\"", "data-page-id=\"myImports\"", "data-page-core=",
]));
check("investigation context exposes exact state attributes", includesAll(app, [
  "data-investigation-experiment", "data-investigation-alert", "data-investigation-range", "data-investigation-focus",
]));
check("mobile navigation is a horizontal rail", includesAll(css, ["@media (max-width: 760px)", ".sidebar-nav {", "overflow-x: auto", ".nav-item {"]));
check("page shell permits only local table overflow", includesAll(css, [".table-wrap", "overflow-x: auto", ".app-shell", "min-width: 0"]));
check("keyboard focus styles are visible", includesAll(css, [":focus-visible", "outline: 2px solid"]));
check("layout-changing transitions stay absent", !/transition\s*:[^;]*(?:width|max-width|padding|margin|height)/i.test(css));

check("browser verifier uses system Edge CDP", includesAll(browserVerifier, ["Microsoft", "Edge", "--remote-debugging-port", "new WebSocket", "Runtime.evaluate"]));
check("browser verifier covers the investigation chain", includesAll(browserVerifier, ["ALT-003", "history.back()", "relationship hash", "browser back restores"]));
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
