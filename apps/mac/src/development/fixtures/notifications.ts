import type { NotificationItem, NotificationPage, NotificationUnread } from "@/features/notifications/model";

/** Explicit sample records only; never used as a failed live connection fallback. */
export const notificationFixture: NotificationPage = {
  firm_id:"sample-company", principal_id:"sample-owner", source:"core_notifications",
  snapshot_sequence:4, authority_revision:1, cursor:null, next_cursor:null, has_more:false,
  unread:{total:4,by_category:{message:1,execution:1,control:1,publication:1}},
  items:[
    {id:"event:4",sequence:4,category:"message",kind:"agent_message",received_at:"2026-09-13T11:48:00Z",read_at:null,status:"stored",source:{work_id:"reconcile",conversation_id:"atlas",message_id:"atlas-2"}},
    {id:"event:3",sequence:3,category:"publication",kind:"publication_recorded",received_at:"2026-09-13T11:47:00Z",read_at:null,status:"recorded",source:{work_id:"reconcile",intent_id:"sample-publication"}},
    {id:"event:2",sequence:2,category:"execution",kind:"native_turn_completed",received_at:"2026-09-13T11:46:00Z",read_at:null,status:"completed",source:{work_id:"reconcile",execution_id:"run-atlas"}},
    {id:"event:1",sequence:1,category:"control",kind:"stop_requested",received_at:"2026-09-13T11:43:00Z",read_at:null,status:"accepted",source:{work_id:"reconcile",intent_id:"sample-stop"}},
  ],
};
export function sampleUnread(items:NotificationItem[]):NotificationUnread {
  const by_category:NotificationUnread["by_category"]={message:0,execution:0,control:0,publication:0};
  for(const item of items)if(item.read_at===null)by_category[item.category]++;
  return {total:Object.values(by_category).reduce((a,b)=>a+b,0),by_category};
}
