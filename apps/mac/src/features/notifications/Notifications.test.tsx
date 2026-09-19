import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationsScreen } from "./Notifications";
import type { NotificationPage } from "./model";
const page: NotificationPage = {
  firm_id: "firm-a", principal_id: "owner-a", items: [{
    id: "event:42", sequence: 42, category: "publication", kind: "resource.publication",
    received_at: "2026-09-14T10:00:00Z", read_at: null, source: { work_id: "work-a", intent_id: "intent-a" }, status: "processing",
  }],
  unread: { total: 7, by_category: { message: 2, execution: 2, control: 2, publication: 1 } },
  snapshot_sequence: 42, authority_revision: 3, cursor: null, next_cursor: "opaque", has_more: true, source: "core_notifications",
};
const callbacks = {
  read: async () => { throw new Error("Read must be explicit"); },
  open: () => { throw new Error("Navigation must be explicit"); },
  loadMore: async () => { throw new Error("Pagination must be explicit"); },
};
describe("controlled notification presentation", () => {
  it("shows source events and server unread counts without claiming publication success", () => {
    const html = renderToStaticMarkup(<NotificationsScreen page={page} {...callbacks} />);
    for (const text of ["7 unread", "Resource publication", "Processing", "Work context attached", "Open source", "Mark shown as read", "Load more"]) expect(html).toContain(text);
    expect(html).not.toContain("Published successfully");
    expect(html).not.toContain("Company pulse");
  });
  it("does not turn initial loading, error or no observation into zero unread", () => {
    const loading = renderToStaticMarkup(<NotificationsScreen page={null} loading {...callbacks} />);
    expect(loading).toContain("Loading notifications");
    expect(loading).not.toContain("0 unread");
    const failure = renderToStaticMarkup(<NotificationsScreen page={null} error="Access unavailable" {...callbacks} />);
    expect(failure).toContain("Access unavailable");
    expect(failure).not.toContain("No notifications shown");
  });
  it("labels partial bulk reads with the actual 100-ID limit", () => {
    const items = Array.from({ length: 101 }, (_, sequence) => ({ ...page.items[0], id: "event:" + sequence, sequence }));
    const html = renderToStaticMarkup(<NotificationsScreen page={{ ...page, items }} {...callbacks} />);
    expect(html).toContain("Mark first 100 shown as read");
    expect(html).not.toContain("Mark all as read");
  });
});
