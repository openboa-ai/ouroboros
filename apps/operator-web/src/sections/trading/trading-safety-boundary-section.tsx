import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  OperatorActionRow,
  OperatorPanel
} from "@/design-system";

export interface TradingSafetyBoundaryBadge {
  label: string;
  variant: ComponentProps<typeof Badge>["variant"];
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
          <Badge key={badge.label} variant={badge.variant}>
            {badge.label}
          </Badge>
        ))}
        <span className="text-sm text-muted-foreground">{detail}</span>
      </OperatorActionRow>
    </OperatorPanel>
  );
}
