import { FormField, FormFieldHelperText, FormFieldLabel, Input, Text } from "@salt-ds/core";
import { copy } from "../../app/copy";
import { checkField, normaliseField, type MetaField } from "../../domain/meta";
import { useAppState, useDispatch } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import panel from "../../styles/panel.module.css";
import styles from "./load.module.css";

const FIELDS: readonly MetaField[] = ["policyId", "version", "effectiveFrom", "domain", "channel", "owner"];
const MONO: ReadonlySet<MetaField> = new Set(["policyId", "version", "effectiveFrom"]);

/**
 * Policy details (spec 9.1.5, 9.1.6). Errors show after a field is left (UI-20) or after a
 * Decompose attempt; the message is always text, never colour alone. Trim and upper-case on blur (UI-21).
 */
export function PolicyDetails({ showAllErrors }: { showAllErrors: boolean }) {
  const { meta, metaTouched, document: doc } = useAppState();
  const dispatch = useDispatch();
  const disabled = doc.status !== "ready";

  return (
    <section className={panel.panel} data-panel aria-labelledby="details-heading">
      <div className={panel.headingRow}>
        <Text styleAs="h3" id="details-heading">{copy.load.details}</Text>
        <Text color="secondary">{copy.load.detailsHelp}</Text>
      </div>
      <div className={styles.fields}>
        {FIELDS.map((field) => {
          const check = checkField(field, meta[field]);
          const show = !disabled && (showAllErrors || metaTouched[field]);
          const error = show && check.error ? copy.load.errors[field] : undefined;
          const warning = show && !check.error && check.warning ? copy.load.nonStandardId : undefined;
          const helper = error ?? warning ?? (field === "effectiveFrom" && !disabled ? copy.load.dateHelp : undefined);
          return (
            <FormField key={field} disabled={disabled} validationStatus={error ? "error" : warning ? "warning" : undefined}>
              <FormFieldLabel>{copy.load.fields[field]}</FormFieldLabel>
              <Input
                value={meta[field]}
                className={MONO.has(field) ? mono.monoField : undefined}
                inputProps={{ name: field, autoComplete: "off" }}
                onChange={(e) => dispatch({ type: "META_CHANGED", field, value: (e.target as HTMLInputElement).value })}
                onBlur={() => dispatch({ type: "META_CHANGED", field, value: normaliseField(field, meta[field]), touched: true })}
              />
              {helper && <FormFieldHelperText>{helper}</FormFieldHelperText>}
            </FormField>
          );
        })}
      </div>
    </section>
  );
}
