import { Text } from "@salt-ds/core";
import { copy } from "../../app/copy";
import { useAppState } from "../../store/StoreProvider";
import styles from "./AppHeader.module.css";
import { SaveIndicator } from "./SaveIndicator";

/** App header (spec 5.1): product mark, name, live policy context, save indicator. */
export function AppHeader({ decisions }: { decisions: boolean }) {
  const { document: doc, meta } = useAppState();
  const context = doc.status === "ready" && meta.policyId ? copy.app.context(meta.policyId, meta.version) : copy.app.newDecomposition;

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <Text styleAs="label" className={styles.markText}>{copy.app.mark}</Text>
        </span>
        <Text styleAs="h4">{copy.app.name}</Text>
        <span className={styles.divider} aria-hidden="true" />
        <Text color="secondary" className={styles.context}>{context}</Text>
      </div>
      <SaveIndicator decisions={decisions} />
    </header>
  );
}
