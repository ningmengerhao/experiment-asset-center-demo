# Contributing

## Local Setup

```bash
npm install
npm run build
```

Open `dist/index.html` directly to review the static demo.

## Workflow

1. Create a branch from `main` using `feature/<short-name>` or `fix/<short-name>`.
2. Keep product source changes in `src/`; regenerate `dist/index.html` with `npm run build`.
3. Run the full gate before opening a pull request:

```bash
npm run verify:all
```

4. Describe the user workflow, screenshots, verification result, and known limitations in the pull request.
5. Use pull requests for review; do not push feature work directly to `main`.

## Demo Constraints

- This repository is a static frontend demo. Do not add real production credentials or customer data.
- Ordinary-user navigation must not expose administrator-only capabilities.
- Visible actions must produce navigation, state changes, a drawer, or clear feedback.
- Keep page-level horizontal overflow at zero; tables may scroll only inside their table wrapper.
