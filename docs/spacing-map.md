# Spacing map (UI-40)

Measured by the `/__salt-check` spacing probe (`e2e/salt-check.spec.ts` › "spacing map is measurable"), density `low`, dev and production preview identical.

| Salt token | px at `low` |
|---|---|
| `--salt-spacing-25` | 3 |
| `--salt-spacing-50` | 6 |
| `--salt-spacing-75` | 9 |
| `--salt-spacing-100` | 12 |
| `--salt-spacing-150` | 18 |
| `--salt-spacing-200` | 24 |
| `--salt-spacing-250` | 30 |
| `--salt-spacing-300` | 36 |
| `--salt-spacing-400` | 48 |
| `--salt-spacing-500` | 60 |
| `--salt-spacing-600` | 72 |
| `--salt-spacing-800` | 96 |

(For reference, theme-next sets `--salt-spacing-100` to 16 / 12 / 8 / 4 px for touch / low / medium / high.)

## Mapping chosen

The visual spec's minimums (section 7.2) are in multiples of 4px. Salt's scale at `low` is in multiples of 3px, so product CSS uses the `--pc-*` space tokens (exact px) and Salt layout `gap` props only where the multiple lands on the intent:

| Intent | Use |
|---|---|
| 8 px (label → control, list row gap) | `--pc-gap-xs` |
| 12 px (heading → content, issue gap) | `--pc-gap-sm` or layout `gap={1}` |
| 16 px (issue padding) | `--pc-gap-md` |
| 20 px (gap between form fields) | `--pc-gap-lg` (24 px); no 20 px token exists (deviation D-V1) |
| 24 px (panel padding, gap between panels and sections) | `--pc-gap-lg`, `--pc-pad-panel` or layout `gap={2}` |
| 32 px (page gutter) | `--pc-page-gutter` |

**Correction to the visual spec 7.3:** it assumes one Salt layout unit is 8px, so `gap={2}` = 16px and `gap={3}` = 24px. At `low` density one unit is **12px**: `gap={2}` = 24px, `gap={3}` = 36px.
