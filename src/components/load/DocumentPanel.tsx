import { Banner, BannerActions, BannerContent, Button, FileDropZone, FileDropZoneIcon, FileDropZoneTrigger, Spinner, Text } from "@salt-ds/core";
import { CheckmarkIcon } from "@salt-ds/icons";
import { copy } from "../../app/copy";
import { useAppState } from "../../store/StoreProvider";
import mono from "../../styles/mono.module.css";
import panel from "../../styles/panel.module.css";
import styles from "./load.module.css";
import { SchematicPage } from "./SchematicPage";

export const ACCEPT = ".pdf,.docx,.md";

interface Props {
  onFile: (file: File) => void;
  onRetry: () => void;
}

/** Document panel in every state (spec 9.1.3, 9.1.9, visual spec 8.2). */
export function DocumentPanel({ onFile, onRetry }: Props) {
  const { document: doc } = useAppState();
  const take = (files: File[]) => { if (files[0]) onFile(files[0]); };

  const dropHero = (
    <FileDropZone className={styles.hero} aria-label={copy.load.dropLabel} onDrop={(_e, files) => take(files)}>
      <FileDropZoneIcon />
      <Text><strong>{copy.load.dropTitle}</strong></Text>
      <Text color="secondary">{copy.load.dropHelp}</Text>
      <FileDropZoneTrigger accept={ACCEPT} onChange={(_e, files) => take(files)}>{copy.load.browse}</FileDropZoneTrigger>
    </FileDropZone>
  );

  if (doc.status === "empty" || doc.status === "error") {
    return (
      <section className={panel.panel} data-panel aria-label={copy.load.dropTitle}>
        {doc.status === "error" && (
          <Banner status="error" className={panel.banner}>
            <BannerContent><Text>{doc.error?.message ?? copy.errors.unknown}</Text></BannerContent>
            {doc.error?.retryable && <BannerActions><Button appearance="transparent" onClick={onRetry}>{copy.load.retry}</Button></BannerActions>}
          </Banner>
        )}
        {dropHero}
      </section>
    );
  }

  if (doc.status === "loading") {
    return (
      <section className={panel.panel} data-panel aria-busy="true" aria-label={doc.fileName}>
        <div className={styles.loading}>
          <Spinner size="medium" />
          <Text>{copy.load.reading}</Text>
        </div>
      </section>
    );
  }

  const sections = doc.sections ?? [];
  const passages = doc.passages ?? [];
  return (
    <section className={`${panel.panel} ${styles.docPanel}`} data-panel aria-label={doc.fileName}>
      <div className={styles.docHeader}>
        <div className={styles.docName}>
          <Text className={mono.mono}><strong>{doc.fileName}</strong></Text>
          <Text color="secondary">{copy.load.meta(sections.length, passages.length, doc.pageCount)}</Text>
        </div>
        <div className={panel.actions}>
          <Text color="success" className={styles.parsed}><CheckmarkIcon aria-hidden />{copy.load.parsed}</Text>
          <FileDropZoneTrigger accept={ACCEPT} appearance="bordered" sentiment="neutral" onChange={(_e, files) => take(files)}>
            {copy.load.replace}
          </FileDropZoneTrigger>
        </div>
      </div>

      <div className={styles.docBody}>
        <div className={styles.mat}>
          {doc.restoredFromDraft ? (
            <Banner status="info" className={panel.banner}><BannerContent><Text>{copy.load.restoredNote}</Text></BannerContent></Banner>
          ) : (
            <SchematicPage passages={passages} />
          )}
        </div>
        <div className={styles.structure}>
          <div className={panel.headingRow}>
            <Text><strong>{copy.load.structure}</strong></Text>
            <Text color="secondary">{copy.load.structureHint}</Text>
          </div>
          <ul className={styles.sections}>
            {sections.map((s) => (
              <li key={s.no} className={styles.sectionRow}>
                <Text color="secondary" className={mono.mono}>{s.no}</Text>
                <Text><strong>{s.title}</strong></Text>
                <span className={styles.bars} aria-hidden="true">
                  {Array.from({ length: s.passageCount }, (_, i) => <span key={i} className={styles.bar} />)}
                </span>
                <Text color="secondary" className={styles.count}>{copy.load.passageCount(s.passageCount)}</Text>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
