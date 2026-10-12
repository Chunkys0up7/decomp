import { Button, Text } from "@salt-ds/core";
import { useEffect, useState } from "react";
import { copy } from "../../app/copy";
import { useAppState, useSaveNow } from "../../store/StoreProvider";
import styles from "./AppHeader.module.css";

/** Save indicator (spec 5.4). Idle text changes on the review and publish screens. */
export function SaveIndicator({ decisions }: { decisions: boolean }) {
  const { save } = useAppState();
  const saveNow = useSaveNow();
  // "Draft saved" shows for 2 seconds after Save draft, then the idle text returns.
  const [expired, setExpired] = useState<string | undefined>();
  const justSaved = Boolean(save.manual && save.status === "idle" && save.lastSavedAt !== expired);
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setExpired(save.lastSavedAt), 2000);
    return () => clearTimeout(t);
  }, [justSaved, save.lastSavedAt]);

  return (
    <div className={styles.save} aria-live={save.status === "failed" ? "assertive" : "polite"}>
      {save.status === "saving" && <Text color="secondary">{copy.save.saving}</Text>}
      {save.status === "failed" && (
        <>
          <Text color="error">{copy.save.failed}</Text>
          <Button appearance="transparent" sentiment="neutral" onClick={() => saveNow()}>{copy.save.retry}</Button>
        </>
      )}
      {save.status === "idle" && save.lastSavedAt && (
        <Text color="secondary">{justSaved ? copy.save.saved : decisions ? copy.save.idleReview : copy.save.idle}</Text>
      )}
    </div>
  );
}
