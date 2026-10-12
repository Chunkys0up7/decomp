import { Spinner, Text, useAriaAnnouncer } from "@salt-ds/core";
import { CheckmarkIcon, ErrorIcon } from "@salt-ds/icons";
import { useEffect, useRef } from "react";
import { copy } from "../../app/copy";
import { STAGE_IDS, type StageId } from "../../domain/types";
import { useAppState } from "../../store/StoreProvider";
import panel from "../../styles/panel.module.css";
import styles from "./decompose.module.css";

/** The five run stages (spec 9.2.3, 8.4, visual spec 8.3). Announces each stage as it completes. */
export function PipelinePanel() {
  const { run, document: doc } = useAppState();
  const { announce } = useAriaAnnouncer();
  const announced = useRef(new Set<StageId>());

  useEffect(() => {
    if (run.status !== "running") { announced.current.clear(); return; }
    for (const id of STAGE_IDS) {
      if (run.stages[id].status === "done" && !announced.current.has(id)) {
        announced.current.add(id);
        announce(copy.decompose.stageDone(copy.decompose.stages[id].label));
      }
    }
  }, [run, announce]);

  const sections = doc.sections?.length ?? 0;
  const passages = doc.passages?.length ?? 0;
  const describe = (id: StageId) => {
    const stage = copy.decompose.stages[id];
    return typeof stage.done === "function" ? stage.done(sections, passages) : stage.done;
  };

  return (
    <section className={`${panel.panel} ${styles.pipeline}`} data-panel aria-labelledby="pipeline-heading">
      <Text styleAs="h3" id="pipeline-heading">{copy.decompose.pipeline}</Text>
      <ol className={styles.stages}>
        {STAGE_IDS.map((id) => {
          const st = run.stages[id].status;
          return (
            <li key={id} className={styles.stage} data-status={st}>
              <span className={styles.node} data-status={st} aria-hidden="true">
                {st === "done" && <CheckmarkIcon />}
                {st === "running" && <Spinner size="small" />}
                {st === "failed" && <ErrorIcon />}
              </span>
              <span className={styles.stageText}>
                <Text><strong>{copy.decompose.stages[id].label}</strong></Text>
                <Text color="secondary">{describe(id)}</Text>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
