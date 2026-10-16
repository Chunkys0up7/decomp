# Spec compliance: Policy Cards

**Spec sources**
- `policy-cards-build-spec.md` v1.0 (behaviour, data, IDs, gating, adapters, Salt loading, tests) — "main spec"
- `policy-cards-visual-agent.md` (visual override; wins on colour, shape, spacing, density) — "visual spec", IDs prefixed `VIS-n`
- Decomposition method: `docs/approach.md` (this repo; not part of the original spec — see X1–X3)
- Card runtime and loan agent: `docs/specs/card-runtime.md` (this repo, Phase 8) — IDs `R1`–`R8`
- Pipeline re-check: `docs/specs/pipeline-recheck.md` (this repo, Phase 9) — IDs `P1`–`P7`

**Last updated**: 2026-10-15

Status: ⬜ Not started · 🟡 In progress · ✅ Done · 🟦 Verified · ❌ Blocked · ➖ Deferred

## Phase plan (main spec 15, visual spec 12)

| Phase | Deliverable | Exit criteria | Status |
|---|---|---|---|
| 0 | Scaffold, fonts, Salt wiring, token dump, palette, `/__salt-check`, verify-tokens, spacing map, API notes | TEST-30 (dev + preview), VIS-11.2 smoke checks, single versions (`npm ls`) | 🟦 exit criteria met |
| 1 | Domain types, IDs, artifact + hash, schema, sample data, reducer, selectors, persistence, mock adapters | TEST-01 … TEST-18 | 🟦 exit criteria met (46 unit tests) |
| 2 | Shell: header, stepper, routes + guards, copy, save indicator, announcer | 5.2 behaviour, TEST-16 | 🟦 exit criteria met (`e2e/shell.spec.ts`, TEST-16) |
| 3 | Review screen | TEST-20–22, TEST-31–33 (seeded) | 🟦 exit criteria met (TEST-20–22 unit, `e2e/review.spec.ts` 7 tests; TEST-31 full path completes in Phase 6) |
| 4 | Decompose screen, all run states | TEST-34 (partial), visual baselines | 🟦 `e2e/decompose.spec.ts` (4); baselines deferred to Phase 7 |
| 5 | Load screen | TEST-23, TEST-17 | 🟦 `e2e/load.spec.ts` (6), TEST-17 unit |
| 6 | Publish screen | TEST-24, full TEST-31 | 🟦 `e2e/flow.spec.ts` TEST-31 incl. schema-validated export; TEST-24 failure-path UI in Phase 7 |
| 7 | Hardening | TEST-35–42 | 🟦 exit criteria met (`npm run verify`: 52 unit, 78 e2e); TEST-38 superseded (D-T3) |
| 8 | Card runtime and loan agent (`docs/specs/card-runtime.md`) | R1–R8; `runtime/runtime.test.mjs`; fixtures rebuild identically | ✅ built; see Phase 8 table |
| 9 | Pipeline re-check (`docs/specs/pipeline-recheck.md`) | P1–P7; `runtime/pipeline.test.mjs` | ✅ built; see Phase 9 table |

## Requirements — Phase 0 (in scope now)

| ID | Requirement | Spec ref | Status | Evidence |
|---|---|---|---|---|
| SALT-01 | Pinned `@salt-ds/*`, fontsource, router, canonicalize, dev toolchain | section 4.2 | ✅ | `package.json` (core 1.72.0, theme 1.47.0, icons 1.18.3 exact) |
| SALT-02 | No `@salt-ds/lab` unless required | section 4.2 | ✅ | not installed; `docs/salt-api-notes.md` |
| SALT-03 | Exactly one resolved version of salt/react packages | section 4.2 | 🟦 | `npm ls` output recorded in `docs/salt-api-notes.md` |
| SALT-04 | Read installed `.d.ts`; record real prop names in `docs/salt-api-notes.md` | section 4.2 | ✅ | `docs/salt-api-notes.md` |
| SALT-05 | `index.html` exactly per spec | section 4.3 | ✅ | `index.html` |
| SALT-06 | Import order fonts → baseline → theme → palette → app | section 4.4, VIS-1.1 | 🟦 | `src/main.tsx`; TEST-30 passes in preview build |
| SALT-07 | Provider/theme CSS pairing verified, never mixed | section 4.4, VIS-5.1 | 🟦 | `SaltProviderNext` + `theme-next.css` (D-S1); TEST-30 |
| SALT-08 | Amplitude font presence recorded | section 4.4 | ✅ | absent; `docs/deviations.md` Q3 |
| SALT-09 | One provider at root, default class application, injection on | section 4.5 | 🟦 | `src/salt/SaltRoot.tsx`; TEST-30 `componentCssInjected` |
| SALT-10 | Portals receive theme | section 4.5 | 🟦 | TEST-30 `tooltipSpacingToken` |
| SALT-11 | Density app-wide: **low** (VIS-7.1 overrides `medium`) | section 4.5, VIS-11 | 🟦 | `src/app/config.ts`; TEST-30 asserts `salt-density-low` |
| SALT-12 | `mode` wired, light only | section 4.5 | ✅ | `SaltRoot.tsx` |
| SALT-13…16 | Default runtime injection; CSP path documented; jsdom test wrapper | section 4.6 | 🟦 | injection (TEST-30); wrapper `src/test/render.tsx` |
| SALT-17 | No resets/universal/`!important`/Salt-internal selectors | section 4.7 | 🟦 | `scripts/verify-tokens.mjs` (mutation-tested) |
| SALT-18 | `app.css` sizing only | section 4.7 | ✅ | `src/styles/app.css` |
| SALT-19, 20, 21 | No utility CSS; no `sideEffects:false`; Vite dedupe | section 4.7 | ✅ | `package.json`, `vite.config.ts` |
| SALT-22 | Product CSS after Salt | section 4.7 | ✅ | `src/main.tsx` |
| SALT-23 | `required-exports.ts` compile-time guard | section 4.8 | 🟦 | `src/salt/required-exports.ts`; `npm run typecheck` passes |
| SALT-24, 25 | Token existence + raw-value rules (as revised by VIS-11) | section 4.10, VIS-11 | 🟦 | `scripts/verify-tokens.mjs` (D-S2); mutation test caught 6/6 violations |
| VIS-1.3 | Token dump to `docs/salt-tokens.txt`, absent names recorded | VIS-1.3 | ✅ | `docs/salt-tokens.txt` (9 absent names, mapped in D-S4) |
| VIS-4 | `palette.css` (only file with raw colours) + Salt overrides | VIS-4.1, section 4.2 | 🟦 | `src/styles/palette.css`; TEST-30 CTA `rgb(31, 95, 209)` |
| VIS-5 | Rounded corners via provider or `--pc-radius-*` | VIS-5 | 🟦 | `corner="rounded"`; TEST-30 control + panel radius |
| VIS-11.1 | `verify-tokens.mjs` revised rules | VIS-11.1 | 🟦 | `scripts/verify-tokens.mjs` |
| VIS-11.2 | `/__salt-check` also asserts panel radius ≥ 12 and CTA `rgb(31, 95, 209)` | VIS-11.2 | 🟦 | `e2e/salt-check.spec.ts` |
| UI-40 | `docs/spacing-map.md` from spacing probe | section 10.1 | 🟦 | `docs/spacing-map.md`; probe test |
| TEST-30 | Salt check passes in dev and preview | section 14.3, App. D | 🟦 | `npx playwright test e2e/salt-check.spec.ts`: 4/4 pass (dev + preview); `docs/screens/phase0-salt-check.png` |

## Requirements — Phase 1 (done)

| ID | Requirement | Spec ref | Status | Evidence |
|---|---|---|---|---|
| DATA-01 | Evidence quote equals passage slice | 6.1 | 🟦 | `src/domain/evidence.ts` · `domain.test.ts` TEST-01 |
| DATA-02 | IDs generated by the adapter, displayed by the UI | 6.1 | ✅ | `src/adapters/mock-decompose.ts` (D-D3) |
| DATA-03 | Every card has evidence | 6.1 | 🟦 | VAL-02 · `domain.test.ts` |
| DATA-04 | Passages rendered verbatim | 6.1 | ✅ | `SourcePane.tsx` (`white-space: pre-wrap`, no transforms) |
| DATA-05, 06 | Global seq; policy ID pattern with warning | 6.2 | 🟦 | `src/domain/ids.ts`, `src/domain/meta.ts` · TEST-02, TEST-17 |
| DATA-07, 07a, 08 | Field labels vs keys, `_inferred` suffix, not-evaluable rule cards | 6.3 | 🟡 | content keys 🟦 TEST-10; display in Phase 3 |
| DATA-09, 10 | Passage-level issues; global resolution | 6.4 | 🟦 | `applySetup` (D-D4), reducer ISSUE_RESOLVE · TEST-08, TEST-14 |
| DATA-11, 12 | depends_on stored, used_by derived; conflicts as issues | 6.5 | 🟦 | `selectors.ts` usedBy · TEST-04 |
| DATA-13 | Content hash over canonical JSON | 6.6 | 🟦 | `src/domain/artifact.ts` · TEST-11, TEST-12 |
| DATA-14 | Preview with `content_hash: null` | 6.6 | 🟡 | builder ✅; Artifact tab in Phase 3 |
| DATA-15 | accepted_issues | 6.6 | 🟦 | TEST-10 |
| DATA-16 | JSON schema validated with ajv in tests and at publish | 6.6 | 🟦 | `src/domain/schema/policy-card.schema.json`, `local-publish.ts` · TEST-10 (D-D5) |
| DATA-17 | Package manifest | 6.6 | 🟦 | `buildManifest` · `e2e/flow.spec.ts` checks manifest hashes, rejected list, uncovered passages |
| DATA-18 | Pure, memoised selectors | 7.4 | ✅ | `src/store/selectors.ts` |
| RED-01 … RED-12 | Reducer rules | 7.3 | 🟦 | `src/store/reducer.ts` · `store.test.ts` (RED-01 and RED-06 mutation-checked) |
| 7.4 selectors | counts, issues, gates, coverage, lineage, steps | 7.4 | 🟦 | TEST-03, 04, 08, 16 |
| PER-01 … PER-04 | Draft shape, debounce + hidden flush, restore, failure | 7.5 | 🟦 | `persistence.ts`, `StoreProvider.tsx` · TEST-13, `StoreProvider.test.tsx` |
| PER-05 | Start over | 7.5 | 🟦 | `LoadScreen.tsx` · `e2e/load.spec.ts` |
| ADP-01 … ADP-03 | Abort signals, retryable errors, unknown errors | 8.3 | 🟦 | `src/app/run.tsx`, `src/app/ingest.ts` · `e2e/decompose.spec.ts`, `e2e/load.spec.ts` |
| 8.2 mocks | ingest, decompose, local publish | 8.2 | 🟦 | `src/adapters/*` · TEST-14, TEST-15, `adapters.test.ts` |
| VAL-01 … VAL-08 | Result validation | 8.5 | 🟦 | `src/domain/validate.ts` · `domain.test.ts` |
| TEST-01 … TEST-18 | Unit tests | 14.1 | 🟦 | `npm run test`: 46 passed |
| SALT-16 | Salt test wrapper | 4.6 | 🟦 | `src/test/render.tsx` |

## Requirements — later phases (tracked, not in scope yet)

| Group | IDs | Phase | Status |
|---|---|---|---|
| Shell + routing | UI-05 ✅, UI-06 🟦, UI-07 🟦, UI-08 🟦, UI-09 (Phase 5), UI-10 (Phase 3), spec 5.4 save indicator ✅, copy catalog ✅ `src/app/copy.ts`, A11Y-01 🟦, A11Y-05 🟦 | 2 | 🟦 `src/app/AppShell.tsx`, `src/components/shell/*`, `e2e/shell.spec.ts` |
| Load screen | spec 9.1 ✅, UI-09 🟦, UI-20 🟦, UI-21 🟦, UI-27 ✅, PER-03 🟦, PER-05 🟦, RED-11 ✅ | 5 | 🟦 `src/screens/LoadScreen.tsx`, `src/components/load/*` |
| Decompose screen | spec 9.2 ✅, ADP-01 🟦, ADP-02 🟦, TEST-34 🟦 | 4 | 🟦 `src/screens/DecomposeScreen.tsx`, `src/components/decompose/*`, `src/app/run.tsx` |
| Review screen | spec 9.3 ✅, UI-10 🟦, UI-30 🟦, UI-31 ✅, UI-32 ✅, UI-33 🟦, UI-34 ✅, UI-35 🟦, DATA-04 ✅, DATA-07/08 🟦, DATA-14 ✅, TEST-32/33/36 🟦 | 3 | 🟦 `src/screens/ReviewScreen.tsx`, `src/components/review/*`, `src/components/cards/*` |
| Publish screen | spec 9.4 ✅, 9.4.5 🟦, DATA-17 🟦, TEST-31 🟦 | 6 | 🟦 `src/screens/PublishScreen.tsx`, `src/components/publish/*`, `src/app/publish.ts` |
| Visual system | UI-41, UI-44 … UI-49 as revised by VIS-3 … VIS-8; VIS-10 guardrails | 2–7 | 🟦 `e2e/quality.spec.ts` guardrails at 1440 and 390; TEST-42 contrast |
| Accessibility | A11Y-01 … A11Y-14 | 2–7 | 🟦 axe (TEST-40) zero serious/critical on every listed state; keyboard-only flow (TEST-37); reflow at 390 (A11Y-10); reduced motion honoured in scrolling (A11Y-11); jsx-a11y lint |
| Tests | TEST-20 … TEST-25, TEST-31 … TEST-42, VIS-10 | 2–7 | 🟦 TEST-20–25 unit/component (TEST-24 `PublishScreen.test.tsx`, TEST-25 lint rule, mutation-checked); TEST-31–37, 40–42 e2e; TEST-41 baselines in `e2e/hardening.spec.ts-snapshots/` (stable over 5 repeats) |

## Requirements — Phase 8 (card runtime)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| R1 | Runtime bundle `policy-card-runtime/1.0`, built only from a validated set; card fingerprints include resolved params; tamper check | ✅ | `runtime/bundle.mjs`; tests "bundles" (determinism, committed fixtures match, param change moves fingerprint, invalid set refused, tamper detected) |
| R2 | Card fields `applies_when`, `over`, `item_when`, `binds`, `result_severity`; checks C10–C12 | ✅ | `pipeline/checks.mjs`, `runtime/expr.mjs`; golden sample extended; tests "validator C10-C12" (mutations) |
| R3 | Deterministic evaluation: order, five step statuses, no defaults, assumptions, discrepancies, outcome ranking, sandbox | ✅ | `runtime/evaluate.mjs`; tests "evaluation", "sandbox" |
| R4 | Version selection by as-of date, early adoption, fail closed | ✅ | `runtime/select.mjs`; tests "version selection" |
| R5 | `loan-file/1.0` in, `loan-decision/1.0` out; passage IDs only | ✅ | `runtime/fixtures/loans/`; decision shape in tests |
| R6 | Receipts with memo: rendered, skipped on unchanged inputs, re-rendered on a new bundle | ✅ | `runtime/receipts.mjs`; tests "receipts" |
| R7 | JS API, CLI (`npm run runtime`, `npm run loan:check`), agent skill | ✅ | `runtime/index.mjs`, `runtime/cli.mjs`, `.claude/skills/loan-check/SKILL.md` |
| R8 | Out of scope recorded (Phase 9 re-check, overlays, multi-document, MCP, UI) | ✅ | `docs/specs/card-runtime.md` R8; `docs/SPEC.md` roadmap 10–11 |

## Requirements — Phase 9 (pipeline re-check)

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| P1 | Pipeline manifest `loan-pipeline/1.0` with loan status and lender version policy | ✅ | `runtime/pipeline.mjs` `loadPipeline`; `runtime/fixtures/pipeline.json` |
| P2 | Re-check run: memo skips, re-renders, impact-only for closed/sold, chained run receipts | ✅ | `recheck`; tests "re-check runs"; memo keyed on the selection essentials (`selectionKey`) |
| P3 | Step-level diff with classes and flags, new assumptions, newly outstanding | ✅ | `runtime/diff.mjs`; tests "decision diff" |
| P4 | Review queue with prioritised reasons | ✅ | `queueReason`; tests for outcome_changed, would_change, newly_incomplete |
| P5 | Report `pipeline-report/1.0`, deterministic hash, text summary, `--json`/`--out` | ✅ | `summarize`; determinism test; `npm run pipeline:recheck` |
| P6 | Agent guidance for pipeline runs | ✅ | `.claude/skills/loan-check/SKILL.md` "Pipeline re-check" |
| P7 | Out of scope recorded | ✅ | spec P7 |

## Out-of-spec changes

| ID | Change | Justification | Decided by | Note |
|---|---|---|---|---|
| X1 | Repo also hosts the decomposition method (`pipeline/`, `golden/`) next to the UI | User's core problem is decomposition at scale (2026-10-12); spec treats it as a black box (spec 1.4, 8) | user 2026-10-12 | Pipeline is Node scripts; UI never imports them at run time |
| X2 | ~~Source-specific decomposition adapter~~ (dropped) | The pilot source was only an example; the app stays source-agnostic. The mock stays the default until a real decomposition adapter exists | user 2026-10-12 | Not built; pilot source data removed from the repo |
| X4 | Card runtime and loan agent (Phase 8) | Lender use case: apply reviewed cards to loan files with version selection and lineage | user 2026-10-15 | Spec written first (`docs/specs/card-runtime.md`); UI untouched |
| X3 | Planned: policy map review step (slots, parameters, coverage) | `docs/approach.md` — highest-value review gate | proposed, needs spec amendment | Not started; raise after Phase 3 |

## Open questions

| ID | Question | Spec ref | Resolution |
|---|---|---|---|
| Q1–Q8 | Main spec open questions (stable IDs, inline edit, Amplitude, publish target, multi-doc, audit trail, reject reason, concurrency) | section 16.2 | Q1 and Q2 have proposals in `docs/approach.md` (slot-based IDs, edit log); record answers in `docs/deviations.md` |
| Q12 | Should `policy-card/1.0` carry executable fields, or does the runtime bundle stay the agent's format? | card-runtime R1 | Open; bundle used for now |
| Q9 | Card model mismatch: spec cards have `seq`/`shortId` and free-text fields; pipeline cards have `slot`, `params`, `inputs`, `expr`, `tests` | section 6.1 vs `golden/` | Proposed: adapter (X2) maps slot → shortId by document order and carries pipeline extras in an optional `card.agent` block; no spec type removed |

## Decisions log

| ID | Decision | Why | When |
|---|---|---|---|
| D1 | App lives at repo root (spec 3.2 layout); pipeline dirs sit alongside | One repo, shared JSON schemas; spec folder structure unchanged | 2026-10-12 |
| D2 | Density `low`, `palette.css` replaces `app-tokens.css` | Visual spec wins on look (VIS-11) | 2026-10-12 |
| D3 | `SaltProviderNext` + `global.css` + `theme-next.css`; token checks against imported files only | Installed theme reality (`docs/deviations.md` D-S1, D-S2) | 2026-10-12 |
| D5 | No section sign anywhere (data, copy, docs) | User instruction (docs/deviations.md D-C1) | 2026-10-12 |
| D6 | Stepper is a nav of links, not Salt `Stepper` | `Step` cannot be a link; spec 4.8 fallback | 2026-10-12 |
| D7 | Programmatically focused H1 shows no focus ring | Heading is not a control; controls keep Salt's ring (A11Y-04) | 2026-10-12 |
| D8 | Only one filled accent button at a time: Approve is the review CTA; Continue to publish turns solid accent only when publishing is possible | Visual spec 4.3 / 10 (one CTA per view) vs spec 9.3.1; both satisfied | 2026-10-12 |
| D9 | Approve uses the accent colour, not positive green | Visual spec 8.4 overrides colour; green is reserved for the approved state | 2026-10-12 |
| D10 | Step 2 before any run shows "Ready to decompose" with a start button | Spec 9.2.1 has no idle row | 2026-10-12 |
| D11 | A completed step always shows its check, including the current one; `aria-current` marks the screen | Spec 9.4.5 item 3 vs UI-06 current styling | 2026-10-12 |
| D12 | `save.manual` flag drives the 2-second "Draft saved" | Spec 9.1.8; extends D-D1 | 2026-10-12 |
| D13 | `?demo=loaded` and `?demo=review` seeds | Build and test screens out of order (spec 15) | 2026-10-12 |
| D14 | TypeScript pinned to 6.0 | typescript-eslint does not support TS 7 (native port) yet; nothing used TS 7 features | 2026-10-12 |
| D15 | Source pane scrolls the linked passage to the top of the pane, inside the pane only | Deterministic while the workspace height settles; never scrolls the page on phones (UI-34 said "nearest") | 2026-10-12 |
| D4 | Layout measurement uses `ResizeObserver`, never a one-shot mount measurement | Provider applies theme classes after first layout (found in Phase 0) | 2026-10-12 |
