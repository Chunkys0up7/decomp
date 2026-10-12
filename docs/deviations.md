# Deviations and open questions

Deviations from `policy-cards-build-spec.md` and `policy-cards-visual-agent.md`, with reasons. The compliance tracker (`SPEC-COMPLIANCE.md`) links here.

## Deviations

| ID | Spec item | What we do instead | Why |
|---|---|---|---|
| D-S1 | SALT-07, section 4.4 step 3: import `@salt-ds/theme/index.css` with `SaltProvider` | Import `css/global.css` + `css/theme-next.css` with `SaltProviderNext` | In theme 1.47 `index.css` is the legacy theme. Visual spec 5.1 asks for `SaltProviderNext` with `corner="rounded"` when available; the installed changelog documents this pairing |
| D-S2 | Appendix C `verify-tokens.mjs` scans every CSS file in `@salt-ds/theme` | Scans only the imported theme files | Tokens that exist only in the legacy theme would pass the check and resolve to nothing at run time |
| D-S3 | section 4.8 `SteppedTracker` / `TrackerStep`, `TabsNext` family | `Stepper` / `Step`, `Tabs` / `TabList` / `Tab` / `TabPanel` | Spec names not exported by core 1.72 (spec allowed for this: "VERIFY") |
| D-S4 | Visual spec 4.2 token names (`actionable-cta-*`, `status-*-foreground`) | Installed names (`actionable-accented-bold-*`, `status-*-foreground-informative`) | Spec names absent from theme; mapping in `docs/salt-api-notes.md` |
| D-V1 | Visual spec 7.2 "20 px between form fields" | 24 px (`--pc-gap-lg`) | Keeps all spacing on named tokens; no 20 px token defined |
| D-V2 | Visual spec 7.3 "`gap={2}` is 16px" | `gap={2}` is 24px at density low | Measured: Salt unit is 12px at `low` (`docs/spacing-map.md`) |
| D-T1 | Appendix D Playwright: density default `medium` | Default `low`, passed to the app as `VITE_APP_DENSITY` | Visual spec 7.1 / section 11 |
| D-T2 | Appendix D | Extra assertions: CTA colour, tinted canvas, panel radius and shadow, control radius | Visual spec 11.2 |
| D-C1 | Spec 6.1, Appendix B, copy catalog put the section sign before section numbers and refs (for example before "2.3") | No section sign anywhere: `sectionNo` "2", `ref` "2.3"; UI shows "Section 2 Qualifying income" and refs as "2.3"; artifact `source.section` is "Section 3 Debt-to-income" | User instruction 2026-10-12. Sample converted by `scripts/extract-sample.mjs`, which fails if passage text or offsets would change |
| D-D1 | Spec 7.1 store shape | Two optional fields: `run.stale` (RED-10 "marks the draft as stale") and `publish.exported` (spec 5.2 step 4 completes on publish **or export**) | The spec requires both behaviours but its store shape had nowhere to record them |
| D-D2 | Spec 7.2 action list | Added `EXTRA_DOC_REMOVED` and `PUBLISH_EXPORTED` | Spec 9.1.4 has removable referenced-document pills; spec 5.2 needs export recorded |
| D-D3 | Spec 8.2 mock decompose "returns the Appendix B result" | Returns Appendix B content with `cardId`/`uri` generated from the request metadata | Otherwise editing the policy ID or version makes VAL-03 reject the run (DATA-02 says the pipeline assigns IDs) |
| D-D4 | Spec 8.2 type/check filtering | A `no_card` info issue is added to every uncovered passage that has no passage-level issue after filtering (including p8 when the references check is off) | Keeps DATA-09 / VAL-06 true for every setup; see Q10 |
| D-T3 | TEST-38 repeat the happy path at density `low` vs `medium` | Not run: the visual spec fixes density at `low` and forbids `medium`/`high` (visual spec 7.1, 9 item 3); every test already runs at `low` | Visual spec wins on density |
| D-T4 | Visual spec 10 "panel padding >= 20" | Measured as content inset: the panel's padding, or its first child's when the panel hosts a full-bleed sticky header or table | Review panes, document panel and artifacts table keep padding on inner header/body so headers can stick and tables can run edge to edge |
| D-T5 | Spec 14.2 component tests | After Salt's Dialog closes, jsdom never finishes the close transition, so two TEST-24 checks query the DOM instead of the accessibility tree | The real-browser check of the same behaviour is `e2e/flow.spec.ts` |
| D-D5 | DATA-16 `ajv` "in unit tests and again at publish time" | `ajv` is a runtime dependency | Publish-time validation runs in the browser |

## Open questions (spec 16.2)

| ID | Question | Status |
|---|---|---|
| Q1 | Stable card IDs across versions | Proposal: slot-based IDs + passage fingerprints (`docs/approach.md`). Spec assumes per-run IDs; unchanged for now |
| Q2 | Inline editing before approval | Proposal: `edits[]` log + `modified` state. Not in this build |
| Q3 | Amplitude heading font | Not available; Open Sans used (SALT-08) |
| Q4 | Publish destination | Open |
| Q5 | Multiple source documents | Open; the pilot section cited about twenty other sections, so this will matter |
| Q6 | Reviewer identity and audit trail | Open; recommended for regulated use |
| Q7 | Reject requires a reason | Open |
| Q8 | Concurrency | Out of scope |
| Q10 | TEST-14 "every passage with no card has a `no_card` info issue": p8 already has ISS-03 | Interpreted as passages newly uncovered by filtering get `no_card`; every uncovered passage has some passage-level issue (D-D4) |
| Q11 | Spec 6.2 URI fallback writes `{seq}` unpadded | Padded to 3 digits like the standard form, for one consistent shape |
