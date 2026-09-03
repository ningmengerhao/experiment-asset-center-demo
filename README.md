# 实验资产中心 Demo

这是一个可直接打开的静态前端 demo，用于验证跨平台实验登记、运行中排查和历史追溯工作流。平台不负责真正开启或关闭线上实验，重点是把分散的实验、Seed、关系、放量、校验和导入记录组织成可连续追查的证据。

当前静态入口（相对项目根目录）：

```text
dist/index.html
```

公开仓库当前可复现版本：

```text
v0.6.1
```

## 当前工作流

一期 Demo 使用浏览器本机 mock 数据运行，不连接真实通讯录、网络、线上表或任务平台。首次进入先选择测试账号；管理员可在账号菜单重置测试数据，所有授权、申请、审批、指标、草稿和审计仅保存在当前浏览器。

普通用户从首页进入，通过新增实验、指标管理、我的权限、运行中排查和实验管理完成主要工作流：

1. 首页：实验清单、跨平台来源与当前状态概览。
2. 指标管理：维护指标版本、口径、业务域、线上表或推送任务来源、更新频率、查看/编辑权限和停用状态。
3. 我的权限：申请指定实验、业务域、指标或样本来源的查看、编辑和使用权限；管理员可审批、拒绝或重置测试数据。
4. 新增实验：在实验基本信息中选择核心/护栏指标、样本来源和历史区间，再完成样本量评估、随机数选择和校验结果。
5. 运行中：告警中心、跨实验异常归因、告警规则配置和当前排查。
6. 实验管理：父子实验、放量历史、随机数放量历史和批量导入记录。

新增实验使用独立四步向导：实验基本信息、样本量评估、随机数选择和校验结果。第一步从已授权指标库选择一个核心指标和零到多个护栏指标；指标本身不带核心或护栏分类，同一指标不能在同一实验内重复选择。样本范围配置随机化单位、样本来源、历史开始/结束日期和唯一的多行过滤条件。SQL 仅允许单条 `SELECT`，仅允许 `${BATCH_DATE_START}` 与 `${BATCH_DATE_END}`；不支持旧 `${BATCH_DATE}`。过滤条件无需填写 `WHERE`，平台会按原 SQL 是否存在 `WHERE` 自动追加 `WHERE` 或 `AND`。选择 mock 任务来源时会将历史日期和过滤条件作为任务参数用于读取 mock 快照。点击保存会将当前信息作为“草稿”写入实验清单且保留当前步骤，可从清单编辑并继续；每次点击新建实验始终开启新的空白向导。样本量、周期、分流比例和五维可行性实时联动；随机数配置支持自定义 seed 校验。完成创建后实验进入待上线状态，可在清单中上线、下线或终止；已暂停实验可重新上线或终止。所有实验记录均可复制为独立的 `_copy` 草稿。实验详情保存指标版本、样本来源、历史区间、过滤后的样本规则、分流和 seed 的本地快照。校验快照与放量历史归属实验详情，随机数放量历史位于实验管理。

实验详情是排查入口，监控排查是闭环中枢。建立本地排查后，同一实验上下文会在监控、父子关系、放量和校验页面间连续保留，并同步到 URL hash 与 `sessionStorage`。

可直接打开的 hash 示例：

```text
#list
#create?step=basic
#investigate?experiment=EXP-240611-017&alert=ALT-003&range=14d&focus=overview
#lineage?experiment=EXP-240611-017&range=14d&focus=relationship
#rollout?experiment=EXP-240611-017&range=14d&focus=rollout
```

浏览器前进/后退会恢复页面、实验、告警、时间范围和证据焦点。无 hash 打开及非法 hash 会进入 `#list` 首页。

## 构建方式

安装依赖后运行：

```bash
npm install
npm run build
```

`npm run build` 先执行 TypeScript 构建，再由 `scripts/build-static.mjs` 使用生产模式把 React、样式和依赖打成一个自包含的 `dist/index.html`。文件内包含源码指纹，不依赖外部 JS/CSS，可通过 `file://` 直接打开。

需要传统 Vite 目录产物时使用：

```bash
npm run build:web
```

该命令输出到 `build/`，不会覆盖直接打开的 `dist/index.html`。

## 验证

完整门禁：

```bash
npm run verify:all
```

它覆盖 TypeScript、调查/抽屉纯逻辑、UI 结构、静态产物一致性和系统 Edge/CDP 真实交互回归。浏览器回归验证 1366x768、585x1024、390x844 三档视口、URL 历史、抽屉焦点、页面正文契约、表格局部滚动和 console error。

重新生成五张关键视图：

```bash
npm run verify:browser -- --screenshots
```

输出：

```text
dist/ui-check-investigation-monitor.png
dist/ui-check-investigation-lineage.png
dist/ui-check-investigation-rollout.png
dist/ui-check-investigation-detail.png
dist/ui-check-investigation-mobile.png
```

静态文件 inline script 语法检查：

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m)=>new Function(m[1])); console.log('inline script syntax ok')"
```

## 版本约束

- `src/App.tsx`、`src/styles.css` 是产品源代码，`dist/index.html` 是生成产物，不手工维护两套业务逻辑。
- 使用 Git 分支、提交和 tag 管理可复现版本；`v0.1.0` 是导入基线，`v0.2.0` 是首页与清单筛选改版，`v0.2.1` 是清单筛选紧凑化，`v0.2.2` 是单行清单工具栏与新建方式选择，`v0.2.3` 是工具栏单行筛选与白色表面优化，`v0.3.0` 是本地草稿支持的四步新增实验向导，`v0.3.1` 是实验域、多组分流比例与可重复生成候选 seed 调整，`v0.3.2` 是短 seed 后缀与通过结果自动刷新，`v0.3.3` 是实验清单草稿和编辑恢复，`v0.4.0` 是新增实验流程收敛与旧页面移除，`v0.5.0` 是清单生命周期状态和自定义 seed 校验，`v0.5.1` 是任意状态实验记录复制为草稿，`v0.5.2` 是已暂停实验的上线与终止双动作，`v0.6.0` 是离线测试账号、资源级权限、指标库、样本范围与历史快照的一期闭环，`v0.6.1` 是指标角色去类型化和统一过滤条件调整。
- 普通用户主导航不暴露数据治理、权限配置和管理员审核。
- 可见主操作必须有跳转、状态变化、抽屉或 toast 反馈；未实现能力不得伪装成可用按钮。
- 当前仍是本地静态演示，排查状态不写入生产系统，也不包含真实后端持久化。
