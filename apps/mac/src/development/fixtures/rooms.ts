import type { Room } from "@/features/conversations/model";
export const rooms: Room[] = [
  {
    id: "atlas",
    name: "Atlas",
    people: "You · Atlas",
    purpose: "Portfolio direction",
    kind: "personal",
    recipientNames: "Atlas",
    messages: [
      {
        id: "atlas-1",
        author: "Atlas",
        text: "The BTCUSDT position is open. I’m checking the remaining buy order before reassessing exposure.",
        time: "20:47",
        source: {
          label: "Reconcile the BTCUSDT order",
          target: { kind: "work", id: "reconcile" },
        },
      },
      {
        id: "atlas-2",
        author: "Atlas",
        text: "The position review records the current decision and the next review condition.",
        time: "20:48",
        source: {
          label: "Position review · revision 12",
          target: { kind: "artifact", id: "position-review" },
        },
      },
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio review",
    people: "You · Atlas · Nova",
    purpose: "Position and funding context",
    kind: "group",
    recipientNames: "Atlas and Nova",
    messages: [
      {
        id: "portfolio-1",
        author: "Nova",
        text: "The funding review is ready for inspection. It keeps funding observations separate from realized trading results.",
        time: "20:48",
        source: {
          label: "Funding review · revision 8",
          target: { kind: "artifact", id: "funding-review" },
        },
      },
      {
        id: "portfolio-2",
        author: "Atlas",
        text: "I’ll use that review alongside the order reconciliation. The recorded position decision remains the source for our current stance.",
        time: "20:49",
        replyTo: {
          author: "Nova",
          text: "The funding review is ready for inspection.",
        },
        source: {
          label: "Current position decision",
          target: { kind: "decision", id: "position-review" },
        },
      },
    ],
  },
  {
    id: "research",
    name: "Research exchange",
    people: "Atlas · Nova · You",
    purpose: "Agent discussion · funding review",
    kind: "group",
    recipientNames: "Atlas and Nova",
    messages: [
      {
        id: "research-1",
        author: "Atlas",
        text: "Keep the funding assumptions and their observation times with the review so we can inspect the source.",
        time: "20:31",
        source: {
          label: "Funding cost review",
          target: { kind: "work", id: "funding" },
        },
      },
      {
        id: "research-2",
        author: "Nova",
        text: "The review links its source observations and identifies the scope of the comparison.",
        time: "20:48",
        replyTo: {
          author: "Atlas",
          text: "Keep the funding assumptions and their observation times with the review.",
        },
        source: {
          label: "Funding review · revision 8",
          target: { kind: "artifact", id: "funding-review" },
        },
      },
    ],
  },
];
