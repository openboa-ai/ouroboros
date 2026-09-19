import type { ReactNode } from "react";
import { Circle } from "lucide-react";
export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Circle size={24} />
      <h2 className="type-section">{title}</h2>
      <p className="type-body muted">{detail}</p>
      {action}
    </div>
  );
}
