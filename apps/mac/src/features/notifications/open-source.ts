import type { ScreenContext } from "@/app/Workspace";
import type { NotificationLocation } from "./model";

/** Follow exact source references; absence of a loaded record is shown by that protected detail. */
export function openNotificationSource(location: NotificationLocation, actions: ScreenContext) {
  const source=location.source;
  if (location.destination === "conversations" && source.conversation_id) {
    actions.discuss({label:"Referenced message",target:{kind:"conversation",id:source.conversation_id,messageId:source.message_id,workId:source.work_id}});
  } else if (source.intent_id && location.destination === "library") {
    actions.open({kind:"publication",id:source.intent_id,workId:source.work_id});
  } else if (source.intent_id && location.destination === "system") {
    actions.open({kind:"control-request",id:source.intent_id,workId:source.work_id});
  } else if (location.destination === "agents" && source.execution_id) {
    actions.open({kind:"execution",id:source.execution_id,workId:source.work_id});
  } else if (source.work_id) {
    actions.open({kind:"work",id:source.work_id});
  } else actions.navigate(location.destination);
}
