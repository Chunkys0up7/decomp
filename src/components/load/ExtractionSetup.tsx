import { Switch, Text, ToggleButton, ToggleButtonGroup } from "@salt-ds/core";
import { CheckmarkIcon } from "@salt-ds/icons";
import { copy } from "../../app/copy";
import { CARD_TYPES, CHECK_KEYS, type Granularity } from "../../domain/types";
import { useAppState, useDispatch } from "../../store/StoreProvider";
import panel from "../../styles/panel.module.css";
import { TypeGlyph } from "../cards/TypeGlyph";
import styles from "./load.module.css";

/** What to extract, granularity and checks (spec 9.1.7, UI-27, visual spec 8.2). */
export function ExtractionSetup() {
  const { setup } = useAppState();
  const dispatch = useDispatch();

  return (
    <>
      <section className={panel.panel} data-panel aria-labelledby="extract-heading">
        <div>
          <Text styleAs="h3" id="extract-heading">{copy.load.extractTitle}</Text>
          <Text color="secondary">{copy.load.extractHelp}</Text>
        </div>
        <div className={styles.tiles}>
          {CARD_TYPES.map((t) => {
            const on = setup.types[t];
            return (
              <button key={t} type="button" className={styles.tile} aria-pressed={on} onClick={() => dispatch({ type: "SETUP_TOGGLE_TYPE", cardType: t })}>
                <span className={styles.tileTop}>
                  <span className={styles.tileName}><TypeGlyph type={t} size={16} /><Text><strong>{copy.types[t].label}</strong></Text></span>
                  <span className={styles.check} data-on={on} aria-hidden="true">{on && <CheckmarkIcon />}</span>
                </span>
                <Text color="secondary">{copy.types[t].def}</Text>
              </button>
            );
          })}
        </div>
      </section>

      <section className={panel.panel} data-panel aria-labelledby="gran-heading">
        <Text styleAs="h3" id="gran-heading">{copy.load.granularity}</Text>
        <ToggleButtonGroup
          aria-label={copy.load.granularity}
          value={setup.granularity}
          className={styles.granularity}
          onChange={(e) => dispatch({ type: "SETUP_SET_GRANULARITY", granularity: e.currentTarget.value as Granularity })}
        >
          <ToggleButton value="atomic">{copy.load.gran.atomic}</ToggleButton>
          <ToggleButton value="section">{copy.load.gran.section}</ToggleButton>
        </ToggleButtonGroup>
        <Text color="secondary">{copy.load.granHelp[setup.granularity]}</Text>
      </section>

      <section className={panel.panel} data-panel aria-labelledby="checks-heading">
        <Text styleAs="h3" id="checks-heading">{copy.load.checksTitle}</Text>
        <ul className={styles.checks}>
          {CHECK_KEYS.map((k) => (
            <li key={k} className={styles.checkRow}>
              <Switch label={copy.load.checks[k]} checked={setup.checks[k]} onChange={() => dispatch({ type: "SETUP_TOGGLE_CHECK", check: k })} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
