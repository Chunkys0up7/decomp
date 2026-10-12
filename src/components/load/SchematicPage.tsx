import type { Passage } from "../../domain/types";
import styles from "./load.module.css";

// Schematic page (spec A.2): a picture of the document's structure, not a render of the file.
const INNER_HEIGHT = 284 - 2 * 20;
const GAP = 6;

interface Line {
  kind: "title" | "subtitle" | "section" | "passage";
  width: number;
  height: number;
  marginTop: number;
}

export function schematicLines(passages: readonly Passage[]): Line[] {
  const lines: Line[] = [
    { kind: "title", width: 60, height: 10, marginTop: 0 },
    { kind: "subtitle", width: 40, height: 5, marginTop: 0 },
  ];
  let used = 10 + GAP + 5;
  const fits = (l: Line) => used + GAP + l.marginTop + l.height <= INNER_HEIGHT;
  const add = (l: Line) => { if (!fits(l)) return false; lines.push(l); used += GAP + l.marginTop + l.height; return true; };

  let section: string | undefined;
  for (const p of passages) {
    if (p.sectionNo !== section) {
      section = p.sectionNo;
      if (!add({ kind: "section", width: 35, height: 4, marginTop: 10 })) return lines;
    }
    const count = Math.min(4, Math.max(2, Math.ceil(p.text.length / 70)));
    for (let i = 0; i < count; i++) {
      const last = i === count - 1;
      const line = { kind: "passage" as const, width: last ? 40 + ((p.text.length % 70) / 70) * 60 : 100, height: 4, marginTop: i === 0 ? 8 : 0 };
      if (!add(line)) return lines;
    }
  }
  return lines;
}

export function SchematicPage({ passages }: { passages: readonly Passage[] }) {
  return (
    <div className={styles.page} aria-hidden="true">
      {schematicLines(passages).map((l, i) => (
        <span key={i} className={styles.line} data-kind={l.kind} style={{ width: `${l.width}%`, height: l.height, marginTop: l.marginTop }} />
      ))}
    </div>
  );
}
