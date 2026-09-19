export const notificationCategories = ["message", "execution", "control", "publication"] as const;
export type NotificationCategory = typeof notificationCategories[number];
export type NotificationFilter = NotificationCategory | "all";
export interface NotificationSource {
  work_id?: string;
  conversation_id?: string;
  message_id?: string;
  execution_id?: string;
  intent_id?: string;
  workspace_id?: string;
  revision?: number;
  [field: string]: unknown;
}
export interface NotificationItem {
  id: string;
  sequence: number;
  category: NotificationCategory;
  kind: string;
  received_at: string;
  read_at: string | null;
  source: NotificationSource;
  status?: string;
}
export interface NotificationUnread {
  total: number;
  by_category: Record<NotificationCategory, number>;
}
export interface NotificationPage {
  firm_id: string;
  principal_id: string;
  items: NotificationItem[];
  unread: NotificationUnread;
  snapshot_sequence: number;
  authority_revision: number;
  cursor: string | null;
  next_cursor: string | null;
  has_more: boolean;
  source: "core_notifications";
}
export interface NotificationReadReceipt { ids: string[]; read_at: string; items?: { id: string; read_at: string }[]; unread: NotificationUnread }
export interface NotificationLocation {
  destination: "conversations" | "agents" | "system" | "library";
  notificationId: string;
  sequence: number;
  source: NotificationSource;
}
export interface NotificationBadges {
  notifications: number;
  conversations: number;
  agents: number;
  system: number;
  library: number;
  work: number;
}
export const notificationCategoryLabels: Record<NotificationCategory, string> = {
  message: "Messages", execution: "Executions", control: "Controls", publication: "Publications",
};
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid " + label + ".");
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid " + label + ".");
  return value;
}
function count(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("Invalid " + label + ".");
  return value;
}
function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (!Number.isFinite(Date.parse(result))) throw new Error("Invalid " + label + ".");
  return result;
}
function cursor(value: unknown): string | null { return value === null ? null : text(value, "notification cursor"); }
export function readNotificationUnread(value: unknown): NotificationUnread {
  const input = object(value, "notification counts"), categories = object(input.by_category, "category counts");
  const by_category = Object.fromEntries(notificationCategories.map(category => [category, count(categories[category], category + " count")])) as NotificationUnread["by_category"];
  const total = count(input.total, "total unread count");
  if (notificationCategories.reduce((sum, category) => sum + by_category[category], 0) !== total) throw new Error("Notification counts do not match their categories.");
  return { total, by_category };
}
function readItem(value: unknown): NotificationItem {
  const input = object(value, "notification"), source = object(input.source, "notification source");
  if (!notificationCategories.includes(input.category as NotificationCategory)) throw new Error("Unknown notification category.");
  for (const key of ["work_id", "conversation_id", "message_id", "execution_id", "intent_id", "workspace_id"])
    if (source[key] !== undefined) text(source[key], key);
  if (source.revision !== undefined) count(source.revision, "publication revision");
  return {
    id: text(input.id, "notification identity"), sequence: count(input.sequence, "event sequence"),
    category: input.category as NotificationCategory, kind: text(input.kind, "event kind"),
    received_at: timestamp(input.received_at, "receipt time"),
    read_at: input.read_at === null ? null : timestamp(input.read_at, "read time"),
    source: { ...source },
    ...(input.status === undefined ? {} : { status: text(input.status, "event status") }),
  };
}
export function readNotificationPage(value: unknown): NotificationPage {
  const input = object(value, "notification page");
  if (input.source !== "core_notifications" || !Array.isArray(input.items) || typeof input.has_more !== "boolean") throw new Error("Unsupported notification response.");
  const items = input.items.map(readItem);
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error("Duplicate notification identities.");
  const next_cursor = cursor(input.next_cursor);
  if (input.has_more && !next_cursor) throw new Error("Notification continuation is missing.");
  return {
    firm_id: text(input.firm_id, "company identity"), principal_id: text(input.principal_id, "owner identity"),
    items, unread: readNotificationUnread(input.unread),
    snapshot_sequence: count(input.snapshot_sequence, "snapshot sequence"),
    authority_revision: count(input.authority_revision, "authority revision"),
    cursor: cursor(input.cursor), next_cursor, has_more: input.has_more, source: "core_notifications",
  };
}
export function notificationReadRequest(ids: readonly string[]): { ids: string[] } {
  const unique = [...new Set(ids.map(id => text(id, "notification identity")))];
  if (!unique.length || unique.length > 100) throw new Error("Choose between 1 and 100 notification identities.");
  return { ids: unique };
}
export function readNotificationReadReceipt(value: unknown): NotificationReadReceipt {
  const input = object(value, "notification read receipt");
  if (!Array.isArray(input.ids) || input.ids.length > 100) throw new Error("Invalid acknowledged notification identities.");
  const ids = input.ids.map(id => text(id, "notification identity"));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate acknowledged identities.");
  const items = input.items === undefined ? undefined : (() => {
    if (!Array.isArray(input.items)) throw new Error("Invalid per-notification read times.");
    const rows = input.items.map(value => {
      const row = object(value, "read acknowledgment");
      return { id: text(row.id, "notification identity"), read_at: timestamp(row.read_at, "read time") };
    });
    if (rows.length !== ids.length || new Set(rows.map(row => row.id)).size !== ids.length || rows.some(row => !ids.includes(row.id))) throw new Error("Read times do not match acknowledged identities.");
    return rows;
  })();
  return { ids, read_at: timestamp(input.read_at, "read time"), ...(items ? { items } : {}), unread: readNotificationUnread(input.unread) };
}
/** Apply only server-acknowledged IDs. Counts are the server aggregate, never a loaded-row subtraction. */
export function applyNotificationRead(page: NotificationPage, receipt: NotificationReadReceipt): NotificationPage {
  const acknowledged = new Set(receipt.ids);
  const readTimes = new Map(receipt.items?.map(item => [item.id, item.read_at]));
  return { ...page, unread: receipt.unread, items: page.items.map(item => acknowledged.has(item.id) ? { ...item, read_at: readTimes.get(item.id) ?? item.read_at ?? receipt.read_at } : item) };
}
export function notificationBadges(unread: NotificationUnread | null | undefined): NotificationBadges | null {
  if (!unread) return null;
  const categories = unread.by_category;
  return {
    notifications: unread.total, conversations: categories.message, agents: categories.execution,
    system: categories.control, library: categories.publication, work: categories.execution + categories.control,
  };
}
/** Routes are fixed generic destinations. Source references are preserved even when detail fields are absent. */
export function notificationLocation(item: NotificationItem): NotificationLocation {
  const destinations = { message: "conversations", execution: "agents", control: "system", publication: "library" } as const;
  return { destination: destinations[item.category], notificationId: item.id, sequence: item.sequence, source: { ...item.source } };
}
export function filterNotifications(items: readonly NotificationItem[], unreadOnly: boolean, category: NotificationFilter): NotificationItem[] {
  return items.filter(item => (!unreadOnly || item.read_at === null) && (category === "all" || item.category === category));
}
/** Append one continuation within the same identity/authority/snapshot; refreshing starts a new page instead. */
export function appendNotificationPage(current: NotificationPage, next: NotificationPage): NotificationPage {
  if (current.firm_id !== next.firm_id || current.principal_id !== next.principal_id ||
      current.authority_revision !== next.authority_revision || current.snapshot_sequence !== next.snapshot_sequence ||
      !current.has_more || current.next_cursor !== next.cursor) throw new Error("Notification continuation does not match the current scope.");
  const seen = new Set(current.items.map(item => item.id));
  return { ...next, items: [...current.items, ...next.items.filter(item => !seen.has(item.id))] };
}
export function notificationTitle(item: NotificationItem): string {
  const titles:Record<string,string>={agent_message:"New agent message",publication_recorded:"Files published",native_turn_completed:"Agent turn completed",native_turn_failed:"Agent turn failed",native_turn_interrupted:"Agent turn interrupted",stop_requested:"Execution stop requested",execution_terminated:"Execution terminated"};
  if(titles[item.kind])return titles[item.kind];
  const value = item.kind.replace(/[._-]+/g, " ");
  return value[0].toUpperCase() + value.slice(1);
}
