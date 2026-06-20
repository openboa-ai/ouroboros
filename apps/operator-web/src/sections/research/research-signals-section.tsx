import {
  OPERATOR_DESIGN_TOKENS,
  OperatorPanel,
  OperatorSectionHeader,
  OperatorStat
} from "@/design-system";

export interface ResearchSignalMetric {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}

export function ResearchSignalsSection({
  reviewSignal,
  metrics
}: {
  reviewSignal: ResearchSignalMetric;
  metrics: ResearchSignalMetric[];
}) {
  return (
    <OperatorPanel aria-label="Research signals">
      <OperatorSectionHeader
        title="Research signals"
        description="Research-facing quality, risk posture, and packet signal for the next candidate cycle."
      />
      <div className="grid min-w-0 gap-3">
        <OperatorStat
          label={reviewSignal.label}
          value={reviewSignal.value}
          detail={reviewSignal.detail}
          className={reviewSignal.className}
        />
        <section
          data-operator-ui="research-signal-grid"
          className={OPERATOR_DESIGN_TOKENS.layout.statGrid}
          aria-label="Research signal metrics"
        >
          {metrics.map((metric) => (
            <OperatorStat
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              className={metric.className}
            />
          ))}
        </section>
      </div>
    </OperatorPanel>
  );
}
