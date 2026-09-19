import type { ReactNode } from "react";
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="detail-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="type-meta muted">{label}</dt>
          <dd className="type-data">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
