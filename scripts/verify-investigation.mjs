import fs from "node:fs";
import assert from "node:assert/strict";
import { classifyOutputs, computeStaticFingerprint } from "./build-static.mjs";
import {
  buildInvestigationHash,
  loadInvestigationContext,
  parseInvestigationLocation,
  recoverInvestigationLocation,
  saveInvestigationContext,
  transitionInvestigation,
} from "../src/investigation.mjs";
import { getFocusTrapTarget, popDrawer, pushDrawer } from "../src/drawer.mjs";

const rawApp = fs.readFileSync("src/App.tsx", "utf8");
const app = rawApp
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");
const rawCss = fs.readFileSync("src/styles.css", "utf8");
const css = rawCss
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");
const investigation = fs.readFileSync("src/investigation.mjs", "utf8");
const dist = fs.readFileSync("dist/index.html", "utf8");
const packageManifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
const staticBuilder = fs.readFileSync("scripts/build-static.mjs", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

function extractStaticAsset(html, tagName) {
  const matches = [...html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi"))];
  return matches.map((match) => ({ attributes: match[1], content: match[2] }));
}

const memory = new Map();
const storage = {
  getItem(key) {
    return memory.get(key) ?? null;
  },
  setItem(key, value) {
    memory.set(key, value);
  },
  removeItem(key) {
    memory.delete(key);
  },
};

const storedContext = {
  caseId: "CASE-260820-004",
  experimentId: "EXP-240611-017",
  alertId: "ALT-001",
  timeRange: "14d",
  entrySource: "monitor",
  evidenceFocus: "overview",
  status: "investigating",
  owner: "陈露",
  collaborators: ["赵晨"],
  resolution: "",
  updatedAt: "2026-08-20 10:30",
  actions: [],
};

// Canonical URL roundtrip uses the production hash parser/builder.
const canonicalHash = buildInvestigationHash("investigate", storedContext);
assert.equal(canonicalHash, "#investigate?experiment=EXP-240611-017&alert=ALT-001&range=14d&focus=overview");
const canonicalLocation = parseInvestigationLocation(canonicalHash);
assert.equal(canonicalLocation.tab, "investigate");
assert.equal(canonicalLocation.context?.experimentId, storedContext.experimentId);
assert.equal(canonicalLocation.context?.timeRange, storedContext.timeRange);

// Recovery is executed by the same pure contract used by React, not by a
// verifier-side model of URL/storage precedence.
saveInvestigationContext(storedContext, storage);
const invalidRecovery = recoverInvestigationLocation("#investigate?experiment=EXP%3Cscript%3E", storage);
assert.equal(invalidRecovery.tab, "evaluate");
assert.equal(invalidRecovery.invalidHash, true);
assert.equal(invalidRecovery.shouldPersist, false);
assert.equal(invalidRecovery.context?.caseId, storedContext.caseId);
assert.equal(loadInvestigationContext(storage)?.caseId, storedContext.caseId);
assert.match(
  investigation,
  /if \(invalidHash\)\s*\{\s*return \{ tab: "evaluate", context: stored, invalidHash: true, shouldPersist: false \};/,
  "Recovery: invalid hash branch must retain validated storage without persistence",
);

const urlOverride = recoverInvestigationLocation("#investigate?experiment=EXP-240611-017&range=7d&focus=rollout", storage);
assert.equal(urlOverride.context?.timeRange, "7d");
assert.equal(urlOverride.context?.evidenceFocus, "rollout");
assert.equal(urlOverride.shouldPersist, true);
saveInvestigationContext(urlOverride.context, storage);
assert.equal(loadInvestigationContext(storage)?.timeRange, "7d");
assert.equal(buildInvestigationHash("lineage", loadInvestigationContext(storage)), "#lineage?experiment=EXP-240611-017&alert=ALT-001&range=7d&focus=rollout");

// The real state machine permits one legal transition and rejects a shortcut.
const resolved = transitionInvestigation(storedContext, "resolved", "已定位放量窗口重叠");
assert.equal(resolved.status, "resolved");
assert.throws(() => transitionInvestigation(storedContext, "closed", "跳过定位"), /invalid transition/);

// Drawer behavior is executed directly rather than reimplemented in this
// verifier. UI assertions below only prove App consumes this contract.
const nestedDrawers = pushDrawer(pushDrawer([], "detail"), "help");
assert.deepEqual(nestedDrawers, ["detail", "help"]);
assert.deepEqual(popDrawer(nestedDrawers), { stack: ["detail"], closed: "help", active: "detail" });
assert.deepEqual(pushDrawer(nestedDrawers, "detail"), ["help", "detail"]);
assert.deepEqual(popDrawer([]), { stack: [], closed: null, active: null });
assert.equal(getFocusTrapTarget(3, 2, false), 0);
assert.equal(getFocusTrapTarget(3, 0, true), 2);
assert.equal(getFocusTrapTarget(3, -1, false), 0);
assert.equal(getFocusTrapTarget(3, -1, true), 2);
assert.equal(getFocusTrapTarget(0, -1, false), -1);

// Task 3 source-level contract.
assert.match(app, /function\s+startInvestigation\s*\(/, "React: missing startInvestigation");
assert.match(app, /function\s+navigateWithInvestigation\s*\(/, "React: missing navigateWithInvestigation");
assert.match(app, /function\s+updateInvestigationStatus\s*\(/, "React: missing updateInvestigationStatus");
assert.match(app, /normalizedNote\.length\s*<\s*6/, "React: resolved/closed flow lacks six-character conclusion guard");
assert.match(app, /\["resolved", "closed"\]\.includes\(nextStatus\)/, "React: conclusion guard must cover resolved and closed states");
assert.match(app, /recoverInvestigationLocation/, "React: must consume the pure recovery contract");
assert.doesNotMatch(app, /function\s+recoverInvestigationContext\s*\(/, "React: duplicate recovery logic must be removed");
assert.match(app, /const recovered = recoverInvestigationLocation\(window\.location\.hash\);/, "React: hash handler must recover through the pure contract");
assert.match(app, /const recoveredContext = enrichDirectInvestigationOwner\(recovered\.context\);/, "React: direct URL context must be enriched from local experiment metadata");
assert.match(app, /if \(recovered\.shouldPersist && recoveredContext\)\s*\{\s*saveInvestigationContext\(recoveredContext\);\s*\}/, "React: hash recovery must persist the normalized context");
assert.doesNotMatch(app, /saveInvestigationContext\(null/, "React: invalid URL must not delete validated storage");
assert.match(app, /LOCAL_CASE_SEQUENCE_PREFIX/, "React: missing dedicated local case sequence key");
assert.match(app, /function\s+createLocalCaseId\s*\(/, "React: missing resilient local case identifier helper");
assert.match(app, /sessionStorage\.setItem\(sequenceKey/, "React: local case sequence is not persisted independently");
assert.match(app, /本地临时排查编号/, "React: case value must be labelled as a local temporary number");
assert.match(app, /investigation-context-bar/, "React: missing investigation context bar");
assert.match(css, /\.investigation-context-bar/, "CSS: missing investigation context bar styles");

// Task 4: evidence workbench contract. These checks intentionally target
// semantic controls and shared investigation context instead of copied labels.
for (const token of [
  "异常队列",
  "当前排查",
  "统一证据时间线",
  "上游与父实验",
  "当前实验",
  "下游与互斥实验",
  "关系变更记录",
  "聚焦当前实验",
  "返回全部放量",
  "加入排查",
]) {
  assert.ok(app.includes(token), `React Task 4: missing ${token}`);
}
assert.match(app, /type="checkbox"/, "React Task 4: problem types must use real multi-select checkboxes");
assert.match(app, /filteredMonitorAlerts/, "React Task 4: monitor queue must be filtered from selected problem types");
assert.match(app, /className="rollout-timeline"/, "React Task 4: rollout needs a first-viewport timeline");
assert.match(app, /const detailEvidence/, "React Task 4: detail drawer must derive scoped evidence");
assert.match(app, /navigateWithInvestigation\("lineage", "relationship"\)/, "React Task 4: relationship focus must preserve context");
assert.match(app, /navigateWithInvestigation\("rollout", "rollout"\)/, "React Task 4: rollout focus must preserve context");
assert.match(app, /navigateWithInvestigation\("check", "validation"\)/, "React Task 4: validation focus must preserve context");
assert.match(css, /\.rollout-timeline/, "CSS Task 4: rollout timeline styles missing");
assert.match(css, /\.relationship-map/, "CSS Task 4: relationship map styles missing");

// Review regression checks: relationship direction follows the focused node,
// not the arbitrary source/target storage order. Mutual relations always live
// in the downstream/mutual column and must never render the focus as its peer.
function relationshipPlacement(record, focusedExperimentId) {
  if (!record || (record.sourceExperimentId !== focusedExperimentId && record.targetExperimentId !== focusedExperimentId)) return null;
  const peerId = record.sourceExperimentId === focusedExperimentId ? record.targetExperimentId : record.sourceExperimentId;
  if (peerId === focusedExperimentId) return null;
  return {
    peerId,
    side: record.type === "互斥实验" || record.sourceExperimentId === focusedExperimentId ? "downstream" : "upstream",
  };
}
const parentToChild = { sourceExperimentId: "EXP-parent", targetExperimentId: "EXP-child", type: "父实验" };
assert.deepEqual(relationshipPlacement(parentToChild, "EXP-parent"), { peerId: "EXP-child", side: "downstream" });
assert.deepEqual(relationshipPlacement(parentToChild, "EXP-child"), { peerId: "EXP-parent", side: "upstream" });
const mutualRelation = { sourceExperimentId: "EXP-a", targetExperimentId: "EXP-b", type: "互斥实验" };
assert.deepEqual(relationshipPlacement(mutualRelation, "EXP-b"), { peerId: "EXP-a", side: "downstream" });
const relationBlock = app.match(/const relationRecords: RelationshipRecord\[\] = \[([\s\S]*?)\n\];/);
assert.ok(relationBlock, "React review: relationship records must remain parseable for semantic checks");
const parentRelation = relationBlock[1].match(/\{ id: "REL-001", sourceExperimentId: "([^"]+)", targetExperimentId: "([^"]+)", type: "父实验"/);
assert.ok(parentRelation, "React review: parent-to-child relation fixture missing");
const storedParentRelation = { sourceExperimentId: parentRelation[1], targetExperimentId: parentRelation[2], type: "父实验" };
assert.equal(relationshipPlacement(storedParentRelation, storedParentRelation.sourceExperimentId)?.side, "downstream", "React review: focused stored parent must render child downstream");
assert.equal(relationshipPlacement(storedParentRelation, storedParentRelation.targetExperimentId)?.side, "upstream", "React review: focused stored child must render parent upstream");
assert.match(app, /function\s+relationshipPlacementForFocus\s*\(/, "React review: missing focused relationship direction helper");
assert.match(app, /record\.type\s*===\s*"互斥实验"/, "React review: mutual relationships must force downstream placement");
assert.match(app, /const relationshipPlacements = relatedRecords\.flatMap\([\s\S]*relationshipPlacementForFocus/, "React review: relationship map must derive placements from focused direction semantics");
assert.match(app, /peerId === focusedExperimentId/, "React review: relationship map must reject a focused experiment as its own peer");

// Context-to-page focus synchronization lives in one reusable function and is
// called by both route navigation and hash restoration.
assert.match(app, /function\s+syncContextPageFocus\s*\(/, "React review: missing shared context-to-page focus synchronizer");
assert.match(app, /syncContextPageFocus\(safeTab, nextContext\)/, "React review: route navigation must sync page focus");
assert.match(app, /syncContextPageFocus\(recovered\.tab as Tab, recoveredContext\)/, "React review: hash recovery must sync page focus");
assert.match(app, /setFocusedRelationshipId\(context\.experimentId\)/, "React review: lineage focus not synced from context");
assert.match(app, /setFocusedRolloutId\(context\.experimentId\)/, "React review: rollout focus not synced from context");
assert.match(app, /setCheckTarget\(\(current\) => \(\{ \.\.\.current, experimentId: context\.experimentId \}\)\)/, "React review: validation target not synced from context");

assert.match(app, /interface\s+RelationshipChangeEvent/, "React review: missing relationship change event model");
assert.match(app, /const\s+relationshipChangeEvents/, "React review: missing relationship change mock records");
assert.match(app, /change\.action/, "React review: change log must render action");
assert.match(app, /change\.operator/, "React review: change log must render operator");
assert.match(app, /change\.fieldDelta/, "React review: change log must render field delta");
assert.match(app, /function\s+getRolloutRiskReasons\s*\(/, "React review: missing derived rollout risk detector");
assert.match(app, /7 \* 24 \* 60 \* 60 \* 1000/, "React review: repeated rollout detector must use a seven-day window");
assert.match(app, /candidate\.time === event\.time[\s\S]*candidate\.operator === event\.operator\) return false/, "React review: repeated rollout detector must exclude its enriched current event");
assert.match(app, /riskReasons/, "React review: rollout UI must render derived risk reasons");
const parentRolloutBlock = app.match(/id: "EXP-240610-001"[\s\S]*?rolloutEvents: \[([\s\S]*?)\],\n\s+sourceQuality/);
assert.ok(parentRolloutBlock, "React review: focused rollout fixture missing");
const parentRollouts = [...parentRolloutBlock[1].matchAll(/\{ time: "([^"]+)", type: "([^"]+)", from: "([^"]+)", to: "([^"]+)", operator: "([^"]+)", reason: "([^"]*)"/g)]
  .map((match) => ({ time: match[1], type: match[2], from: match[3], to: match[4], operator: match[5], reason: match[6] }));
assert.ok(parentRollouts.length >= 2, "React review: rollout fixture must provide multiple events");
function rapidChangeReasons(events, event) {
  const currentTime = Date.parse(event.time.replace(" ", "T"));
  const neighbours = events.filter((candidate) => {
    if (candidate.time === event.time && candidate.type === event.type && candidate.from === event.from && candidate.to === event.to && candidate.operator === event.operator) return false;
    return Math.abs(Date.parse(candidate.time.replace(" ", "T")) - currentTime) <= 7 * 24 * 60 * 60 * 1000;
  });
  return neighbours.length ? [`7天内连续放量（相邻 ${neighbours.length} 次）`] : [];
}
assert.ok(rapidChangeReasons(parentRollouts, parentRollouts[0]).length > 0, "React review: mock events must exercise the seven-day repeated-rollout path");
assert.match(app, /drawer-investigation-actions[\s\S]*closeTopmostDrawer\(\);[\s\S]*investigationContext\?\.caseId/, "React review: detail primary investigation action must close the drawer before navigation");
assert.doesNotMatch(rawApp, /Legacy (relationship|rollout|monitoring) view retained/, "React review: legacy render bodies must be deleted, not commented out");
assert.doesNotMatch(rawApp, /\/\*[\s\S]*?Legacy[\s\S]*?\*\//, "React review: legacy block comments remain");

// Search results must not change a local focus and then enter a route whose
// active investigation context overwrites that focus. A different experiment
// stays in its detail drawer until the user explicitly starts/replaces a case.
const rolloutSearchBlock = app.match(/const rolloutResults =([\s\S]*?)const relationResults =/);
assert.ok(rolloutSearchBlock, "React review: rollout global-search results missing");
assert.match(rolloutSearchBlock[1], /investigationContext\?\.caseId && investigationContext\.experimentId === item\.id[\s\S]*navigateWithInvestigation\("rollout", "rollout"\)/, "React review: same-context rollout search must preserve the active investigation");
assert.match(rolloutSearchBlock[1], /else\s*\{\s*openDetail\(item\);\s*\}/, "React review: cross-experiment rollout search must open that experiment detail");
assert.doesNotMatch(rolloutSearchBlock[1], /setFocusedRolloutId\(item\.id\)[\s\S]{0,160}navigateToTab\("rollout"\)/, "React review: rollout search must not let contextual navigation overwrite a selected experiment");
const relationshipSearchBlock = app.match(/const relationResults =([\s\S]*?)const sourceResults =/);
assert.ok(relationshipSearchBlock, "React review: relationship global-search results missing");
assert.match(relationshipSearchBlock[1], /const relationExperiment = experiments\.find\(/, "React review: relationship search must resolve a concrete experiment");
assert.match(relationshipSearchBlock[1], /investigationContext\?\.caseId && \(investigationContext\.experimentId === record\.sourceExperimentId \|\| investigationContext\.experimentId === record\.targetExperimentId\)[\s\S]*navigateWithInvestigation\("lineage", "relationship"\)/, "React review: matching relationship context must retain its focused experiment");
assert.match(relationshipSearchBlock[1], /else\s*\{\s*openDetail\(relationExperiment \?\? null\);\s*\}/, "React review: cross-experiment relationship search must open a concrete detail drawer");
assert.doesNotMatch(relationshipSearchBlock[1], /action:\s*\(\) => navigateToTab\("lineage"\)/, "React review: relationship search must not navigate generically without an experiment binding");
assert.match(css, /@media \(max-width: 1180px\)[\s\S]*\.relationship-map/, "CSS review: 1180 relationship map reflow missing");
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.monitor-queue-columns/, "CSS review: mobile monitor queue reflow missing");
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.rollout-timeline-event/, "CSS review: mobile rollout timeline reflow missing");
assert.match(css, /@media \(max-width: 480px\)/, "CSS review: compact mobile workbench treatment missing");

// Task 5: accessibility and compact-device contract. Source checks strip
// comments first so retired code cannot satisfy the implementation contract.
assert.match(app, /previousFocusRef/, "Task 5: drawers must retain their opening focus");
assert.match(app, /activeDrawer/, "Task 5: drawer stack must identify the active overlay");
assert.match(app, /from "\.\/drawer\.mjs"/, "Task 5: App must consume the pure drawer behavior module");
assert.match(app, /pushDrawer\(current, drawer\)/, "Task 5: drawer opens must use immutable stack semantics");
assert.match(app, /const result = popDrawer\(drawerStack\)/, "Task 5: drawer close must use immutable stack semantics");
assert.match(app, /role="dialog"/, "Task 5: drawers must expose dialog semantics");
assert.match(app, /aria-modal="true"/, "Task 5: drawers must be modal");
assert.match(app, /aria-labelledby="detail-drawer-title"/, "Task 5: detail drawer needs a stable title reference");
assert.match(app, /aria-labelledby="help-drawer-title"/, "Task 5: help drawer needs a stable title reference");
assert.match(app, /aria-labelledby="import-drawer-title"/, "Task 5: import drawer needs a stable title reference");
assert.match(app, /id="detail-drawer-title"/, "Task 5: detail title id missing");
assert.match(app, /id="help-drawer-title"/, "Task 5: help title id missing");
assert.match(app, /id="import-drawer-title"/, "Task 5: import title id missing");
assert.match(app, /inert=\{hasOpenDrawer \|\| undefined\}/, "Task 5: background must be inert while a drawer is open");
assert.match(app, /function\s+closeTopmostDrawer\s*\(/, "Task 5: topmost drawer close helper missing");
assert.match(app, /if \(activeDrawer\)\s*\{\s*closeTopmostDrawer\(\);/, "Task 5: Escape must close only the topmost drawer");
assert.match(app, /function\s+trapDrawerFocus\s*\(/, "Task 5: drawer focus trap missing");
assert.match(app, /event\.key !== "Tab"\) return;/, "Task 5: focus trap must handle Tab traversal");
assert.match(app, /getFocusTrapTarget\(focusable\.length, activeIndex, event\.shiftKey\)/, "Task 5: trap must consume the tested boundary helper");
assert.match(app, /scheduleFocus\(activeDrawerCloseRef\.current\)/, "Task 5: opened drawer must focus its close control");
assert.match(app, /target\?\.isConnected && !target\.closest\("\[inert\]"\)/, "Task 5: restored focus must reject disconnected or inert targets");
assert.match(app, /\[activeNavRef\.current, searchInputRef\.current, heading\]/, "Task 5: focus restoration needs deterministic fallbacks");
assert.match(app, /window\.requestAnimationFrame/, "Task 5: focus restoration must wait for inert removal");
assert.match(app, /window\.cancelAnimationFrame/, "Task 5: focus restoration frame must be cleaned up");
assert.match(app, /const previousOverflow = body\.style\.overflow;/, "Task 5: scroll lock must preserve body overflow");
assert.match(app, /const previousPaddingRight = body\.style\.paddingRight;/, "Task 5: scroll lock must preserve body padding");
assert.match(app, /const scrollbarWidth = Math\.max\(0, window\.innerWidth - document\.documentElement\.clientWidth\)/, "Task 5: scroll lock must compensate scrollbar width");
assert.match(app, /body\.style\.overflow = "hidden";/, "Task 5: drawers must lock background scrolling");
assert.match(app, /body\.style\.paddingRight = previousPaddingRight;/, "Task 5: scroll lock must clean up after close or unmount");
assert.match(app, /<X\s+size=\{18\}/, "Task 5: close controls must use the lucide X icon");
assert.match(app, /aria-label="全局搜索实验、Seed 和放量事件"/, "Task 5: global search needs a useful accessible name");
assert.match(app, /aria-label=\{`导入批次 \$\{batch\.id\} 第 \$\{issue\.row\} 行的处理决策`\}/, "Task 5: import review selects need row-specific labels");
assert.match(app, /aria-label=\{`导入预检第 \$\{row\.row\} 行状态：\$\{row\.level\}`\}/, "Task 5: import precheck statuses need semantic labels");
assert.match(app, /<button disabled aria-label="上一页">/, "Task 5: icon-only previous pagination control needs a name");
assert.match(app, /status-dot[\s\S]*aria-label=\{`实验状态：\$\{statusText\[item\.status\]\}`\}/, "Task 5: experiment status must have a semantic label");
assert.match(app, /activeNavRef\.current\?\.scrollIntoView\(/, "Task 5: active mobile nav must scroll into view");
assert.match(app, /prefers-reduced-motion: reduce/, "Task 5: nav scrolling must respect reduced motion");
assert.match(css, /--text-3:\s*#5f6b7a/i, "Task 5: text contrast token must be upgraded");
assert.match(css, /--success-text:\s*#0b7a2a/i, "Task 5: success text token missing");
assert.match(css, /--warning-text:\s*#a64b00/i, "Task 5: warning text token missing");
assert.match(css, /--danger-text:\s*#c62828/i, "Task 5: danger text token missing");
assert.match(css, /\.quality-badge\.passed\s*\{[\s\S]*color:\s*var\(--success-text\)/, "Task 5: success badge needs deep foreground text");
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.nav-item[\s\S]*min-height:\s*44px/, "Task 5: mobile nav needs a 44px touch target");
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.row-actions button[\s\S]*min-height:\s*44px/, "Task 5: mobile row actions need a 44px touch target");
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.circle-button,[\s\S]*\.quick-search-trigger\s*\{[\s\S]*min-width:\s*44px/, "Task 5: mobile icon-only controls need a 44px width");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*, \*::before, \*::after\s*\{/, "Task 5: reduced motion must cover pseudo-elements");
assert.match(css, /\.rollout-table-wrap/, "Task 5: rollout table needs an isolated overflow boundary");

// Task 6: direct-open static artifact must be generated from the React source,
// not maintained as a second hand-written DOM/JS implementation.
const expectedStaticFingerprint = computeStaticFingerprint();
const fingerprintMatch = dist.match(/<meta\s+name=["']experiment-static-fingerprint["']\s+content=["']([a-f0-9]{64})["']\s*\/?\s*>/i);
assert.equal(fingerprintMatch?.[1], expectedStaticFingerprint, "static: generated fingerprint must match the canonical React sources");
assert.match(dist, /<html\s+lang=["']zh-CN["']/i, "static: document language missing");
assert.match(dist, /<meta\s+name=["']viewport["']/i, "static: viewport metadata missing");
assert.match(dist, /<title>实验资产中心<\/title>/, "static: document title missing");
assert.match(dist, /<div\s+id=["']root["']><\/div>/, "static: React root missing");

const staticStyles = extractStaticAsset(dist, "style");
const staticScripts = extractStaticAsset(dist, "script");
assert.equal(staticStyles.length, 1, "static: exactly one inline style is required");
assert.equal(staticScripts.length, 1, "static: exactly one classic inline script is required");
assert.ok(staticScripts.every((script) => !/\bsrc\s*=/i.test(script.attributes) && !/\btype\s*=\s*["']module["']/i.test(script.attributes)), "static: scripts cannot reference external or module assets");
const documentMarkup = dist
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
assert.doesNotMatch(documentMarkup, /<link\b[^>]*\brel\s*=\s*["']stylesheet["']/i, "static: styles cannot reference external assets");
const staticAssetTags = [...documentMarkup.matchAll(/<(?:script|link)\b([^>]*)>/gi)];
assert.ok(staticAssetTags.every((tag) => !/\b(?:src|href)\s*=\s*["'](?:https?:|[^"']+\.(?:js|css)(?:[?#][^"']*)?)["']/i.test(tag[1])), "static: HTML asset tags cannot reference external JS/CSS");

const staticJs = staticScripts[0].content;
const staticCss = staticStyles[0].content;
for (const token of [
  "startInvestigation",
  "navigateWithInvestigation",
  "updateInvestigationStatus",
  "experiment-asset-investigation-v1",
  "investigating",
  "resolved",
  "pushDrawer",
  "popDrawer",
  "data-start-investigation",
  "data-investigation-status",
  "data-evidence-focus",
  "data-relationship-node",
  "data-rollout-event",
  "role",
  "dialog",
  "inert",
  "实验评估",
  "Seed 评估",
  "运行中监控排查",
  "放量历史",
  "本地演示状态，不写入生产系统",
]) {
  assert.ok(staticJs.includes(token), `static: bundled JS missing ${token}`);
}
assert.match(staticCss, /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/, "static: bundled CSS missing reduced-motion support");
for (const token of ["--success-text", "--warning-text", "--danger-text"]) {
  assert.ok(staticCss.includes(token), `static: bundled CSS missing ${token}`);
}
assert.doesNotThrow(() => new Function(staticJs), "static: inline classic script must compile");

// Task 6 review hardening: the direct-open artifact must use the production
// React runtime, and default package commands may not replace it with Vite's
// external-asset output.
assert.doesNotMatch(staticJs, /react\/cjs\/react\.development\.js/i, "static: production artifact cannot contain react.development.js");
assert.doesNotMatch(staticJs, /React does not recognize the [`']%s[`'] prop/i, "static: production artifact cannot contain React development warnings");
assert.match(staticJs, /react\/cjs\/react\.production\.js/i, "static: production artifact must include the React production runtime");
assert.match(staticBuilder, /define:\s*\{\s*["']process\.env\.NODE_ENV["']:\s*["']\\"production\\"["']\s*\}/, "static: esbuild must select the production React runtime");
assert.match(staticBuilder, /outputFiles\.length !== 2/, "static: generator must reject extra esbuild outputs");
assert.match(staticBuilder, /jsOutputs\.length !== 1 \|\| cssOutputs\.length !== 1/, "static: generator must require exactly one JS and one CSS output");
assert.match(staticBuilder, /fs\.writeFileSync\(tempFile, html, "utf8"\)/, "static: generator must stage a same-directory temporary file");
assert.match(staticBuilder, /fs\.renameSync\(tempFile, distFile\)/, "static: generator must atomically replace the final artifact");
assert.match(staticBuilder, /finally\s*\{[\s\S]*fs\.existsSync\(tempFile\)/, "static: temporary build files must be cleaned up");
assert.throws(() => classifyOutputs([]), /exactly two outputs/, "static: output classification must reject missing outputs");
assert.throws(() => classifyOutputs([{ path: "app.js", contents: new Uint8Array() }, { path: "app.css", contents: new Uint8Array() }, { path: "extra.txt", contents: new Uint8Array() }]), /exactly two outputs/, "static: output classification must reject extra outputs");
assert.throws(() => classifyOutputs([{ path: "app.js", contents: new Uint8Array() }, { path: "extra.js", contents: new Uint8Array() }]), /exactly one JavaScript bundle and one CSS bundle/, "static: output classification must reject duplicate output types");
assert.deepEqual(
  classifyOutputs([{ path: "app.js", contents: Buffer.from("window.app=true") }, { path: "app.css", contents: Buffer.from("body{}") }]),
  { script: "window.app=true", style: "body{}" },
  "static: output classification must return the canonical JS and CSS bundles",
);
assert.ok(packageManifest.devDependencies?.esbuild?.includes("0.25.12"), "static: esbuild must be a direct development dependency");
assert.equal(packageManifest.scripts.build, "tsc -b && node scripts/build-static.mjs", "package: default build must preserve the direct-open static artifact");
assert.equal(packageManifest.scripts["build:web"], "tsc -b && vite build --outDir build --emptyOutDir", "package: web build must have a separate output directory");
assert.doesNotMatch(packageManifest.scripts.build, /vite\s+build/i, "package: default build cannot run Vite");

console.log("Investigation closure verification passed.");
