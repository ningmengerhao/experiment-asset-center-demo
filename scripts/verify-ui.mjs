import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("src/App.tsx");
const css = read("src/styles.css");
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

check("ordinary-user navigation is stage organized", includesAll(app, ["实验前", "分流阶段", "上线前", "运行中", "实验管理"]));
check("experiment management places lineage directly after ledger", /title:\s*"实验管理"[\s\S]*key:\s*"list"[\s\S]*key:\s*"lineage"[\s\S]*key:\s*"rollout"/.test(app));
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
