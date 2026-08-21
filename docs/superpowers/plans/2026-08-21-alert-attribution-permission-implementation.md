# 告警、跨实验归因与权限管理 Implementation Plan

> **For agentic workers:** Inline execution only. The user explicitly requested no subagents.

**Goal:** 快速交付可操作的告警规则、跨实验异常归因、权限管理，并去除 Seed 与上线前检查的重复职责。

**Architecture:** 在 `src/monitoring.mjs` 放置可测试的规则校验、归因评分和权限判断；`src/App.tsx` 负责页面状态与交互；`src/styles.css` 提供后台工作台布局；`scripts/verify-ui.mjs` 与 `scripts/verify-browser.mjs` 负责结构和真实交互回归。

**Tech Stack:** React 19、TypeScript、原生 ES modules、CSS、Edge CDP、esbuild 单文件构建。

## Global Constraints

- 不引入新依赖，不接真实后端。
- 普通用户主导航不暴露权限配置。
- 告警配置与归因必须有真实状态变化和确定性结果。
- 构建后 `dist/index.html` 可直接打开。
- 使用 history 快照进行版本管理，不创建 git commit。

---

### Task 1: 纯逻辑与失败测试

**Files:**
- Create: `src/monitoring.mjs`
- Create: `src/monitoring.d.mts`
- Create: `scripts/test-monitoring.mjs`
- Modify: `package.json`

**Interfaces:**
- `validateAlertRule(rule, limits)` 返回 `{ valid, errors }`。
- `transitionAlertRule(rule, action, actor)` 返回带版本和审计记录的新规则。
- `rankAttributionCandidates(target, candidates, context)` 返回按分数排序的解释性候选。
- `canManageRule(actor, rule)` 返回布尔值。

- [ ] 先写覆盖阈值越界、负责人启停、归因权重、越权脱敏的失败测试。
- [ ] 运行 `node scripts/test-monitoring.mjs`，确认缺少模块导致失败。
- [ ] 实现最小纯函数并加入 `verify:logic`。
- [ ] 运行测试确认通过。

### Task 2: 导航、评估和校验边界

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `scripts/verify-ui.mjs`

- [ ] 为“实验管理”分组、分流方案去重、校验范围和可行性五维结论添加失败结构检查。
- [ ] 将父子实验置于实验清单下方。
- [ ] Seed 候选表删除统计校验列，增加结构风险和“带入上线前检查”。
- [ ] 上线前检查增加范围选择和范围内实验摘要。
- [ ] 可行性增加五维状态及替代方案。

### Task 3: 告警规则配置

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] 在监控排查增加三段导航和规则本地状态。
- [ ] 实现规则列表、角色可编辑状态、规则编辑抽屉、启停和变更记录。
- [ ] 阈值保存调用 `validateAlertRule`，越界时阻止保存并提示。

### Task 4: 跨实验异常归因

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] 告警行增加“分析影响来源”。
- [ ] 进入归因视图后调用 `rankAttributionCandidates`。
- [ ] 展示目标实验、候选排名、五类分值、时间证据、负责人和联系动作。
- [ ] 对无权限候选隐藏敏感明细，并保留风险原因与负责人。

### Task 5: 权限管理

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] 将静态权限矩阵升级为角色档案、范围编辑、动作权限和变更记录。
- [ ] 普通身份不能直接打开权限页。
- [ ] 实验负责人只能管理自己实验规则，管理员可管理全部规则。

### Task 6: 构建、回归与版本

**Files:**
- Modify: `scripts/verify-ui.mjs`
- Modify: `scripts/verify-browser.mjs`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `history/README.md`
- Create: `history/2026-08-21-after-alert-attribution-permission/`

- [ ] 增加规则启停、归因跳转、权限页和 Seed/检查去重的浏览器检查。
- [ ] 运行 `npm run build`、`npm run verify:all`。
- [ ] 生成桌面与移动端截图并人工检查。
- [ ] 创建 after 快照并更新版本文档。
