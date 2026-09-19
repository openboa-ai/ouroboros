import { describe, expect, it } from "vitest";
import responses from "./fixtures/server-response.json";
import { applyNotificationRead, notificationBadges, notificationLocation, readNotificationPage, readNotificationReadReceipt } from "./model";

// Synthetic protocol fixture; original live-run evidence is private and outside this checkout.
// This checks the client/server boundary independently of the client-generated fixtures.
describe("Gateway notification response contract", () => {
  it("preserves the server read acknowledgment and the persisted state after restart", () => {
    const page = readNotificationPage(responses.first_page);
    const receipt = readNotificationReadReceipt(responses.read_response);
    const restarted = readNotificationPage(responses.after_restart);
    expect(notificationBadges(page.unread)?.agents).toBe(1);
    expect(applyNotificationRead(page, receipt)).toEqual(restarted);
    expect(notificationBadges(restarted.unread)?.notifications).toBe(0);
    expect(receipt.read_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isFinite(Date.parse(receipt.read_at))).toBe(true);
  });

  it("routes the new stop receipt to its exact source without unread execution duplication", () => {
    const page = readNotificationPage(responses.after_stop);
    expect(page.authority_revision).toBeGreaterThan(responses.first_page.authority_revision);
    expect(notificationBadges(page.unread)).toMatchObject({ notifications: 1, system: 1, work: 1, agents: 0 });
    const location = notificationLocation(page.items[0]);
    expect(location.destination).toBe("system");
    expect(location.source.intent_id).toBe(responses.after_stop.items[0].source.intent_id);
    expect(location.source.execution_id).toBe(responses.after_stop.items[0].source.execution_id);
  });

  it("keeps each original read time when another client already acknowledged an older item", () => {
    const page = readNotificationPage(responses.after_stop);
    const oldTime = responses.read_response.read_at;
    const newTime = "2026-09-14T10:00:00Z";
    const ids = page.items.map(item => item.id);
    const receipt = readNotificationReadReceipt({ ...responses.read_response, ids, read_at: newTime,
      items: [{ id: ids[0], read_at: newTime }, { id: ids[1], read_at: oldTime }] });
    const stalePage = { ...page, items: page.items.map(item => ({ ...item, read_at: null })) };
    expect(applyNotificationRead(stalePage, receipt).items.map(item => item.read_at)).toEqual([newTime, oldTime]);
    expect(() => readNotificationReadReceipt({ ...responses.read_response, items: [] })).toThrow();
  });
});
