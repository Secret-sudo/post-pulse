# Working agreement for Claude Code

`docs/SPEC.md` is the single source of truth. Read the relevant sections before changing behaviour; if the code and the spec disagree, fix the code or ask the owner to change the spec. Never invent LinkedIn export column names.

## Workflow
- One phase at a time (SPEC §12). Phase 1 is in progress; don't build Phase 2/3 features.
- Small feature branches (`phase1/<topic>`) and one PR each into `main`. `main` only takes green CI.
- Before pushing: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`. Run `npm run test:e2e` when UI or build config changed.
- Commit messages: imperative subject, body says why.

## Tests are part of the feature
- Every test case in SPEC §11 is an automated test with its ID in the name, e.g. `it('TC-P03 parses durations with day units', …)`.
- Expected values come from the spec, hand-written `fixtures/synthetic/*.expected.json` or the reference values in SPEC §11.4. Never generate expected values with the code under test.
- Real exports live in `docs/data/` (gitignored). Tests using them, with their expected values, go in `docs/data/tests/` (also gitignored, SPEC §11.4), skip themselves when the file is missing, and run with `npm run test:private`. Never copy real figures, post titles or post URLs into committed files.

## Privacy and security rules (SPEC §10.2)
- No runtime request to any other origin. No analytics, telemetry, error-reporting SDKs, external fonts or CDNs.
- Spreadsheet content is untrusted text: no `dangerouslySetInnerHTML`, `innerHTML`, `eval` (ESLint enforces it).
- The CSP lives in `src/security/csp.ts`; `netlify.toml` must stay identical (TC-S03).
- Never commit real exports or anything from `docs/data/`. Never paste real post data into issues, PRs or commit messages.
- SheetJS only from the official CDN tarball, never the npm `xlsx` package.

## Code conventions
- TypeScript strict. Analysis and insight logic are pure functions in `src/analysis/` and `src/insights/`; the UI never computes metrics.
- Medians, not means, for "typical post" figures. Insight wording never claims causation.
- Colours only via CSS custom properties in `src/styles/tokens.css`.
- No LinkedIn logo, "in" mark or brand assets; keep the "Not affiliated with LinkedIn Corporation." footer.
