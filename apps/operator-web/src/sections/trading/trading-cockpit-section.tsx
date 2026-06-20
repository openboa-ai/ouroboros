import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { OperatorSectionHeader } from "@/design-system";

export function TradingCockpitSection({
  candidateName,
  status,
  statusVariant,
  children
}: {
  candidateName: string;
  status: string;
  statusVariant: ComponentProps<typeof Badge>["variant"];
  children: ReactNode;
}) {
  return (
    <section className="grid min-w-0 gap-4" aria-label="Trading cockpit">
      <OperatorSectionHeader
        title="Trading cockpit"
        description={candidateName}
        actions={<Badge variant={statusVariant}>{status}</Badge>}
      />
      <div className="grid min-w-0 gap-4">{children}</div>
    </section>
  );
}
