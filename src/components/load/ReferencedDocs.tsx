import { FileDropZone, FileDropZoneTrigger, Pill, Text } from "@salt-ds/core";
import { CloseIcon, UploadIcon } from "@salt-ds/icons";
import { copy } from "../../app/copy";
import { useAppState, useDispatch } from "../../store/StoreProvider";
import { ACCEPT } from "./DocumentPanel";
import styles from "./load.module.css";

/** "Add a referenced document" strip (spec 9.1.4). Files go to the decomposition adapter unparsed. */
export function ReferencedDocs() {
  const { document: doc } = useAppState();
  const dispatch = useDispatch();
  if (doc.status !== "ready") return null;

  const add = (files: File[]) => {
    for (const f of files) dispatch({ type: "EXTRA_DOC_ADDED", name: f.name, sizeBytes: f.size });
  };

  return (
    <div className={styles.extras}>
      <FileDropZone className={styles.strip} aria-label={copy.load.extraDropLabel} onDrop={(_e, files) => add(files)}>
        <UploadIcon size={1.5} aria-hidden />
        <span className={styles.stripText}>
          <Text><strong>{copy.load.extraTitle}</strong></Text>
          <Text color="secondary">{copy.load.extraHelp}</Text>
        </span>
        <FileDropZoneTrigger accept={ACCEPT} multiple appearance="transparent" sentiment="accented" onChange={(_e, files) => add(files)}>
          {copy.load.browse}
        </FileDropZoneTrigger>
      </FileDropZone>
      {doc.extraDocuments.length > 0 && (
        <div className={styles.pills}>
          {doc.extraDocuments.map((d) => (
            <Pill key={d.name} aria-label={copy.load.removeFile(d.name)} onClick={() => dispatch({ type: "EXTRA_DOC_REMOVED", name: d.name })}>
              {d.name}
              <CloseIcon aria-hidden />
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
