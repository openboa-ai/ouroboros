import type { ComponentProps } from "react";
import {
  OperatorActionRow,
  OperatorPanel,
  OperatorStatusBadge
} from "@/design-system";

export interface TradingSafetyBoundaryBadge {
  label: string;
  variant: ComponentProps<typeof OperatorStatusBadge>["variant"];
}

export function TradingSafetyBoundarySection({
  badges,
  detail
}: {
  badges: TradingSafetyBoundaryBadge[];
  detail: string;
}) {
  return (
    <OperatorPanel aria-label="Safety boundary">
      <OperatorActionRow>
        {badges.map((badge) => (
          <OperatorStatusBadge key={badge.label} value={badge.label} variant={badge.variant} />
        ))}
        <span className="text-sm text-muted-foreground">{detail}</span>
      </OperatorActionRow>
    </OperatorPanel>
  );
}
