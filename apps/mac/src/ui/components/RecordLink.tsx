import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
// UX: ../../../../../docs/design/UI_PURPOSE_CONTRACT.md#c-07
export function RecordLink({
  title,
  meta,
  icon,
  trailing,
  variant = "surface",
  onClick,
}: {
  title: string;
  meta?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  /** Rows navigate a collection; surfaces emphasize a related artifact. */
  variant?: "surface" | "row";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`record-link record-link--${variant}`}
      onClick={onClick}
    >
      {icon && <span className="record-icon">{icon}</span>}
      <span className="record-copy">
        <span className="type-control">{title}</span>
        {meta && <span className="type-meta muted">{meta}</span>}
      </span>
      {trailing}
      <ArrowRight size={14} className="record-arrow" />
    </button>
  );
}
