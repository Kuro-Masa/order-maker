import type { ReactNode } from "react";
import { ChevronIcon } from "../../icons";

export function Accordion({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <details className="accordion">
      <summary>
        {icon}
        {title}
        <ChevronIcon />
      </summary>
      <div className="accordionBody">{children}</div>
    </details>
  );
}
