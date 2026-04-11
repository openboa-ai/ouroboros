import type {
  AutomationStatus,
  ImportPreflightSeverity,
  ImportPreflightStatus
} from "./service-contract";

export type StatusTone = "positive" | "warning" | "danger" | "neutral";

export function automationStatusTone(status: AutomationStatus): StatusTone {
  switch (status) {
    case "active":
      return "positive";
    case "paused":
      return "warning";
    case "degraded":
      return "warning";
    case "intervention":
      return "danger";
  }
}

export function importPreflightStatusTone(status: ImportPreflightStatus): StatusTone {
  switch (status) {
    case "ready":
      return "positive";
    case "blocked":
      return "danger";
  }
}

export function importPreflightSeverityTone(
  severity: ImportPreflightSeverity
): StatusTone {
  switch (severity) {
    case "ok":
      return "positive";
    case "warning":
      return "warning";
    case "blocked":
      return "danger";
  }
}
