import type { DetailTarget } from "@/app/contracts";
export const members = [
  {
    id: "atlas",
    name: "Atlas",
    role: "CEO",
    responsibility: "Investment oversight",
    work: "reconcile",
  },
  {
    id: "nova",
    name: "Nova",
    role: "Research agent",
    responsibility: "Funding cost research",
    work: "funding",
  },
] as const;
export const work = [
  {
    id: "reconcile",
    member: "atlas",
    title: "Reconcile the latest fill",
    result: "Filled quantity matched to the order receipt.",
    next: "Next order observation",
    execution: "run-atlas",
  },
  {
    id: "funding",
    member: "nova",
    title: "Review funding costs",
    result: "Comparison published; source validation continues.",
    next: "Complete source coverage check",
    execution: "run-nova",
  },
] as const;
export const trace = [
  {
    id: "self-nova",
    member: "nova",
    time: "20:43:08",
    tool: "execution_self",
    source: "Gateway · managed MCP",
    result: "Execution identity confirmed",
    target: { kind: "execution", id: "run-nova" },
    payload: {
      input: {},
      output: { execution_id: "run-nova", instance_id: "instance-nova-02" },
    },
  },
  {
    id: "input",
    member: "nova",
    time: "20:44:12",
    tool: "read_input",
    source: "Managed MCP · Company DB",
    result: "2 source records read",
    target: { kind: "work", id: "funding" },
    payload: {
      input: { work: "funding" },
      output: { records: 2, source: "retained funding observations" },
    },
  },
  {
    id: "self-atlas",
    member: "atlas",
    time: "20:45:03",
    tool: "execution_self",
    source: "Gateway · managed MCP",
    result: "Execution identity confirmed",
    target: { kind: "execution", id: "run-atlas" },
    payload: {
      input: {},
      output: { execution_id: "run-atlas", instance_id: "instance-atlas-01" },
    },
  },
  {
    id: "result",
    member: "nova",
    time: "20:46:21",
    tool: "record_result",
    source: "Managed MCP · Company DB",
    result: "1 result stored · receipt db-047",
    target: { kind: "work", id: "funding" },
    payload: {
      input: { comparison: "funding-review" },
      output: { rows_written: 1, receipt_id: "db-047" },
    },
  },
  {
    id: "publish",
    member: "nova",
    time: "20:48:09",
    tool: "file.publish",
    source: "Catalog · publication receipt",
    result: "Funding comparison published · revision 8",
    target: { kind: "artifact", id: "funding-review" },
    payload: {
      input: { workspace: "treasury", path: "reports/funding-review.md" },
      output: { revision: 8, receipt_id: "publish-008" },
    },
  },
] satisfies {
  id: string;
  member: string;
  time: string;
  tool: string;
  source: string;
  result: string;
  target: DetailTarget;
  payload: object;
}[];

export const history = [
  {
    id: "h1",
    member: "nova",
    time: "Sep 13 · 20:48",
    title: "Funding report published",
    detail:
      "Revision 8 retained. Source coverage validation remains in progress.",
    target: { kind: "artifact", id: "funding-review", revision: 8 },
  },
  {
    id: "h2",
    member: "atlas",
    time: "Sep 13 · 20:47",
    title: "Investment review updated",
    detail: "The next fill observation is the recorded reassessment condition.",
    target: { kind: "decision", id: "position-review" },
  },
  {
    id: "h3",
    member: "nova",
    time: "Sep 13 · 20:42",
    title: "Research execution started",
    detail:
      "A distinct execution serves the existing funding research responsibility.",
    target: { kind: "execution", id: "run-nova" },
  },
  {
    id: "h4",
    member: "atlas",
    time: "Sep 12 · 09:00",
    title: "Operating assignment retained",
    detail:
      "Atlas remains accountable across executions. No handover is recorded in this sample.",
    target: { kind: "member", id: "atlas" },
  },
] as const;
