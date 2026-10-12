import { Banner, BannerContent, Text } from "@salt-ds/core";
import { Link } from "react-router-dom";
import { copy } from "../../app/copy";
import type { Severity } from "../../domain/types";
import { useAppState } from "../../store/StoreProvider";
import panel from "../../styles/panel.module.css";
import { SeverityBadge } from "../cards/badges";
import styles from "./decompose.module.css";

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const firstSentence = (s: string) => s.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? s;

/** Issues found, by severity then ID (spec 9.2.3). Each links to where it is resolved. */
export function IssuesPanel() {
  const { result } = useAppState();
  const issues = [...(result?.issues ?? [])].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.id.localeCompare(b.id));

  return (
    <section className={`${panel.panel} ${styles.issues}`} data-panel aria-labelledby="issues-found-heading">
      <Text styleAs="h3" id="issues-found-heading">{copy.decompose.issuesTitle}</Text>
      {issues.length === 0 ? (
        <Banner status="success" className={panel.banner}><BannerContent><Text>{copy.decompose.noIssuesFound}</Text></BannerContent></Banner>
      ) : (
        <ul className={styles.issueList}>
          {issues.map((i) => (
            <li key={i.id}>
              <Link
                to={i.cardIds[0] ? `/review?card=${i.cardIds[0]}` : "/review?filter=attention"}
                className={styles.issueCard}
                data-severity={i.severity}
              >
                <span className={styles.issueTop}>
                  <SeverityBadge severity={i.severity} />
                  <Text><strong>{i.title}</strong></Text>
                </span>
                <Text color="secondary">{firstSentence(i.detail)}</Text>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
