// UX: ../../../../../docs/design/UI_PURPOSE_CONTRACT.md#c-06
export function Amount({
  value,
  unit = "",
  role = "data",
  positive = false,
}: {
  value: string;
  unit?: string;
  role?: "amount" | "amount-secondary" | "data";
  positive?: boolean;
}) {
  return (
    <span className={`money ${positive ? "positive" : ""}`}>
      <span className={`type-${role} tabular-nums`}>{value}</span>
      <span className="type-meta money-unit">{unit}</span>
    </span>
  );
}
