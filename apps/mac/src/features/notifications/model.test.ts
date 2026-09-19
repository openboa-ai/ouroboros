import { describe, expect, it } from "vitest";
import {
  appendNotificationPage, applyNotificationRead, filterNotifications, notificationBadges,
  notificationLocation, notificationReadRequest, readNotificationPage, readNotificationReadReceipt,
  type NotificationCategory, type NotificationItem, type NotificationPage,
} from "./model";

const unread = { total: 10, by_category: { message: 2, execution: 3, control: 4, publication: 1 } };
const item = (category: NotificationCategory = "message", sequence = 42): NotificationItem => ({
  id: "event:" + sequence, sequence, category, kind: "conversation.message_stored",
  received_at: "2026-09-14T10:00:00Z", read_at: null,
  source: { work_id: "work-a", conversation_id: "room-a", message_id: "message-a" },
});
const page = (): NotificationPage => ({
  firm_id: "firm-a", principal_id: "owner-a", items: [item()], unread,
  snapshot_sequence: 50, authority_revision: 7, cursor: null, next_cursor: "opaque:first", has_more: true,
  source: "core_notifications",
});
describe("notification contracts and shared badge counts", () => {
  it("uses server counts rather than loaded records and preserves overlapping view relevance", () => {
    const parsed = readNotificationPage(page());
    expect(parsed.items).toHaveLength(1);
    expect(notificationBadges(parsed.unread)).toEqual({ notifications: 10, conversations: 2, agents: 3, system: 4, library: 1, work: 7 });
    expect(Object.keys(notificationBadges(parsed.unread)!)).not.toContain("company");
  });
  it("distinguishes unavailable counts from observed zero", () => {
    expect(notificationBadges(null)).toBeNull();
    expect(notificationBadges({ total: 0, by_category: { message: 0, execution: 0, control: 0, publication: 0 } })?.notifications).toBe(0);
  });
  it("rejects invalid counts, categories, timestamps and missing continuations", () => {
    expect(() => readNotificationPage({ ...page(), unread: { ...unread, total: 11 } })).toThrow();
    expect(() => readNotificationPage({ ...page(), unread: { ...unread, by_category: { ...unread.by_category, control: -1 } } })).toThrow();
    expect(() => readNotificationPage({ ...page(), items: [{ ...item(), category: "company" }] })).toThrow();
    expect(() => readNotificationPage({ ...page(), items: [{ ...item(), read_at: "yesterday" }] })).toThrow();
    expect(() => readNotificationPage({ ...page(), next_cursor: null })).toThrow();
  });
  it("maps each category to a fixed destination and preserves work context", () => {
    const expected = { message: "conversations", execution: "agents", control: "system", publication: "library" };
    for (const category of Object.keys(expected) as NotificationCategory[]) {
      const location = notificationLocation(item(category));
      expect(location.destination).toBe(expected[category]);
      expect(location.source.work_id).toBe("work-a");
      expect(location.notificationId).toBe("event:42");
      expect(location.source).toEqual(item(category).source);
    }
  });
  it("preserves a private publication's minimal reference without inventing file or module identity", () => {
    const publication = { ...item("publication"), source: { work_id: "work-a", intent_id: "intent-a" } };
    expect(notificationLocation(publication)).toEqual({ destination: "library", notificationId: "event:42", sequence: 42, source: publication.source });
    expect(readNotificationPage({ ...page(), items: [publication] }).items[0].source.workspace_id).toBeUndefined();
  });
  it("filters loaded rows without changing the server aggregate", () => {
    const rows = [item("message"), { ...item("execution", 43), read_at: "2026-09-14T10:01:00Z" }, item("control", 44)];
    expect(filterNotifications(rows, true, "all").map(row => row.id)).toEqual(["event:42", "event:44"]);
    expect(filterNotifications(rows, false, "execution")).toHaveLength(1);
    expect(unread.total).toBe(10);
  });
  it("bounds explicit read requests to at most 100 unique identities", () => {
    expect(notificationReadRequest(["event:42", "event:42"])).toEqual({ ids: ["event:42"] });
    expect(() => notificationReadRequest([])).toThrow();
    expect(() => notificationReadRequest(Array.from({ length: 101 }, (_, i) => "event:" + i))).toThrow();
  });
  it("applies only acknowledged identities and replaces badges from the same server receipt", () => {
    const original = { ...page(), items: [item(), item("execution", 43)] };
    const response = readNotificationReadReceipt({ ids: ["event:42"], read_at: "2026-09-14T10:02:00Z", unread: { total: 9, by_category: { message: 1, execution: 3, control: 4, publication: 1 } } });
    const applied = applyNotificationRead(original, response);
    expect(original.items[0].read_at).toBeNull();
    expect(applied.items[0].read_at).toBe(response.read_at);
    expect(applied.items[1].read_at).toBeNull();
    expect(notificationBadges(applied.unread)?.conversations).toBe(1);
    expect(applyNotificationRead(applied, response)).toEqual(applied);
  });
  it("appends an exact opaque continuation without duplicate rows", () => {
    const first = page();
    const next = { ...first, cursor: "opaque:first", next_cursor: null, has_more: false, items: [item(), item("control", 43)] };
    expect(appendNotificationPage(first, next).items.map(row => row.id)).toEqual(["event:42", "event:43"]);
  });
  it("rejects a continuation from another identity, authority, snapshot or cursor", () => {
    const first = page();
    const next = { ...first, cursor: "opaque:first" };
    for (const change of [{ firm_id: "firm-b" }, { principal_id: "owner-b" }, { authority_revision: 8 }, { snapshot_sequence: 51 }, { cursor: "different" }])
      expect(() => appendNotificationPage(first, { ...next, ...change })).toThrow();
  });
});
