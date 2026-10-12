# Salt API notes (SALT-04)

Installed: `@salt-ds/core` 1.72.0 · `@salt-ds/theme` 1.47.0 · `@salt-ds/icons` 1.18.3 · `@salt-ds/styles` 0.4.1 · `@salt-ds/window` 0.1.2 · React 19.3.0. `@salt-ds/lab` not installed (SALT-02): nothing required lives only in lab.

`npm ls` shows one resolved version of each (SALT-03).

## Provider and theme pairing (SALT-07, visual spec 5.1)

| Spec assumed | Installed reality | Used |
|---|---|---|
| `@salt-ds/theme/index.css` is the J.P. Morgan theme | `index.css` = `global.css` + **legacy** theme + `theme.css` | not imported |
| `SaltProviderNext` pairs with "a theme-next or similar css" | `css/theme-next.css`; CHANGELOG 1.46.0 documents `baseline.css` → `global.css` → `theme-next.css` | ✅ this pairing |

`SaltProviderNext` props (from `salt-provider/SaltProvider.d.ts`): `density` (`high | medium | low | touch | mobile`), `mode`, `corner` (`sharp | rounded`), `accent` (`blue | teal`), `headingFont` / `actionFont` (`Open Sans | Amplitude`), `applyClassesTo`, `enableStyleInjection`, `breakpoints`. App uses `density="low" mode="light" corner="rounded" accent="blue"`.

Theme-next tokens are declared on `.salt-theme.salt-theme-next`; overrides in `palette.css` use `.salt-theme.salt-theme-next[data-mode="light"]` (higher specificity, no `!important`).

**Gotcha (tabs):** `TabList` measures its free width as its parent's width minus every visible sibling. Put it inside `TabBar`; placed directly in `Tabs`, the active `TabPanel` counts as a sibling and every tab but the first collapses into the overflow menu.

**Gotcha (toggle buttons):** `ToggleButton` has a fixed height. In narrow containers let whole buttons wrap (`flex-wrap: wrap`, `white-space: nowrap`); stretching them makes labels wrap and clip.

**Gotcha:** the provider applies theme classes after the first layout. Anything measuring token-driven layout on mount must use a `ResizeObserver` (found by the Phase 0 spacing probe; affects UI-31).

## Component map (spec 4.8) — verified names

| Spec name | Installed | Notes |
|---|---|---|
| `SteppedTracker`, `TrackerStep` | ✗ | Use `Stepper` + `Step`. `Step` props: `label`, `description`, `stage` (`pending | locked | completed | inprogress | active`), `status` (`warning | error`). Steps are not links; the shell stepper wraps them (Phase 2) |
| `TabsNext`, `TabListNext`, `TabNext` | ✗ | Use `Tabs` (`value`, `defaultValue`, `onChange(event, value)`), `TabList`, `Tab` (`value`, `disabled`), `TabPanel` |
| `Button` | ✓ | `appearance` `solid | bordered | transparent`; `sentiment` `accented | neutral | positive | negative | caution`; `focusableWhenDisabled`; `loading`. Legacy `variant` still accepted — not used |
| `FormField` | ✓ | `validationStatus`, `necessity`, `labelPlacement` |
| `Text` | ✓ | `styleAs` `h1…h4 | label | display1…4 | notation | action | code`; `color` `primary | secondary | inherit | <status>` |
| `Tooltip` | ✓ | `content`, `open`, `placement`, `status`, `disabled` |
| `Banner` | ✓ | `status`, `variant`; content via `BannerContent`, actions via `BannerActions` |
| `InteractableCard` | ✓ | `value`, `disabled`; selection via group — tile behaviour decided in Phase 5 (UI-27) |
| `ToggleButtonGroup` / `SegmentedButtonGroup` | ✓ | `value`, `onChange`, `appearance`, `sentiment` |
| `Switch`, `Checkbox` | ✓ | `label`, `checked`, `onChange`. Do not combine `checked` and `defaultChecked` (React warning seen in Phase 0) |
| `Pill`, `Badge`, `StatusIndicator` | ✓ | `StatusIndicator status`; `Badge value` |
| `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` | ✓ | |
| `Dialog`, `DialogHeader`, `DialogContent`, `DialogActions` | ✓ | also `DialogCloseButton` |
| `LinearProgress`, `CircularProgress`, `Spinner` | ✓ | |
| `FileDropZone`, `FileDropZoneIcon`, `FileDropZoneTrigger` | ✓ (core, not lab) | |
| `useAriaAnnouncer`, `AriaAnnouncerProvider` | ✓ | |
| Layouts `StackLayout`, `FlowLayout`, `GridLayout`, `SplitLayout`, `BorderLayout` | ✓ | `gap` is in Salt spacing units: **1 unit = 12px at density low** (docs/spacing-map.md) |

Icons verified: `CheckmarkIcon`, `CloseIcon`, `ErrorIcon`, `ErrorSolidIcon`, `WarningIcon`, `WarningSolidIcon`, `InfoIcon`, `InfoSolidIcon`, `SuccessTickIcon`, `UploadIcon`, `DownloadIcon`, `ArrowRightIcon`, `ChevronRightIcon`, `DocumentIcon`, `CopyIcon`.

## Token names (visual spec 1.3)

Full list: `docs/salt-tokens.txt` (1,505 tokens). Expected names that do not exist, and what is used instead:

| Spec name | Installed equivalent |
|---|---|
| `--salt-actionable-cta-background(-hover/-active)`, `-foreground` | `--salt-actionable-accented-bold-background(-hover/-active)`, `--salt-actionable-accented-bold-foreground(-hover/-active)`, `-borderColor*` (read by `.saltButton-accented.saltButton-solid`) |
| `--salt-status-{info,success,warning,error}-foreground` | `--salt-status-*-foreground-informative` (text) and `-foreground-decorative` (icons) |
| `--salt-content-foreground-disabled` | not used |
| `--salt-size-cornerRadius-*` | `--salt-palette-corner-weak … -strongest` (set by `corner="rounded"`) |

Code font token: `--salt-text-code-fontFamily` (PT Mono), used only in `src/styles/mono.module.css`.

Amplitude (SALT-08): not installed and not on npm. `headingFont`/`actionFont` stay at the default Open Sans.
