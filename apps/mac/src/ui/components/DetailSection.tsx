import type { ReactNode } from "react";
import { SectionHeading } from "./SectionHeading";
/** One detail rhythm for settings, resources, controls and evidence. */
export function DetailSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <SectionHeading title={title} note={note} />
      {children}
    </section>
  );
}
