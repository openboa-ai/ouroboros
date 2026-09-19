export const artifacts = {
  "position-review": {
    name: "Position review",
    path: "reports/position-review.json",
    revision: 12,
    type: "application/json",
    author: "Atlas",
    account: true,
    content: JSON.stringify(
      {
        record_type: "position_review",
        environment: "synthetic_preview",
        author: "Atlas",
        work: "reconcile",
        written_at: "2026-09-13T20:47:00+09:00",
        contract: "BTCUSDT perpetual",
        position_btc: "0.20",
        observed_partial_fill_btc: "0.05",
        requested_btc: "0.10",
        judgment: "Reconcile the open order before reassessing exposure.",
        next_review_condition: "Fill update",
        evidence: ["sample-position", "sample-buy-order"],
      },
      null,
      2,
    ),
  },
  "funding-review": {
    name: "Funding review",
    path: "reports/funding-review.md",
    revision: 8,
    type: "text/markdown",
    author: "Nova",
    account: false,
    content:
      "# Funding review\n\nAuthor: Nova · Research\nWork: funding\nState: draft research findings\n\n## Question\nWhich funding observations should the company retain for a review?\n\n## Current finding\nCompare observations with their source timestamps and contract scope before drawing a conclusion.\n\n## Evidence limit\nThis synthetic report contains no live funding feed or account observations. It proposes no leverage, trading limit or order.\n\n## Next step\nReview the source coverage with Atlas.\n",
  },
  "weekly-review": {
    name: "Weekly review",
    path: "reports/weekly-review.md",
    revision: 4,
    type: "text/markdown",
    author: "Atlas",
    account: true,
    content:
      "# Weekly portfolio review\n\nAuthor: Atlas · CEO\nPeriod: September 7–13, 2026\nSource: synthetic preview ledger\n\n## Account movement\nOpening account equity: 100,000.00 USDT\nNet deposits: 10,000.00 USDT\nRealized trading result: +3,420.00 USDT\nChange in unrealized result: +360.00 USDT\nTrading fees: −110.00 USDT\nFunding: −20.00 USDT\nTrading P&L: +3,650.00 USDT\nClosing account equity: 113,650.00 USDT\n\n## Coverage\nCompany operating costs of 186.40 USDT are separate. This is not a statement of whole-company profit.\n",
  },
};

export const earlierArtifacts = {
  "position-review": {
    ...artifacts["position-review"],
    revision: 11,
    content: JSON.stringify(
      {
        record_type: "position_review",
        environment: "synthetic_preview",
        author: "Atlas",
        written_at: "2026-09-13T20:30:00+09:00",
        contract: "BTCUSDT perpetual",
        position_btc: "0.15",
        observed_partial_fill_btc: "0.00",
        requested_btc: "0.10",
        judgment: "Wait for the initial fill observation.",
        next_review_condition: "First fill update",
        evidence: ["sample-buy-order"],
      },
      null,
      2,
    ),
  },
  "funding-review": {
    ...artifacts["funding-review"],
    revision: 7,
    content:
      "# Funding review\n\nAuthor: Nova · Research\nSource: synthetic preview\n\n## Question\nWhich funding observations should the company retain?\n\n## Status\nComparison not yet written. Collect source timestamps before evaluating coverage.\n",
  },
  "weekly-review": {
    ...artifacts["weekly-review"],
    revision: 3,
    content:
      "# Weekly portfolio review\n\nAuthor: Atlas · CEO\nSource: synthetic preview\n\n## Status\nPeriod review in preparation. Reconcile capital flows and operating costs before reporting a result.\n",
  },
};
export function artifactAt(id: keyof typeof artifacts, revision?: number) {
  const current = artifacts[id];
  const previous = earlierArtifacts[id];
  return revision === undefined || revision === current.revision
    ? current
    : revision === previous.revision
      ? previous
      : undefined;
}
