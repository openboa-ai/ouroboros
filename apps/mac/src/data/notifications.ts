import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScopedRefreshQueue } from "./scoped-refresh-queue";
import type { LiveSnapshot } from "./live";
import {
  applyNotificationRead, appendNotificationPage, notificationReadRequest,
  readNotificationPage, readNotificationReadReceipt,
  type NotificationPage, type NotificationReadReceipt,
} from "@/features/notifications/model";

export interface NotificationController {
  page: NotificationPage | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  read: (ids: string[]) => Promise<NotificationReadReceipt>;
}
interface State { key: string; page: NotificationPage | null; loading: boolean; error: string }

/** The server owns notification identity and read state. No inbox or company ledger is stored on this Mac. */
export function useNotifications(snapshot: LiveSnapshot): NotificationController {
  const environment = snapshot.environment_id ?? "";
  const firm = String(snapshot.conditions.firm_id), owner = String(snapshot.conditions.principal_id);
  const generation=snapshot.connection_generation;
  const key = JSON.stringify([environment, firm, owner, generation]);
  const empty = useMemo<State>(() => ({key, page:null, loading:false, error:""}), [key]);
  const [state, setState] = useState<State>(empty);
  const queue = useRef(new ScopedRefreshQueue());
  const currentPage = useRef<NotificationPage | null>(null);
  const visible = state.key === key ? state : empty;

  const load = useCallback(async (more = false) => {
    if (!environment) return;
    const activity = queue.current, ticket = activity.begin();
    if (!ticket) return;
    const previous = currentPage.current;
    setState(previous => ({...(previous.key === key ? previous : empty), loading:true, error:""}));
    try {
      const cursor = more ? previous?.next_cursor : null;
      if (more && !cursor) return;
      const page = readNotificationPage(await invoke("notifications", {expectedEnvironmentId:environment, connectionGeneration:generation, cursor}));
      if (page.firm_id !== firm || page.principal_id !== owner) throw new Error("Notification identity changed.");
      if (!activity.isCurrent(ticket)) return;
      const next = more && previous ? appendNotificationPage(previous, page) : page;
      currentPage.current = next;
      setState({key, page:next, loading:false, error:""});
    } catch {
      if (activity.isCurrent(ticket)) {
        // A failed authorization refresh must not present old access as still current.
        currentPage.current = null;
        setState({key, page:null, loading:false, error:"Notifications could not be observed with this connection. Refresh to check current access."});
      }
    } finally {
      if (activity.isCurrent(ticket)) setState(previous => ({...previous, loading:false}));
      activity.finish(ticket);
    }
  }, [environment, firm, owner, key, empty, generation]);

  useEffect(() => {
    const activity = queue.current;
    currentPage.current = null;
    return () => {activity.invalidate(); currentPage.current = null;};
  }, [key]);
  useEffect(() => { queue.current.request(() => { void load(); }); }, [load, snapshot]);

  async function read(ids: string[]) {
    if (!environment) throw new Error("No notification environment selected.");
    const requested = notificationReadRequest(ids).ids;
    const activity = queue.current, ticket = activity.begin();
    if (!ticket) throw new Error("A notification observation is already in progress.");
    setState(previous => ({...previous, loading:true, error:""}));
    try {
      const receipt = readNotificationReadReceipt(await invoke("read_notifications", {expectedEnvironmentId:environment, connectionGeneration:generation, ids:requested}));
      if (receipt.ids.some(id => !requested.includes(id)) || requested.some(id => !receipt.ids.includes(id))) throw new Error("Read receipt did not acknowledge this request.");
      if (activity.isCurrent(ticket) && currentPage.current) {
        const page = applyNotificationRead(currentPage.current, receipt);
        currentPage.current = page;
        setState({key, page, loading:false, error:""});
      }
      return receipt;
    } catch (error) {
      if (activity.isCurrent(ticket)) setState(previous => ({...previous, loading:false, error:"Read status is unconfirmed. Refresh or repeat the same read action to check it."}));
      throw error;
    } finally {
      activity.finish(ticket);
    }
  }
  return {...visible, refresh:() => load(), loadMore:() => load(true), read};
}
