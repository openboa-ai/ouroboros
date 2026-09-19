import { useState } from "react";
import { Activity, ArrowRight, Check, FileCheck, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/primitives/select";
import { Tabs, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import { EmptyState, SectionHeading } from "@/ui/components/patterns";
import {
  filterNotifications, notificationCategories, notificationCategoryLabels, notificationLocation,
  notificationReadRequest, notificationTitle,
  type NotificationFilter, type NotificationLocation, type NotificationPage, type NotificationReadReceipt,
} from "./model";
import "@/features/home/home.css";
import "./notifications.css";
const categoryIcons={message:MessageCircle,execution:Activity,control:ShieldCheck,publication:FileCheck};

export interface NotificationsScreenProps {
  /** Controlled shared state: the owner updates this and menu badges only after server acknowledgement. */
  page: NotificationPage | null;
  loading?: boolean;
  error?: string;
  read: (ids: string[]) => Promise<NotificationReadReceipt>;
  open: (location: NotificationLocation) => void;
  loadMore: () => Promise<void>;
  refresh?: () => Promise<void>;
  sourceLabel?: string;
}
/** Reading a notification does not resolve its event, approve a control or open an agent session. */
export function NotificationsScreen({ page, loading = false, error, read, open, loadMore, refresh, sourceLabel="Counts cover the server notification scope" }: NotificationsScreenProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [category, setCategory] = useState<NotificationFilter>("all");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const items = filterNotifications(page?.items ?? [], unreadOnly, category);
  const shownUnread = items.filter(item => item.read_at === null);
  const readIds = shownUnread.slice(0, 100).map(item => item.id);
  const disabled = busy || loading;
  async function mark(ids: string[]) {
    if (disabled || !ids.length) return;
    setBusy(true); setActionError("");
    try {
      const requested = notificationReadRequest(ids).ids;
      const receipt = await read(requested);
      if (requested.some(id => !receipt.ids.includes(id))) setActionError("Some read states were not acknowledged. Refresh to check them.");
    } catch { setActionError("Read status could not be confirmed. The retained notification state is unchanged."); }
    finally { setBusy(false); }
  }
  async function request(action: () => Promise<void>) {
    if (disabled) return;
    setBusy(true); setActionError("");
    try { await action(); }
    catch { setActionError("Notifications could not be refreshed. Retained records remain visible."); }
    finally { setBusy(false); }
  }
  return <div className="home-screen notifications-screen" aria-busy={disabled}>
    <SectionHeading title={page ? page.unread.total + " unread" : "Unread count unavailable"}
      action={refresh && <Button variant="ghost" disabled={disabled} onClick={() => void request(refresh)}><RefreshCw size={14} />Refresh</Button>} />
    <div className="home-toolbar">
      <div className="detail-toolbar">
        <Tabs value={unreadOnly ? "unread" : "all"} onValueChange={value => setUnreadOnly(value === "unread")}>
          <TabsList aria-label="Notification read filter"><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="unread">Unread</TabsTrigger></TabsList>
        </Tabs>
        <Select value={category} onValueChange={value => value && setCategory(value as NotificationFilter)}>
          <SelectTrigger aria-label="Notification category"><SelectValue>{category==="all"?"All categories":notificationCategoryLabels[category]}</SelectValue></SelectTrigger>
          <SelectContent><SelectItem value="all">All categories</SelectItem>{notificationCategories.map(value => <SelectItem key={value} value={value}>{notificationCategoryLabels[value]}{page ? " · " + page.unread.by_category[value] + " unread" : ""}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button variant="secondary" disabled={disabled || !readIds.length} onClick={() => void mark(readIds)}>
        {shownUnread.length > 100 ? "Mark first 100 shown as read" : "Mark shown as read"}
      </Button>
    </div>
    {(error || actionError) && <p role="alert" className="type-data">{actionError || error}</p>}
    {loading && <p role="status" className="type-data muted">{page ? "Refreshing notifications…" : "Loading notifications…"}</p>}
    {!page && !loading && !error && <EmptyState title="Notifications not observed" detail="No notification response is available for this company." />}
    {page && !items.length && <EmptyState title={unreadOnly ? "No unread notifications shown" : "No notifications shown"}
      detail={page.has_more ? "More records are available. Load more to continue within this scope." : "No records match the selected read state and category."} />}
    <div className="detail-records" aria-label="Notification records">
      {items.map(item => { const Icon=categoryIcons[item.category]; return <article className="notification-row" data-unread={item.read_at===null} key={item.id} aria-label={notificationTitle(item)}>
        <span className="notification-icon" aria-hidden="true"><Icon size={18}/>{item.read_at===null&&<span className="notification-dot"/>}</span>
        <div className="record-copy">
          <span className="type-control">{notificationTitle(item)}</span>
          <span className="type-meta muted">{notificationCategoryLabels[item.category]} · <time dateTime={item.received_at} title={item.received_at}>{new Date(item.received_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>{item.source.work_id ? " · Work context attached" : ""}</span>
          {item.status && <span className="type-data muted">{item.status[0].toUpperCase()+item.status.slice(1)}</span>}
        </div>
        <div className="detail-toolbar">
          <span className="type-meta muted">{item.read_at===null?"Unread":"Read"}</span>
          <Button variant="ghost" disabled={disabled} onClick={() => open(notificationLocation(item))} aria-label={"Open source for " + notificationTitle(item)}>Open source<ArrowRight size={14} /></Button>
          <Button variant="ghost" size="icon-sm" disabled={disabled || item.read_at!==null} onClick={() => void mark([item.id])} aria-label={"Mark " + notificationTitle(item) + " as read"}><Check size={14}/></Button>
        </div>
      </article>;})}
    </div>
    {page?.has_more && <div><Button variant="secondary" disabled={disabled} onClick={() => void request(loadMore)}>Load more</Button></div>}
    {page && <p className="type-meta muted">{page.has_more ? "Loaded records only · more available" : "End of this notification snapshot"} · {sourceLabel}</p>}
  </div>;
}
