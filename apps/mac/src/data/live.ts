import type { ContextReference } from "@/app/contracts";
import { retainMessage } from "./outbox";
import { invoke } from "@tauri-apps/api/core";
import type { OperationsModel, OperationalRecord } from "@/features/operations/model";
import type { Room, Message } from "@/features/conversations/model";
import { readServiceGroup, type ServiceCollection } from "@/features/services/model";
export type JsonRecord=Record<string,unknown>;
export const record=(v:unknown):JsonRecord=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as JsonRecord:{};
export const rows=(v:unknown):JsonRecord[]=>Array.isArray(v)?v.map(record):[];
export const str=(v:unknown,fallback="Not observed")=>typeof v==="string"?v:fallback;
export interface LiveSnapshot {schema_version:2;source:"gateway";conditions:JsonRecord;work:JsonRecord;observations:JsonRecord[];coverage:string;connection_generation?:string;environment_id?:string}
export function readLiveSnapshot(value:unknown):LiveSnapshot {
 const v=record(value), c=record(v.conditions);
 if(v.schema_version!==2||v.source!=="gateway"||typeof c.firm_id!=="string"||typeof c.principal_id!=="string"||!Number.isSafeInteger(c.revision)||!Array.isArray(v.observations)||!Array.isArray(record(v.work).items))throw new Error("Unsupported Gateway observation response.");
 return v as unknown as LiveSnapshot;
}
export async function fetchLiveSnapshot(){return readLiveSnapshot(await invoke("company_snapshot"));}
export function executionRows(s:LiveSnapshot){return s.observations.flatMap(o=>rows(record(o.executions).items));}
export function operationsFor(s:LiveSnapshot):OperationsModel {
 const continuations:ServiceCollection={source:"Core records",partial:record(s.work).has_more===true||rows(s.work.items).length>s.observations.length,groups:rows(s.work.items).map(w=>{
  const workId=str(w.id),title=str(w.purpose),observation=s.observations.find(o=>o.work_id===workId);
  try{return readServiceGroup(observation?.services,{environmentId:s.environment_id??"",firmId:str(s.conditions.firm_id),workId},title);}catch{return {workId,title,items:[],unavailable:true,hasMore:false};}
 })};
 const executions=executionRows(s), events=s.observations.flatMap(o=>rows(record(o.activity).items));
 const work:OperationalRecord[]=rows(s.work.items).map(w=>({id:str(w.id),title:str(w.purpose),description:`Work ${str(w.id)}`,state:"Recorded",observed:"Core record",owner:str(w.principal_id),target:{kind:"work",id:str(w.id)}}));
 const runs:OperationalRecord[]=executions.map(e=>({id:str(e.id),title:`Execution ${str(e.id).slice(0,8)}`,description:`${str(e.native_model,"Model not recorded")} · ${str(e.agent_principal_id,"Agent identity not recorded")}`,state:e.terminated?"Terminated":e.stopped?"Stopping":record(e.native_turn).status==="inProgress"?"Running":str(e.state),observed:str(e.last_observed_at),target:{kind:"execution",id:str(e.id)}}));
 const ids=[...new Set(executions.map(e=>e.agent_principal_id).filter((id):id is string=>typeof id==="string"))];
 const members:OperationalRecord[]=ids.map(id=>({id,title:`Agent ${id.slice(0,8)}`,description:"Display identity not configured",state:executions.some(e=>e.agent_principal_id===id&&!e.terminated&&!e.stopped&&record(e.native_turn).status==="inProgress")?"Running":executions.some(e=>e.agent_principal_id===id&&!e.terminated&&e.stopped)?"Stopping":executions.some(e=>e.agent_principal_id===id&&!e.terminated)?"Queued or waiting":"No active execution",observed:"Core principal",target:{kind:"member",id}}));
 const services:OperationalRecord[]=[{id:"gateway",title:"Gateway",description:"Authenticated conditions and work reads succeeded",state:"Read observed",observed:"This refresh",target:{kind:"source",id:"gateway"}},{id:"runtime",title:"Runtime",description:"A current health probe is not provided by this source",state:"Liveness not observed",observed:"Unavailable",target:{kind:"source",id:"runtime"}},...rows(s.conditions.limits).map(l=>({id:str(l.id),title:str(l.id),description:`Committed ${String(l.committed??"—")} / capacity ${String(l.capacity??"—")}`,state:"Reservation record",observed:"Core conditions",target:{kind:"source",id:str(l.id)}}))];
 for(const o of s.observations)for(const area of ["executions","activity","rooms"])if(record(o[area]).unavailable)services.push({id:`${str(o.work_id)}.${area}`,title:`${area} observations`,description:str(record(o[area]).message),state:"Unavailable",observed:"This refresh",target:{kind:"source",id:`${str(o.work_id)}.${area}`}});
 return {work,members,executions:runs,services,continuations,events:events.map(e=>({id:String(e.sequence),title:str(e.kind),description:`${str(e.source)} · ${str(e.state,str(e.status,"Recorded"))}`,state:"Recorded",observed:str(e.received_at),target:{kind:"event",id:String(e.sequence)}})),source:"Gateway · partial scope"};
}
export async function loadRooms(s:LiveSnapshot):Promise<Room[]> {
 const result:Room[]=[];
 for(const observation of s.observations)for(const r of rows(record(observation.rooms).items)){
  const messages:Message[]=[];let cursor=0;let more=true;
  for(let page=0;page<25&&more;page++) {
   const response=record(await invoke("ceo_messages",{roomId:r.id,cursor,connectionGeneration:s.connection_generation}));
   for(const m of rows(response.messages))messages.push({id:str(m.id),author:m.author_principal_id===s.conditions.principal_id?"You":`${m.author_kind==="agent"?"Agent":"Member"} ${str(m.author_principal_id).slice(0,8)}`,authorId:str(m.author_principal_id),text:str(m.text,""),time:new Date(str(m.received_at)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),deliveryState:rows(m.deliveries).some(d=>d.state==="succeeded")?"Delivered":"Stored",replyTo:undefined});
   more=response.has_more===true;cursor=Number(response.cursor);
  }
  result.push({id:str(r.id),name:`Conversation ${str(r.id).slice(0,8)}`,people:`You · Agent ${str(r.responsible_agent_id).slice(0,8)}`,purpose:str(rows(s.work.items).find(w=>w.id===observation.work_id)?.purpose),kind:"personal",recipientNames:`Agent ${str(r.responsible_agent_id).slice(0,8)}`,messages,agentId:str(r.responsible_agent_id),workId:str(observation.work_id),truncated:more});
 }
 return result;
}
export async function sendRoomMessage(s:LiveSnapshot,room:Room,text:string,key:string,replyTo?:string,context?:ContextReference|null) {
 const work=rows(s.work.items).find(w=>w.id===room.workId);if(!work)throw new Error("The conversation work is unavailable.");
 const scope=`ouroboros.outbox.${s.environment_id}.${s.conditions.firm_id}.${s.conditions.principal_id}.${room.id}`;
 const body=context?`${text}\n\nReference: ${context.label}\n${JSON.stringify(context.target)}`:text;
 const request=retainMessage(localStorage,scope,{key,text:body,replyTo:replyTo??null});
 let accepted:JsonRecord;
 try {accepted=record(await invoke("ceo_message",{request:{connection_generation:s.connection_generation,room_id:room.id,delegation_id:work.delegation_id,text:request.text,request_key:request.key,reply_to:request.replyTo}}));}
 catch {throw new Error("Storage outcome unresolved. Retry the same message to check its original request; do not edit it yet.");}
 // Delivery is a distinct effect. Never turn a stored message into a fabricated reply.
 localStorage.removeItem(scope);
 const active=executionRows(s).filter(e=>e.work_id===room.workId&&e.agent_principal_id===room.agentId&&!e.stopped&&!e.terminated&&record(e.native_turn).status==="inProgress");
 if(active.length===1){const run=active[0],turn=record(run.native_turn);try {await invoke("deliver_message",{request:{connection_generation:s.connection_generation,room_id:room.id,message_id:accepted.resource_id,delegation_id:work.delegation_id,execution_id:run.id,thread_id:turn.thread_id,turn_id:turn.turn_id,request_key:`${request.key}-delivery`}});}catch {/* Stored message remains visible with separate unresolved delivery. */}}
}
