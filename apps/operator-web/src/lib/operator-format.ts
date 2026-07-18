const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const PERCENT_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export function formatMoney(value: number | undefined): string {
  return value === undefined ? "Unavailable" : `${MONEY_FORMATTER.format(value)} USDT`;
}

export function formatPercent(value: number | undefined): string {
  return value === undefined ? "Unavailable" : `${PERCENT_FORMATTER.format(value)}%`;
}

export function formatTimestamp(value: string | undefined): string {
  if (!value) {
    return "Unavailable";
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : TIMESTAMP_FORMATTER.format(date);
}

export function formatStatus(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatCompactId(value: string | undefined): string {
  if (!value) {
    return "Unavailable";
  }
  return value.length <= 20 ? value : `${value.slice(0, 8)}...${value.slice(-6)}`;
}
