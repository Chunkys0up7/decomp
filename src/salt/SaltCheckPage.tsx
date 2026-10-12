import { Button, Checkbox, FormField, FormFieldHelperText, FormFieldLabel, H1, H2, Input, StackLayout, Switch, Text, Tooltip } from "@salt-ds/core";
import { useEffect, useRef, useState } from "react";
import mono from "../styles/mono.module.css";
import styles from "./SaltCheckPage.module.css";

// Phase 0 gate (spec 4.9, visual spec 11.2). Developer page: strings are not product copy.
const SPACING_TOKENS = ["25", "50", "75", "100", "150", "200", "250", "300", "400", "500", "600", "800"];

function SpacingProbe() {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});

  // Measure with a ResizeObserver, not once on mount: the provider applies the theme classes after
  // the first layout, so tokens do not resolve yet on the first pass.
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setWidths((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          const token = (e.target as HTMLElement).dataset.probe;
          if (token) next[token] = Math.round(e.contentRect.width * 100) / 100;
        }
        return next;
      });
    });
    for (const el of Object.values(refs.current)) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <table className={styles.probeTable} data-testid="spacing-probe">
      <thead>
        <tr><th scope="col">Token</th><th scope="col">Box</th><th scope="col">Resolved px</th></tr>
      </thead>
      <tbody>
        {SPACING_TOKENS.map((t) => (
          <tr key={t}>
            <td className={mono.mono}>--salt-spacing-{t}</td>
            <td><div ref={(el) => { refs.current[t] = el; }} data-probe={t} className={styles.probeBox} style={{ width: `var(--salt-spacing-${t})` }} /></td>
            <td className={mono.mono} data-token={`--salt-spacing-${t}`} data-px={widths[t] ?? ""}>{widths[t] ?? "…"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SaltCheckPage() {
  const [checked, setChecked] = useState(true);
  const [switched, setSwitched] = useState(true);
  return (
    <main className={styles.page}>
      <section className={styles.panel} data-panel>
        <StackLayout gap={3}>
          <H1>Salt check</H1>
          <Text color="secondary">Phase 0 smoke test. Every control below must render styled, in Open Sans, with tokens resolving inside portals.</Text>

          <div className={styles.row}>
            <Button data-testid="primary-button" appearance="solid" sentiment="accented">Primary action</Button>
            <Button appearance="bordered" sentiment="neutral">Secondary action</Button>
            <Tooltip content="Tooltip portal probe" open placement="right">
              <Button appearance="transparent" sentiment="neutral">Tooltip anchor</Button>
            </Tooltip>
          </div>

          <FormField>
            <FormFieldLabel>Policy ID</FormFieldLabel>
            <Input defaultValue="POL-HL-0142" />
            <FormFieldHelperText>Helper text</FormFieldHelperText>
          </FormField>

          <div className={styles.row}>
            <Checkbox label="Checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <Switch label="Switch" checked={switched} onChange={(e) => setSwitched(e.target.checked)} />
          </div>

          <div data-testid="token-probe" className={styles.tokenProbe}>
            <Text className={mono.mono}>token probe: padding var(--salt-spacing-100), Salt container background</Text>
          </div>
        </StackLayout>
      </section>

      <section className={styles.panel} data-panel>
        <StackLayout gap={2}>
          <H2>Spacing map at this density</H2>
          <SpacingProbe />
        </StackLayout>
      </section>
    </main>
  );
}
