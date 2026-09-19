import { describe, expect, it, vi } from "vitest";
import { openNotificationSource } from "./open-source";
import type { ScreenContext } from "@/app/Workspace";
import type { NotificationLocation } from "./model";

const source = { work_id: "work", execution_id: "execution", intent_id: "original-intent" };
function actions() {
  return { open: vi.fn(), discuss: vi.fn(), navigate: vi.fn() } as unknown as ScreenContext;
}
function location(destination: NotificationLocation["destination"]): NotificationLocation {
  return { destination, notificationId: "event:3", sequence: 3, source };
}
describe("notification primary source navigation", () => {
  it.each([["system", "control-request"], ["library", "publication"], ["agents", "execution"]] as const)(
    "opens the %s primary record when execution and intent references coexist", (destination, kind) => {
      const a = actions(); openNotificationSource(location(destination), a);
      expect(a.open).toHaveBeenCalledExactlyOnceWith({ kind, id: kind === "execution" ? "execution" : "original-intent", workId: "work" });
    });
  it("preserves a message reference when a notification also names its execution", () => {
    const a = actions();
    openNotificationSource({ ...location("conversations"), source: { ...source, conversation_id: "room", message_id: "message" } }, a);
    expect(a.discuss).toHaveBeenCalledWith({ label: "Referenced message", target: { kind: "conversation", id: "room", messageId: "message", workId: "work" } });
    expect(a.open).not.toHaveBeenCalled();
  });
  it("does not substitute a secondary execution for an unavailable control reference", () => {
    const a = actions(); openNotificationSource({ ...location("system"), source: { execution_id: "execution" } }, a);
    expect(a.navigate).toHaveBeenCalledWith("system"); expect(a.open).not.toHaveBeenCalled();
  });
});
