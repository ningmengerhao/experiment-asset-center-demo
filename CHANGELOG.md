# Changelog

This changelog records product and demo-design milestones that are useful for reproducing past decisions.

## 2026-09-02 - Lifecycle Status and Custom Seed Validation (v0.5.0)

Changed:

- Reworked the ledger around 草稿, 待上线, 运行中, 已暂停, and 已结束 status, with conditional edit, lifecycle, and local-delete actions.
- Completing the new-experiment wizard now creates a 待上线 record and preserves its wizard snapshot for later editing.
- Added local lifecycle transitions with audit and rollout events; legacy direct-created paused records migrate to 待上线 on load.
- Moved validation snapshots and rollout history into experiment detail, simplifying ledger actions to details and lifecycle management.
- Added custom seed validation to random seed generation: valid custom seeds join the candidate list and become the selected seed.
- Added status, migration, lifecycle, deletion, and custom-seed regression coverage.

## 2026-09-01 - Consolidated Experiment Creation (v0.4.0)

Changed:

- Kept creation saves in the current wizard step while persisting editable browser-local ledger drafts; starting a new experiment always opens a blank flow.
- Added real-time split-total feedback, minimum-group sample sizing, maximum-cycle red/yellow warnings, and data-linked five-dimension feasibility assessment.
- Reworked random seed generation into a compact configuration summary and single-seed radio selection followed by an explicit next step; generation attempts remain internal.
- Replaced manual validation scope controls with compact inline checkboxes.
- Removed the legacy experiment evaluation, traffic split, and pre-launch check pages; their old hashes now resolve to the ledger, historical validation is exposed through experiment detail snapshots, and seed rollout history now belongs under experiment management.
- Updated permission wording, documentation, pure logic, UI structure, routing, and browser regression coverage for the consolidated workflow.

## 2026-09-01 - Ledger Drafts for New Experiments (v0.3.3)

Changed:

- Saving any creation-wizard step now writes or updates one browser-local experiment-ledger record with status `草稿`.
- Added a draft-only `编辑` action that restores the complete saved wizard state at its latest step for continued editing.
- Completing an edited draft replaces that same ledger entry with the final local experiment record instead of adding a duplicate.
- Starting a new experiment now always resets the wizard to a blank form and leaves saved ledger drafts available only through their explicit edit actions.
- Added logic, UI, browser-flow, and responsive verification for saving, editing, finalizing, and restarting drafts.

## 2026-08-27 - Short Seed Auto Refresh (v0.3.2)

Changed:

- Replaced the visible UUID-derived candidate suffix with a unique four-to-eight-digit numeric suffix in the new-experiment wizard only.
- Updated one generate action to try up to 20 local random candidate groups and stop early when at least one result is marked passed.
- Kept the best final generated group and reported the 20-round limit when a passing result cannot be found.
- Tuned only the new-wizard candidate threshold for the compact numeric seed representation; existing split tooling remains unchanged.
- Added logic and browser assertions for suffix length, automatic attempt bounds, and passing candidate generation.

## 2026-08-27 - Split Configuration in Create Wizard (v0.3.1)

Changed:

- Moved the independently selected experiment domain into the first wizard step and made later split and validation pages read it as a fixed value.
- Added editable multi-group split proportions to sample evaluation, requiring positive integer percentages totaling 100%; total sample size now protects the smallest traffic group.
- Made generated candidates a saved configuration snapshot: changing a seed input retains the old list but requires an explicit regeneration before it can be selected.
- Regeneration creates a new local random group, clears the selection, and sorts candidate results by validation quality then score.
- Added migration for `v0.3.0` browser drafts, pure logic coverage for split calculations and sorting, and browser regression coverage for the complete updated path.

## 2026-08-27 - Create Experiment Wizard (v0.3.0)

Added:

- Added a hidden `#create` four-step creation route entered from the homepage's existing new-experiment choice dialog; it does not add a sidebar item or change the existing experiment-evaluation route.
- Added step progression for experiment basics, sample-size evaluation, traffic-split seed selection, and deterministic local pre-launch validation results.
- Added explicit local draft saving, restoration from the last saved step, per-step completeness validation, and completion back to the experiment ledger with a browser-local record.
- Reused the existing sample feasibility, seed candidate, and pre-launch validation calculations while leaving the legacy evaluation, split, seed history, and pre-launch pages unchanged.
- Added unit, UI, static-artifact, browser-flow, and desktop/tablet/mobile responsive regression coverage for the new creation flow.

## 2026-08-27 - Ledger Toolbar Surface (v0.2.3)

Changed:

- Kept the four default filter controls on one unbroken horizontal row; narrow screens scroll that control group locally rather than wrapping its fields.
- Changed the ledger toolbar to a white bordered surface and separated it from the table header with a consistent gap.
- Added regression assertions for the single-row filter controls and white toolbar surface.

## 2026-08-27 - Single-Row Ledger Toolbar (v0.2.2)

Changed:

- Moved the default ledger filter names into their controls, widened the ID/name and owner inputs, and removed above-field labels.
- Replaced the query action with immediate filtering; placed filter, reset, blue new experiment, and export actions on the same toolbar row.
- Replaced the direct new-experiment jump with a choice dialog that reuses the existing upload-import drawer or the existing experiment-evaluation workbench.
- Added regression coverage for the creation-method dialog, upload-import path, responsive toolbar layout, and updated filter contracts.

## 2026-08-27 - Compact Ledger Filters (v0.2.1)

Changed:

- Shortened the ledger experiment ID/name input to a five-Chinese-character content width and removed its placeholder text.
- Replaced the owner select with an input backed by known-owner suggestions and case-insensitive partial-name matching.
- Separated ledger fields from filtering actions: four compact fields occupy the first row, while more filters, query, and reset occupy a right-aligned second row.
- Added regression coverage for the compact keyword input and owner filtering behavior.

## 2026-08-26 - Home Ledger and Filter Dialog (v0.2.0)

Changed:

- Initialized the local Git repository, regenerated the stale static artifact, and tagged the reproducible source baseline as `v0.1.0`.
- Moved the experiment ledger to the first ordinary-user navigation entry as `首页`; opening without a hash and invalid routes now resolve to `#list` while preserving `#list` compatibility.
- Moved `新建实验` to the ledger header as a dark primary action that opens the existing experiment-evaluation workbench.
- Reduced the default ledger filter row to experiment ID/name, business line, status, and owner; added a modal `更多筛选` dialog for all five existing conditions with explicit cancel/apply behavior.
- Added regression coverage for the home route, ledger navigation action, default-filter count, filter-draft cancellation, and explicit application.

## 2026-08-21 - Alert Rules, Cross-Experiment Attribution and Permissions

Captured in:

```text
history/2026-08-21-before-alert-attribution-permission
history/2026-08-21-after-alert-attribution-permission
```

Changed:

- Renamed the final ordinary-user navigation group to `实验管理` and kept `父子实验` directly below `实验清单`.
- Expanded feasibility assessment with traffic coverage, baseline stability, contamination, guardrail completeness, business value and alternative plans.
- Renamed Seed evaluation to `分流方案`; removed Pre-AA/uniformity/orthogonality duplication and added naming, layer occupancy, sample scope and reuse risk.
- Added explicit pre-launch comparison scopes: all running, same business domain, same traffic layer and manual selection.
- Added a three-view monitoring workbench: alert center, cross-experiment attribution and alert-rule configuration.
- Added explainable attribution scoring and privacy-aware result masking while retaining owner contact.
- Added editable role profiles, visibility scopes, action permissions, responsible/backup owners, rule bounds and permission audit history.
- Added monitoring pure-logic tests and expanded UI structure verification to 38 checks.

## 2026-08-21 - Investigation Closure and Reproducible Static Build

Captured in:

```text
history/2026-08-20-before-investigation-closure
history/2026-08-20-after-investigation-closure
```

Changed:

- Added a durable local investigation context with legal state transitions, URL hash recovery, `sessionStorage` recovery, evidence focus, owner, collaborators, resolution, and action history.
- Reworked running monitoring into an actionable queue plus a current-investigation evidence timeline; monitor alerts, experiment detail, relationships, rollout events, and validation can all enter or continue the same investigation.
- Upgraded parent-child experiments into a directional three-column relationship workbench with risk queue, relationship records, change history, and experiment-context handoffs.
- Upgraded rollout history into global and experiment-focused modes with a timeline-first layout, filters, source platform, operation reason, and derived repeated-rollout risk within seven days.
- Kept experiment detail as the investigation hub and made drawer stacking, Escape close, focus trapping/restoration, inert background, and body scroll lock deterministic.
- Added stable page, navigation, breadcrumb, investigation, relationship, and rollout data contracts for browser regression tests.
- Replaced the manually duplicated static implementation with `scripts/build-static.mjs`, which emits one production React script and one CSS block into a direct-open `dist/index.html` with a source fingerprint.
- Added `scripts/verify-browser.mjs` using system Edge and CDP for physical click hit-testing, hash history, page-content contracts, drawer focus, table containment, responsive overflow, console errors, and optional screenshots.
- Added `npm run verify:all` as the aggregate TypeScript, logic, UI, static-currentness, and browser gate.
- Added workflow screenshots at 1366x768 and 390x844:
  - `dist/ui-check-investigation-monitor.png`
  - `dist/ui-check-investigation-lineage.png`
  - `dist/ui-check-investigation-rollout.png`
  - `dist/ui-check-investigation-detail.png`
  - `dist/ui-check-investigation-mobile.png`

Detector result:

- Impeccable detector returned one `side-tab` warning at generated `dist/index.html` line 8 for `border-left: 2px solid var(--line)`.
- The source is `.lineage-children`, where the border is a structural parent-child connector rather than a colored card accent; it is removed at the mobile breakpoint. This is recorded as a reasonable structural false positive, not hidden or treated as a passing zero-warning result.

## 2026-08-20 - Interaction Trust Polish

Captured in:

```text
history/2026-08-20-before-interaction-trust-polish
history/2026-08-20-after-interaction-trust-polish
```

Changed:

- Unified ordinary navigation, stage stepper, global-search jumps, row actions, and URL hash through `navigateToTab`/`hashchange`.
- Converted the stage flow from static visual markers into real navigation buttons with hover, focus-visible, and `aria-current`.
- Removed misleading affordances: empty primary actions now show toast feedback or are disabled; read-only risk summaries no longer render as buttons.
- Compressed the experiment list from 12 parallel columns into a 7-column layered ledger table so 1366px screens remain readable.
- Added `aria-label`, `aria-current`, `aria-pressed`, Escape close behavior, and a toast live region.
- Removed detector-reported side-tab alert accents and layout-property search animations.
- Added mobile width constraints so 1366x768, 585x1024, and 390x844 avoid page-level horizontal overflow.
- Refreshed interaction screenshots:
  - `dist/ui-check-interaction-evaluate.png`
  - `dist/ui-check-interaction-list.png`
  - `dist/ui-check-interaction-seed.png`
  - `dist/ui-check-interaction-check.png`
  - `dist/ui-check-interaction-investigate.png`
  - `dist/ui-check-interaction-lineage.png`
  - `dist/ui-check-interaction-rollout.png`
  - `dist/ui-check-interaction-mobile.png`
  - `dist/ui-check-interaction-detail.png`

Verification:

```bash
npm run verify:ui
```

Result:

```text
UI verification passed (67/67).
```

Static HTML inline script check:

```text
script 1 ok length=48357
script 2 ok length=496
```

Browser smoke test:

- Ctrl+K focuses the global search.
- Stage stepper, left navigation, hash back/forward, help drawer, import drawer, and detail drawer interactions passed.
- 1366x768, 585x1024, and 390x844 had no page-level horizontal overflow across the ordinary-user pages.

Detector note:

- `side-tab` and `layout-transition` findings are gone.
- The detector still reports an advisory `numbered-section-markers` pattern caused by business-style IDs/date sequences; no production-facing fake numbered section markers were added.

## 2026-08-20 - P0 Closed-Loop Stage Redesign

Captured in:

```text
history/2026-08-20-before-p0-loop-redesign
history/2026-08-20-after-p0-loop-redesign
```

Changed:

- Reorganized the ordinary-user navigation by experiment stage: pre-experiment evaluation, traffic split, pre-launch validation, running investigation, and retrospective traceability.
- Added a real experiment-evaluation entry with sample size, test-period estimation, feasibility status, and handoff actions into Seed evaluation and pre-launch validation.
- Upgraded Seed evaluation into traffic-split plan evaluation with seed, split layer, ratio, sample scope, and historical reuse risk.
- Reworked experiment validation into a pre-launch checklist covering Pre-AA, uniformity, orthogonality, and rule-conflict checks.
- Reframed investigation as a running-monitoring workbench with alerts, evidence chains, owner context, and suggested next actions.
- Extended experiment detail with stage status, sample scope, validation snapshot, source/import quality, audit events, and review summary.
- Kept admin-only governance and import-review capabilities gated behind the account role entry.
- Added responsive mobile navigation as a horizontal rail so small screens avoid page-level horizontal overflow.
- Expanded `scripts/verify-ui.mjs` to cover the P0 loop, validation checklist, monitoring evidence, review traceability, and small-screen navigation behavior.
- Refreshed P0 screenshots:
  - `dist/ui-check-p0-evaluate.png`
  - `dist/ui-check-p0-seed.png`
  - `dist/ui-check-p0-check.png`
  - `dist/ui-check-p0-investigate.png`
  - `dist/ui-check-p0-list.png`
  - `dist/ui-check-p0-mobile.png`

Verification:

```bash
npm run verify:ui
```

Result:

```text
UI verification passed (60/60).
```

Static HTML inline script check:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); const scripts=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); if(!scripts.length) throw new Error('inline script missing'); for (const [i, script] of scripts.entries()) { new Function(script); console.log('inline script '+(i+1)+' ok'); }"
```

Visual/interaction verification:

- Used Playwright with local Chrome to capture 1366x768 views for evaluation, Seed, validation, monitoring, and list pages.
- Used Playwright at 585x1024 to confirm the small-screen body/document width stays equal to viewport width while the sidebar navigation scrolls internally.

Known local limitation:

```bash
npm run build
```

was not used as the final proof because this local project does not currently have installed dependencies for `tsc`; run it after installing dependencies for formal build verification.

## 2026-08-05 - Restart Context and Version Checkpoint

Captured in:

```text
history/2026-08-05-restart-checkpoint
docs/2026-08-05-restart-context.md
```

Changed:

- Added a clean restart context document that preserves product intent, module boundaries, data-model state, design decisions, sync rules, validation commands, and next-task options.
- Replaced the root `README.md` with a concise entry point that points future work to the restart context and current stable version.
- Created a restart checkpoint snapshot with source, static HTML, verification script, product docs, screenshots, and restart context.
- Updated `history/README.md` so the new checkpoint appears in the version index.
- Kept the current UI behavior unchanged; this is a context and version-management checkpoint.

Verification:

```bash
npm run verify:ui
```

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); const scripts=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); for (const script of scripts) new Function(script); console.log('inline script syntax ok');"
```

## 2026-07-09 - Shortcut Behavior and Medium-Screen Layout

Captured in:

```text
history/2026-07-09-before-shortcut-responsive-fix
history/2026-07-09-after-shortcut-responsive-fix
```

Changed:

- Wired `Ctrl K` so it focuses the global search and opens the command palette in both React source and static HTML.
- Clarified the global search as cross-page positioning for experiments, seeds, and rollout events, separate from page-level filters.
- Raised the medium-screen breakpoint to cover 1366px-class laptop screens.
- Changed dense filters to two columns on medium screens instead of forcing all filters into one row.
- Kept table overflow inside the table container and preserved page-level width stability.
- Added sticky operation columns for action-heavy tables: experiment list, parent-child relationships, and Seed evaluation.
- Kept rollout history as a normal record table so the reason column is not incorrectly treated as an operation column.
- Expanded `scripts/verify-ui.mjs` to cover shortcut behavior, medium-screen layout, and sticky operation table behavior.
- Refreshed `dist/ui-check.png` and added `dist/ui-check-ctrlk.png`.

Verification:

```bash
npm run verify:ui
```

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); const scripts=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); for (const script of scripts) new Function(script); console.log('inline script syntax ok');"
```

Visual/interaction verification:

- Opened static `dist/index.html` with headless Microsoft Edge at 1366x768.
- Confirmed `Ctrl K` focuses `#globalSearchInput` and opens the command palette.
- Confirmed medium-screen filters render as two columns.
- Confirmed the page itself has no horizontal overflow; tables scroll internally.
- Confirmed exactly the action-heavy tables use sticky operation columns, while rollout history does not.

## 2026-07-06 - Search, Navigation Icons, and Workflow Workbenches

Captured in:

```text
history/2026-07-06-before-search-nav-workbench
history/2026-07-06-after-search-nav-workbench
```

Changed:

- Replaced the always-wide global search with a compact adaptive search entry.
- Added a command palette for experiments, rollout events, relationship records, source platforms, and Seed records.
- Hid the `Ctrl K` hint until hover/focus/open states so the header takes less space by default.
- Replaced unclear sidebar icons with more semantic workflow icons.
- Expanded parent-child experiments with relationship view, risk queue, relationship chain, sample overlap, and investigation entry.
- Expanded rollout history with focus mode and abnormal-change analysis.
- Reworked investigation into a target/problem/evidence/ranking/next-step workbench.
- Refreshed `dist/ui-check.png`.

Verification:

```bash
npm run verify:ui
```

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); const scripts=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); for (const script of scripts) new Function(script); console.log('inline script syntax ok');"
```

Visual/interaction verification:

- Opened static `dist/index.html` with headless Microsoft Edge.
- Checked global search, command palette, parent-child experiment page, rollout history, and investigation workbench.

## 2026-07-06 - Functional Organization and Investigation Hub

Captured in:

```text
history/2026-07-06-before-functional-organization
history/2026-07-06-after-functional-organization
```

Changed:

- Made every ordinary-user left-navigation entry resolve to a concrete page with rendered data.
- Expanded experiment detail into an investigation hub with basic info, group meaning, relationships, rollout timeline, latest check, source/import quality, and audit events.
- Reworked parent-child experiments into a relationship-management page with type, scope, reason, update time, risk, and detail links.
- Added source platform to rollout history and kept both global and single-experiment focused modes.
- Connected batch import precheck, ordinary-user import records, and admin row-level review decisions.
- Added role-gated admin governance and permission pages with concrete content.
- Preserved before/after snapshots and refreshed `dist/ui-check.png` for visual comparison.

Verification:

```bash
npm run verify:ui
```

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('dist/index.html','utf8'); const scripts=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]); for (const script of scripts) new Function(script); console.log('inline script syntax ok');"
```

Visual/interaction verification:

- Opened static `dist/index.html` with headless Microsoft Edge.
- Checked experiment list, parent-child experiments, rollout history, detail drawer, import records, and admin import review.

## 2026-07-06 - Header, Navigation, and Source Filter Polish

Captured in:

```text
history/2026-07-06-before-header-nav-polish
history/2026-07-06-after-header-nav-source-polish
```

Changed:

- Added `PRODUCT.md` to capture product register, users, purpose, anti-references, and design principles.
- Moved ordinary/admin view switching into the account menu.
- Replaced top-right Chinese-character utility buttons with semantic icon controls.
- Simplified account trigger to avatar + name + dropdown.
- Reworked static left navigation icons into consistent SVG icon slots.
- Replaced inline source-platform explanatory copy with native input suggestions.
- Changed the main filter grid from equal-width columns to weighted columns so keyword fields get more room.
- Rewrote `scripts/verify-ui.mjs` into readable UTF-8 checks and expanded it to cover the new UI rules.
- Captured `dist/ui-check.png` for visual comparison.

Verification:

```bash
npm run verify:ui
```

```bash
node -e "const fs=require('fs');const vm=require('vm');const s=fs.readFileSync('dist/index.html','utf8');const m=s.match(/<script>([\s\S]*)<\/script>/);if(!m) throw new Error('inline script missing');new vm.Script(m[1]);console.log('inline script syntax ok');"
```

Known local limitation:

```bash
npm run build
```

fails when dependencies are not installed because `tsc` is unavailable.

## 2026-07-03 - Role-Based Product Framing and Static Page Repairs

Captured in:

```text
history/2026-07-03-before-role-based-redesign
history/2026-07-03-before-encoding-fix
history/2026-07-03-before-drawer-source-platform-fix
```

Changed:

- Clarified ordinary-user versus administrator capabilities.
- Moved admin-like capabilities out of the ordinary user primary navigation.
- Preserved investigation, Seed evaluation, experiment checks, parent-child experiments, rollout history, and import records for ordinary users.
- Repaired Chinese text rendering in the static page.
- Fixed help drawer behavior.
- Improved source-platform table display so source name and access type are structured rather than mixed inline.

## 2026-06-25 - Requirements, Design Rules, and Experiment-Check Scope

Captured in:

```text
history/2026-06-25-before-contextual-checks
history/2026-06-25-before-source-search-help-font
```

Changed:

- Created product requirements for an experiment asset and rollout traceability platform.
- Created AI frontend design rules with Arco/Semi-style admin UI constraints.
- Clarified the platform is not responsible for actually starting or stopping online experiments.
- Elevated parent-child experiments and rollout history as core traceability concepts.
- Kept analysis capabilities in scope:
  - random seed selection
  - sample size calculation
  - Pre-AA check
  - uniformity check
  - orthogonality check
- Added sample-scope requirements for experiment checks.
- Added production-demo rules: visible features should be usable, not decorative placeholders.
