import type { ReactNode } from "react";
import { Check, Clock3, CircleHelp } from "lucide-react";
export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  detail: string;
  state: "observed" | "pending" | "unknown";
  action?: ReactNode;
  onOpen?: () => void;
}
/** Observations and unresolved outcomes share one readable chronology, without implying completion. */
export function ActivityTimeline({
  items,
  label,
}: {
  items: readonly TimelineItem[];
  label: string;
}) {
  return (
    <ol className="activity-timeline" aria-label={label}>
      {items.map((item) => {
        const Icon =
          item.state === "observed"
            ? Check
            : item.state === "pending"
              ? Clock3
              : CircleHelp;
        return (
          <li key={item.id}>
            <span className="timeline-symbol">
              <Icon size={16} aria-label={item.state} />
            </span>
            <div>
              <div className="timeline-heading">
                {item.onOpen ? (
                  <button
                    className="timeline-title type-control"
                    onClick={item.onOpen}
                  >
                    {item.title}
                    <span aria-hidden="true">↗</span>
                  </button>
                ) : (
                  <span className="type-control">{item.title}</span>
                )}
                <time className="type-meta muted">{item.time}</time>
              </div>
              <p className="type-data muted">{item.detail}</p>
              {item.action}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
