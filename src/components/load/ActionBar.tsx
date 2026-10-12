import { Button, Text, Tooltip } from "@salt-ds/core";
import { ArrowRightIcon } from "@salt-ds/icons";
import { copy } from "../../app/copy";
import { isMetaValid } from "../../domain/meta";
import { CHECK_KEYS, CARD_TYPES } from "../../domain/types";
import { useAppState, useSaveNow } from "../../store/StoreProvider";
import styles from "./load.module.css";

interface Props {
  onDecompose: () => void;
  /** Called when Decompose is pressed while blocked, so every invalid field shows its error (UI-20). */
  onBlockedAttempt: () => void;
}

/** Sticky action bar (spec 9.1.8). Decompose explains the first unmet requirement. */
export function ActionBar({ onDecompose, onBlockedAttempt }: Props) {
  const state = useAppState();
  const saveNow = useSaveNow();
  const { setup } = state;
  const types = CARD_TYPES.filter((t) => setup.types[t]).length;
  const checks = CHECK_KEYS.filter((k) => setup.checks[k]).length;

  const blocked =
    state.document.status !== "ready" ? copy.load.blocked.noDoc
    : !isMetaValid(state.meta) ? copy.load.blocked.badMeta
    : types === 0 ? copy.load.blocked.noType
    : undefined;

  return (
    <div className={styles.actionBar}>
      <Text color="secondary">{copy.load.summary(types, setup.granularity, checks)}</Text>
      <div className={styles.actionButtons}>
        <Button appearance="bordered" sentiment="neutral" onClick={() => saveNow()}>{copy.load.saveDraft}</Button>
        {/* Capture fires even though a disabled button ignores clicks. */}
        <span onClickCapture={() => { if (blocked) onBlockedAttempt(); }}>
          <Tooltip content={blocked ?? ""} disabled={!blocked}>
            <Button appearance="solid" sentiment="accented" disabled={Boolean(blocked)} focusableWhenDisabled onClick={onDecompose}>
              {copy.load.decompose}
              <ArrowRightIcon aria-hidden />
            </Button>
          </Tooltip>
        </span>
      </div>
    </div>
  );
}
