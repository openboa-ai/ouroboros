import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import {
  OperatorField,
  OperatorFieldGrid,
  OperatorPanel,
  OperatorResponsiveSplit,
  OperatorSectionHeader,
  OperatorStatusBadge
} from "@/design-system";

export interface TradingPromotionBoundaryBadge {
  label: string;
  variant: ComponentProps<typeof OperatorStatusBadge>["variant"];
}

export interface TradingPromotionBoundaryField {
  label: string;
  value: string;
}

export function TradingPromotionBoundarySection({
  badges,
  fields,
  showOpenActiveTarget,
  openActiveTargetDisabled,
  promoteDisabled,
  promoteLabel,
  onOpenActiveTarget,
  onPromoteTradingCandidate
}: {
  badges: TradingPromotionBoundaryBadge[];
  fields: TradingPromotionBoundaryField[];
  showOpenActiveTarget: boolean;
  openActiveTargetDisabled: boolean;
  promoteDisabled: boolean;
  promoteLabel: string;
  onOpenActiveTarget?: () => void;
  onPromoteTradingCandidate?: () => void;
}) {
  return (
    <OperatorPanel aria-label="Trading promotion boundary">
      <OperatorSectionHeader
        eyebrow="Promotion boundary"
        title="Trading review candidate"
        description="Arena candidates become Trading review candidates only after selected paper evidence exists. This does not enable live authority."
        actions={(
          <>
            {badges.map((badge) => (
              <OperatorStatusBadge key={badge.label} value={badge.label} variant={badge.variant} />
            ))}
          </>
        )}
      />
      <OperatorResponsiveSplit
        breakpoint="lg"
        align="start"
        actions={(
          <>
            {showOpenActiveTarget && (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenActiveTarget}
                disabled={openActiveTargetDisabled || !onOpenActiveTarget}
              >
                Open Trading review candidate
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={onPromoteTradingCandidate}
              disabled={promoteDisabled || !onPromoteTradingCandidate}
            >
              {promoteLabel}
            </Button>
          </>
        )}
      >
        <OperatorFieldGrid density="dense">
          {fields.map((field) => (
            <OperatorField key={field.label} label={field.label} value={field.value} />
          ))}
        </OperatorFieldGrid>
      </OperatorResponsiveSplit>
    </OperatorPanel>
  );
}
