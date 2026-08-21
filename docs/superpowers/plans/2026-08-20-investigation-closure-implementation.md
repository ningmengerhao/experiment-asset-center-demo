# 实验资产中心排查闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将监控告警、实验详情、父子关系、Seed/放量事件、校验结果和处置状态连接成可恢复的排查闭环，并补齐生产可信度审计发现的无障碍、移动端和验证缺口。

**Architecture:** 新增独立的 `src/investigation.mjs` 纯逻辑模块和同名类型声明，负责 hash、上下文、证据排序和状态流；React 页面与静态 HTML 共享同一套接口约定但分别渲染。页面继续保留当前单页结构，本轮只把新增逻辑和类型从 `App.tsx` 中拆出，避免无关的大规模重构。

**Tech Stack:** React 19、TypeScript 5、Vite 6、Lucide React、原生 HTML/CSS/JavaScript、Node.js 内置测试与无依赖 CDP 浏览器验证。

## Global Constraints

- 用户直接打开 `dist/index.html`，因此 React 源码、CSS 与静态 HTML 必须同步。
- 不接真实后端、权限服务、统计引擎或业务平台写操作。
- 本地处理动作必须明确为演示状态，不伪装成生产写入成功。
- 继续使用 Arco/Semi 风格、现有主色与中文字体栈，不重做首页视觉基调。
- 普通用户主导航不暴露管理员治理与权限入口。
- 390、585、1366 宽度不得出现页面级横向溢出。
- 改造前后使用 `history/YYYY-MM-DD-before-*` 与 `history/YYYY-MM-DD-after-*` 快照，不自动创建 Git commit。
- 所有保留按钮必须产生切页、状态变化、抽屉、toast 或 disabled 反馈。

---

### Task 1: 建立改造基线和失败验收

**Files:**
- Create: `history/2026-08-20-before-investigation-closure/`
- Modify: `scripts/verify-ui.mjs`
- Create: `scripts/verify-investigation.mjs`

**Interfaces:**
- Consumes: 当前 `src/App.tsx`、`src/styles.css`、`dist/index.html`。
- Produces: 可独立失败的功能验收和改造前快照。

- [ ] **Step 1: 创建改造前快照**

复制以下文件到 `history/2026-08-20-before-investigation-closure/`：

```text
src/App.tsx -> App.tsx
src/styles.css -> styles.css
dist/index.html -> index.html
scripts/verify-ui.mjs -> verify-ui.mjs
README.md -> README.project.md
CHANGELOG.md -> CHANGELOG.md
PRODUCT.md -> PRODUCT.md
history/README.md -> HISTORY.README.md
```

- [ ] **Step 2: 先写失败的排查闭环验收**

在 `scripts/verify-investigation.mjs` 中分别读取源码和静态 HTML，建立如下断言：

```js
import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("src/App.tsx", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const dist = fs.readFileSync("dist/index.html", "utf8");

for (const [name, source] of [["React", app], ["static", dist]]) {
  assert.match(source, /InvestigationContext/, `${name}: missing investigation context`);
  assert.match(source, /开始排查|继续排查/, `${name}: missing investigation entry`);
  assert.match(source, /统一证据时间线/, `${name}: missing evidence timeline`);
  assert.match(source, /排查中.*待协同.*已定位.*已关闭/s, `${name}: missing resolution states`);
  assert.match(source, /关系变更记录/, `${name}: missing relationship audit`);
}

assert.match(css, /prefers-reduced-motion:\s*reduce/, "missing reduced motion support");
assert.match(app, /role="dialog"/);
assert.match(dist, /role="dialog"/);
```

- [ ] **Step 3: 运行验收并确认失败**

Run: `node scripts/verify-investigation.mjs`

Expected: FAIL，第一项缺失应为 `missing investigation context` 或 `missing evidence timeline`。

- [ ] **Step 4: 将旧验证拆成按文件检查**

在 `scripts/verify-ui.mjs` 中保留现有 67 项，但将 `all = app + css + dist + product` 改为显式的 `checkReact`、`checkStatic`、`checkCss`：

```js
function expectIncludes(sourceName, source, token) {
  return [`${sourceName} includes ${token}`, source.includes(token)];
}

const checks = [
  expectIncludes("React", app, "navigateToTab"),
  expectIncludes("static", dist, "navigateToTab"),
  expectIncludes("CSS", css, ".stage-step:focus-visible"),
];
```

不得让 `dist` 中的字符串替 `App.tsx` 通过验收，或反过来。

- [ ] **Step 5: 运行旧验证并记录真实基线**

Run: `npm run verify:ui`

Expected: 旧功能项通过；新增的闭环验收继续失败，证明测试能够区分新旧版本。

---

### Task 2: 实现共享排查上下文与纯逻辑

**Files:**
- Create: `src/investigation.mjs`
- Create: `src/investigation.d.ts`
- Create: `scripts/test-investigation.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `parseInvestigationLocation(hash: string): { tab: string; context: InvestigationContext | null }`
  - `buildInvestigationHash(tab: string, context?: InvestigationContext | null): string`
  - `mergeEvidenceEvents(events: EvidenceEvent[]): EvidenceEvent[]`
  - `transitionInvestigation(context: InvestigationContext, next: InvestigationStatus, note: string): InvestigationContext`
  - `loadInvestigationContext(storage?: Storage): InvestigationContext | null`
  - `saveInvestigationContext(context: InvestigationContext | null, storage?: Storage): void`

- [ ] **Step 1: 写纯逻辑失败测试**

创建 `scripts/test-investigation.mjs`：

```js
import assert from "node:assert/strict";
import {
  buildInvestigationHash,
  mergeEvidenceEvents,
  parseInvestigationLocation,
  transitionInvestigation,
} from "../src/investigation.mjs";

const context = {
  caseId: "CASE-240820-001",
  experimentId: "EXP-240611-017",
  alertId: "ALT-003",
  timeRange: "14d",
  entrySource: "monitor",
  evidenceFocus: "rollout",
  status: "investigating",
  owner: "赵晨",
  collaborators: ["陈露"],
  resolution: "",
  updatedAt: "2026-08-20 10:30",
  actions: [],
};

const hash = buildInvestigationHash("investigate", context);
assert.equal(hash, "#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=rollout");
assert.equal(parseInvestigationLocation(hash).context.experimentId, context.experimentId);
assert.equal(parseInvestigationLocation("#invalid-route").tab, "evaluate");

assert.deepEqual(
  mergeEvidenceEvents([
    { id: "2", occurredAt: "2026-08-19 10:00" },
    { id: "1", occurredAt: "2026-08-20 10:00" },
    { id: "1", occurredAt: "2026-08-20 10:00" },
  ]).map((item) => item.id),
  ["1", "2"],
);

assert.equal(transitionInvestigation(context, "resolved", "已定位到放量变更").status, "resolved");
assert.throws(() => transitionInvestigation(context, "closed", "跳过定位"), /invalid transition/);
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run: `node scripts/test-investigation.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现纯逻辑模块**

`src/investigation.mjs` 使用以下状态映射：

```js
export const INVESTIGATION_STORAGE_KEY = "experiment-asset-investigation-v1";

export const allowedTransitions = {
  idle: ["investigating"],
  investigating: ["collaborating", "resolved"],
  collaborating: ["investigating", "resolved"],
  resolved: ["investigating", "closed"],
  closed: [],
};
```

`parseInvestigationLocation` 仅接受现有普通用户和管理员 tab；非法 tab 返回 `{ tab: "evaluate", context: null }`。查询参数仅解析 `experiment`、`alert`、`range` 和 `focus`，禁止把任意字符串直接写入页面 HTML。

- [ ] **Step 4: 添加 TypeScript 类型声明**

在 `src/investigation.d.ts` 定义：

```ts
export type InvestigationStatus = "idle" | "investigating" | "collaborating" | "resolved" | "closed";
export type EvidenceFocus = "overview" | "relationship" | "rollout" | "seed" | "validation" | "metric";

export interface ResolutionAction {
  id: string;
  from: InvestigationStatus;
  to: InvestigationStatus;
  operator: string;
  note: string;
  occurredAt: string;
}

export interface InvestigationContext {
  caseId: string;
  experimentId: string;
  alertId?: string;
  timeRange: "7d" | "14d" | "30d";
  entrySource: "monitor" | "list" | "relationship" | "rollout" | "validation" | "detail";
  evidenceFocus: EvidenceFocus;
  status: InvestigationStatus;
  owner: string;
  collaborators: string[];
  resolution: string;
  updatedAt: string;
  actions: ResolutionAction[];
}

export interface EvidenceEvent {
  id: string;
  experimentId: string;
  occurredAt: string;
  type: "alert" | "rollout" | "seed" | "relationship" | "validation" | "audit";
  title: string;
  summary: string;
  sourcePlatform: string;
  operator: string;
  severity: "info" | "warning" | "critical";
  requiresAction: boolean;
}
```

- [ ] **Step 5: 添加验证命令并运行**

在 `package.json` 增加：

```json
"verify:logic": "node scripts/test-investigation.mjs"
```

Run: `npm run verify:logic`

Expected: PASS，输出 `Investigation logic verification passed.`。

---

### Task 3: React 中接入上下文、URL 与处理状态流

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `scripts/verify-investigation.mjs`

**Interfaces:**
- Consumes: Task 2 的 hash、存储、证据与状态转换函数。
- Produces:
  - `startInvestigation(experimentId, options)`
  - `navigateWithInvestigation(tab, focus)`
  - `updateInvestigationStatus(nextStatus, note)`
  - 页面级 `investigationContext` 与 `evidenceTimeline`。

- [ ] **Step 1: 扩充失败验收**

在 `scripts/verify-investigation.mjs` 增加：

```js
assert.match(app, /function startInvestigation/);
assert.match(app, /function navigateWithInvestigation/);
assert.match(app, /function updateInvestigationStatus/);
assert.match(app, /saveInvestigationContext/);
assert.match(app, /buildInvestigationHash/);
assert.match(app, /sessionStorage/);
```

- [ ] **Step 2: 运行并确认失败**

Run: `node scripts/verify-investigation.mjs`

Expected: FAIL at `function startInvestigation`。

- [ ] **Step 3: 增加上下文状态和安全恢复**

在 `App` 初始化中读取 `parseInvestigationLocation(window.location.hash)` 和 `loadInvestigationContext(window.sessionStorage)`。恢复顺序为 URL 参数优先、sessionStorage 补充、无数据时为 `null`。

`navigateToTab` 改为接收可选上下文：

```ts
function navigateToTab(nextTab: Tab, options: { replace?: boolean; context?: InvestigationContext | null } = {}) {
  const safeTab = adminTabs.has(nextTab) && roleView !== "admin" ? "evaluate" : nextTab;
  const nextContext = options.context === undefined ? investigationContext : options.context;
  setActiveTab(safeTab);
  window.history[options.replace ? "replaceState" : "pushState"](
    null,
    "",
    buildInvestigationHash(safeTab, nextContext),
  );
}
```

- [ ] **Step 4: 实现开始排查和状态变化**

`startInvestigation` 根据实验和告警生成 `CASE-YYMMDD-NNN`，状态设为 `investigating`，保存 sessionStorage，切换到监控排查并 toast“已建立本地排查上下文”。

`updateInvestigationStatus` 必须调用 `transitionInvestigation`；非法流转显示错误 toast，不静默跳过。关闭状态前要求 `resolution.trim().length >= 6`。

- [ ] **Step 5: 增加全局排查上下文条**

在 breadcrumb 下方渲染 `.investigation-context-bar`，只在上下文存在时显示：编号、主实验、时间范围、状态、负责人，以及“查看证据”“结束本地排查”。窄屏改为两行，不使用浮动卡片。

- [ ] **Step 6: 运行逻辑与结构验收**

Run: `npm run verify:logic && node scripts/verify-investigation.mjs`

Expected: PASS 到页面深度相关检查之前。

---

### Task 4: 做实监控、父子关系、放量历史和详情证据链

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `scripts/verify-investigation.mjs`

**Interfaces:**
- Consumes: `investigationContext`、`EvidenceEvent[]`、`navigateWithInvestigation`。
- Produces: 四个共享同一排查对象的专业视图。

- [ ] **Step 1: 写页面深度失败验收**

```js
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
  assert.ok(app.includes(token), `React missing ${token}`);
}
```

- [ ] **Step 2: 运行并确认失败**

Run: `node scripts/verify-investigation.mjs`

Expected: FAIL at the first missing page token。

- [ ] **Step 3: 重构监控排查页**

将四个同构指标卡压缩为单行状态摘要。异常队列每条包含严重度、实验、指标、最近变更、负责人和按钮：

```tsx
<button type="button" onClick={() => startInvestigation(alert.experimentId, { alertId: alert.id, focus: "metric" })}>
  {investigationContext?.alertId === alert.id ? "继续排查" : "开始排查"}
</button>
```

“问题类型”改为真实多选筛选，使用 checkbox，筛选结果数量实时更新。

- [ ] **Step 4: 重构父子实验页**

使用三段式 DOM 关系视图，不引入图形库：

```tsx
<div className="relationship-map" aria-label="实验关系链路">
  <RelationshipColumn title="上游与父实验" records={upstreamRelations} />
  <RelationshipNode title="当前实验" experiment={focusedExperiment} current />
  <RelationshipColumn title="下游与互斥实验" records={downstreamRelations} />
</div>
```

关系节点必须展示状态、来源平台、放量、关系类型和风险；下方保留完整关系表与“关系变更记录”。风险记录的“加入排查”调用 `navigateWithInvestigation("investigate", "relationship")`。

- [ ] **Step 5: 重构放量历史页**

将筛选器置于紧凑顶部；排查上下文存在时默认聚焦当前实验。首屏展示 `.rollout-timeline`，事件包含前后放量、时间、操作人、平台、原因和风险。聚焦状态显示“返回全部放量”，全局状态显示“聚焦当前实验”。

异常事件的“加入排查”设置 `evidenceFocus: "rollout"`，无原因事件明确显示“原因缺失”，不使用空字符串。

- [ ] **Step 6: 增强实验详情抽屉**

在详情摘要后增加“开始排查/继续排查”；在详情底部显示当前实验最近 5 条统一证据，并提供关系、放量、校验聚焦跳转。跳转时关闭抽屉并保留排查上下文。

- [ ] **Step 7: 运行闭环结构验收**

Run: `node scripts/verify-investigation.mjs`

Expected: React 页面深度检查全部通过，静态 HTML 同步检查仍失败。

---

### Task 5: 修复无障碍、颜色和移动端行为

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Test: `scripts/verify-investigation.mjs`

**Interfaces:**
- Produces: `AccessibleDrawer` 行为约定、焦点恢复、移动当前导航定位和 AA 状态色。

- [ ] **Step 1: 写失败验收**

```js
assert.match(app, /aria-modal="true"/);
assert.match(app, /aria-labelledby=/);
assert.match(app, /previousFocusRef/);
assert.match(app, /scrollIntoView/);
assert.match(css, /--text-3:\s*#[0-9A-F]{6}/i);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /min-height:\s*44px/);
```

- [ ] **Step 2: 运行并确认失败**

Run: `node scripts/verify-investigation.mjs`

Expected: FAIL at dialog semantics or focus restoration。

- [ ] **Step 3: 修复抽屉焦点**

打开详情、帮助、导入抽屉前保存 `document.activeElement`；抽屉挂载后聚焦关闭按钮；关闭后恢复焦点。抽屉增加：

```tsx
<aside role="dialog" aria-modal="true" aria-labelledby="detail-drawer-title">
```

抽屉打开时为 `.workspace` 和 `.sidebar` 设置 `inert`；只关闭最上层浮层。

- [ ] **Step 4: 修复表单名称和状态语义**

全局搜索增加 `aria-label="全局搜索实验、Seed 和放量事件"`；表格内 select 使用包含批次或行号的 `aria-label`。成功、警告、危险状态同时显示图标或文字，不只依赖颜色。

- [ ] **Step 5: 调整对比度 token**

将小字号正文 token 调整为至少 4.5:1：

```css
:root {
  --text-3: #5f6b7a;
  --success-text: #0b7a2a;
  --warning-text: #a64b00;
  --danger-text: #c62828;
}
```

状态背景继续使用浅色 token，文字改用上述深色 token。

- [ ] **Step 6: 修复移动端导航和触控目标**

active tab 或 hash 变化后执行：

```ts
activeNavRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
```

导航项、按钮、分页和表格行操作在 `max-width: 760px` 下 `min-height: 44px`。父子关系改为纵向分组，放量表格在移动端隐藏并显示事件列表。

- [ ] **Step 7: 增加 reduced motion**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 8: 运行无障碍结构验收**

Run: `node scripts/verify-investigation.mjs`

Expected: React、CSS 检查通过；静态 HTML 检查仍指出未同步项。

---

### Task 6: 同步静态 HTML 等价功能

**Files:**
- Modify: `dist/index.html`
- Test: `scripts/verify-investigation.mjs`

**Interfaces:**
- Consumes: Tasks 2-5 已确认的接口、文案和状态。
- Produces: `file://` 直接打开时等价的排查闭环、焦点、移动端与状态流。

- [ ] **Step 1: 在静态 HTML 中加入同名数据结构和函数**

内联脚本必须实现：

```js
let investigationContext = loadInvestigationContext();
function startInvestigation(experimentId, options = {}) {
  const experiment = experiments.find((item) => item.id === experimentId);
  if (!experiment) {
    showToast("未找到实验，无法开始排查");
    return;
  }
  investigationContext = {
    caseId: `CASE-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-001`,
    experimentId,
    alertId: options.alertId || "",
    timeRange: options.timeRange || "14d",
    entrySource: options.entrySource || "monitor",
    evidenceFocus: options.focus || "overview",
    status: "investigating",
    owner: experiment.owner,
    collaborators: [],
    resolution: "",
    updatedAt: formatDateTime(new Date()),
    actions: [],
  };
  saveInvestigationContext(investigationContext);
  renderInvestigationContext();
  navigateToTab("investigate", { context: investigationContext });
  showToast("已建立本地排查上下文");
}

function navigateWithInvestigation(tab, focus) {
  if (!investigationContext) {
    showToast("请先选择异常或实验开始排查");
    return;
  }
  investigationContext = { ...investigationContext, evidenceFocus: focus, updatedAt: formatDateTime(new Date()) };
  saveInvestigationContext(investigationContext);
  navigateToTab(tab, { context: investigationContext });
}

function updateInvestigationStatus(nextStatus, note) {
  try {
    investigationContext = transitionInvestigation(investigationContext, nextStatus, note);
    saveInvestigationContext(investigationContext);
    renderInvestigationContext();
    showToast(`排查状态已更新为：${statusText[nextStatus]}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "排查状态更新失败");
  }
}

function renderInvestigationContext() {
  const bar = document.getElementById("investigationContextBar");
  if (!bar) return;
  bar.hidden = !investigationContext;
  if (!investigationContext) return;
  bar.querySelector("[data-case-id]").textContent = investigationContext.caseId;
  bar.querySelector("[data-case-experiment]").textContent = investigationContext.experimentId;
  bar.querySelector("[data-case-status]").textContent = statusText[investigationContext.status];
  bar.querySelector("[data-case-owner]").textContent = investigationContext.owner;
}

function renderEvidenceTimeline(experimentId) {
  return mergeEvidenceEvents(evidenceEvents.filter((event) => event.experimentId === experimentId))
    .map((event) => `
      <li class="evidence-event ${event.severity}">
        <time>${escapeHtml(event.occurredAt)}</time>
        <strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.summary)}</span>
        <small>${escapeHtml(event.sourcePlatform)} · ${escapeHtml(event.operator)}</small>
      </li>`)
    .join("");
}
```

hash 格式、状态值和存储 key 必须与 `src/investigation.mjs` 一致。

- [ ] **Step 2: 同步四个核心页面**

静态页面加入与 React 一致的文案和 `data-*` 钩子：

```text
data-start-investigation
data-investigation-status
data-evidence-focus
data-relationship-node
data-rollout-event
```

事件委托统一处理按钮，禁止为每个 mock 行创建互相覆盖的全局函数。

- [ ] **Step 3: 同步抽屉和移动端行为**

静态抽屉加入 dialog 语义、焦点保存/恢复和背景 inert；切换 tab 后将 `.nav-item.active` 滚动到可见区域。

- [ ] **Step 4: 运行静态验收**

Run: `node scripts/verify-investigation.mjs`

Expected: `Investigation closure verification passed.`。

- [ ] **Step 5: 检查 inline script 语法**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); const scripts=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); scripts.forEach((script)=>new Function(script)); console.log('inline script syntax ok')"
```

Expected: `inline script syntax ok`。

---

### Task 7: 增加真实浏览器回归测试

**Files:**
- Create: `scripts/verify-browser.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-ui.mjs`

**Interfaces:**
- Produces: 不依赖项目 node_modules 的 Windows Edge CDP smoke test。

- [ ] **Step 1: 编写失败的浏览器测试**

`scripts/verify-browser.mjs` 启动系统 Edge headless 和临时 remote debugging port，通过 Node 24 全局 `WebSocket` 连接 CDP。测试必须覆盖：

```js
await openFile("dist/index.html#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d");
await expectText("当前排查");
await clickText("查看关系");
await expectHashStartsWith("#lineage?experiment=EXP-240611-017");
await goBack();
await expectText("ALT-003");
await openAndCloseDrawerWithEscape("帮助文档");
await assertFocusRestored("#headerHelpButton");
await openFile("dist/index.html#invalid-route");
await expectHash("#evaluate");
```

三档视口遍历所有普通用户页面，并断言：

```js
Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1
```

390px 下还要断言 `.nav-item.active` 与 `.sidebar-nav` 的矩形相交。

- [ ] **Step 2: 运行并确认至少一个新行为失败**

Run: `node scripts/verify-browser.mjs`

Expected: 在 Task 6 完成前应失败；若 Task 6 已完成，临时把测试目标指向改造前快照确认失败后再恢复。

- [ ] **Step 3: 完成 CDP 生命周期和断言输出**

脚本必须在 `finally` 中关闭浏览器进程和临时用户目录；输出每项视口、页面和交互结果，失败时返回非零退出码。

- [ ] **Step 4: 添加 npm 命令**

```json
"verify:browser": "node scripts/verify-browser.mjs",
"verify:all": "npm run verify:logic && npm run verify:ui && node scripts/verify-investigation.mjs && npm run verify:browser"
```

- [ ] **Step 5: 运行完整验证**

Run: `npm run verify:all`

Expected: 所有逻辑、结构和浏览器测试通过，控制台错误为 0。

---

### Task 8: 视觉复核、文档与改造后快照

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `history/README.md`
- Create: `history/2026-08-20-after-investigation-closure/`
- Create: `dist/ui-check-investigation-*.png`

**Interfaces:**
- Consumes: 完成的 React、静态 HTML、CSS 和验证脚本。
- Produces: 可复现版本和关键视图证据。

- [ ] **Step 1: 生成关键截图**

使用 `scripts/verify-browser.mjs --screenshots` 生成：

```text
dist/ui-check-investigation-monitor.png
dist/ui-check-investigation-lineage.png
dist/ui-check-investigation-rollout.png
dist/ui-check-investigation-detail.png
dist/ui-check-investigation-mobile.png
```

视口至少覆盖 1366x768 和 390x844。

- [ ] **Step 2: 人工检查截图**

检查：当前排查对象始终可见、关系方向明确、时间线优先于空白面板、状态与按钮可区分、移动导航当前项可见、文字不重叠。

- [ ] **Step 3: 运行 detector**

Run:

```bash
node <IMPECCABLE_SKILL_DIR>/scripts/detect.mjs --json dist/index.html src/App.tsx src/styles.css
```

Expected: 无 side-tab、layout-transition、nested-card 等实质问题；业务 ID 造成的 numbered marker 误报记录在 CHANGELOG，不作为失败。

- [ ] **Step 4: 更新文档**

README 记录新入口、排查 hash 示例和 `npm run verify:all`；CHANGELOG 记录功能闭环、无障碍、移动端和验证变化；history 索引记录 before/after 快照。

- [ ] **Step 5: 创建改造后快照**

复制 Tasks 1 快照中的全部文件，并补充：

```text
src/investigation.mjs
src/investigation.d.ts
scripts/test-investigation.mjs
scripts/verify-investigation.mjs
scripts/verify-browser.mjs
dist/ui-check-investigation-*.png
```

- [ ] **Step 6: 最终验证**

Run:

```bash
npm run verify:all
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m)=>new Function(m[1])); console.log('inline script syntax ok')"
```

Expected: 全部命令退出码为 0；浏览器测试覆盖 1366、585、390；生成的五张截图非空。
