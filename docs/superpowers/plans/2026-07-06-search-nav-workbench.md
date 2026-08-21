# Search Nav Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the header search lighter, the left navigation icons clearer, and the parent-child, rollout, and investigation pages more workflow-oriented.

**Architecture:** Keep the current single-file React demo and static `dist/index.html` in sync. Add behavior through local demo data and rendered UI only; do not introduce a backend or new dependency.

**Tech Stack:** React, TypeScript, CSS, static HTML, local verification script.

## Global Constraints

- Keep the current Arco/Semi-style admin UI direction.
- Keep ordinary-user and administrator capabilities role-separated.
- Every visible feature must have a concrete rendered state.
- Update source and static HTML together because users open `dist/index.html`.
- Preserve before/after snapshots in `history/`.

---

### Task 1: Verification Contract

**Files:**
- Modify: `scripts/verify-ui.mjs`

**Interfaces:**
- Produces checks for compact search, command palette content, semantic icons, relationship workbench, rollout event analysis, and investigation workbench.

- [x] Add failing checks for the new UX requirements.
- [x] Run `npm run verify:ui`.
- [x] Confirm failure lists the expected missing features.

### Task 2: Header Search And Navigation Icons

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `dist/index.html`

**Interfaces:**
- Produces `.quick-search-trigger`, `.command-palette`, adaptive `.global-search`, and semantic navigation icons.

- [x] Replace the always-wide top search with a compact trigger that expands on focus.
- [x] Add a command palette with experiment, seed, rollout, source-platform, and relationship results.
- [x] Replace weak sidebar icons with more direct workflow icons.
- [x] Sync the same behavior into static HTML.

### Task 3: Core Workbench Pages

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `dist/index.html`

**Interfaces:**
- Produces relationship workbench, rollout event analysis, and investigation workbench sections.

- [x] Add relationship view, risk queue, relation-chain, sample-overlap, and investigation-entry affordances to the parent-child page.
- [x] Add rollout mode, abnormal-change indicators, and event analysis to the rollout page.
- [x] Replace the simple investigation cards with target, problem type, evidence chain, suspicious-reason ranking, and next-step actions.

### Task 4: Verification And Versioning

**Files:**
- Modify: `history/README.md`
- Modify: `CHANGELOG.md`
- Create: `history/2026-07-06-after-search-nav-workbench/*`

**Interfaces:**
- Produces passing verification, refreshed screenshot, and version history.

- [x] Run `npm run verify:ui`.
- [x] Check static inline script syntax.
- [x] Use headless Edge to exercise key views and save `dist/ui-check.png`.
- [x] Create after snapshot and update history docs.
