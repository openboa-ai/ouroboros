import type { ReactNode } from "react";
export function SectionHeading({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2 className="type-section">{title}</h2>
        {note && <p className="type-meta muted">{note}</p>}
      </div>
      {action}
    </div>
  );
}
