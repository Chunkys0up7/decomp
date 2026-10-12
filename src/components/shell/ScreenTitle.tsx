import { H1 } from "@salt-ds/core";
import { useEffect, useRef, type ReactNode } from "react";
import { copy } from "../../app/copy";
import styles from "./ScreenTitle.module.css";

/**
 * The one H1 per screen (A11Y-06). On mount it takes focus and sets the document title
 * (A11Y-01), so each route change lands keyboard and screen-reader users on the new screen.
 */
export function ScreenTitle({ children, pageName, className }: { children: ReactNode; pageName: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${pageName} · ${copy.titles.suffix}`;
    ref.current?.focus({ preventScroll: true });
  }, [pageName]);
  return (
    <H1 ref={ref} tabIndex={-1} className={[styles.title, className].filter(Boolean).join(" ")}>
      {children}
    </H1>
  );
}
