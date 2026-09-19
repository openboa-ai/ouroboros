import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { EmptyState } from "@/ui/components/EmptyState";
import type { ViewProps } from "@/app/contracts";

/** Private JS is never imported into React. Only this product-owned slot mounts a native child WebView. */
export function CompanySurface({handle,kind,entry,open,discuss}:{handle:string;kind:"page"|"widget";entry:string}&ViewProps){
 const element=useRef<HTMLDivElement>(null);const [error,setError]=useState("");
 const callbacks=useRef({open,discuss});
 useEffect(()=>{callbacks.current={open,discuss};},[open,discuss]);
 useEffect(()=>{
  if(!isTauri())return;
  let closed=false,label:string|undefined,pending=false,last="";
  const unlisteners: (()=>void)[]=[];
  const position=async()=>{
   if(closed||pending||!element.current)return;
   const r=element.current.getBoundingClientRect();
   // Hidden retained pages and clipped/scrolling slots cannot cover protected navigation or modals.
   const visible=r.width>0&&r.height>0&&r.x>=224&&r.y>=64&&r.right<=innerWidth&&r.bottom<=innerHeight&&element.current.checkVisibility();
   const bounds={x:r.x,y:r.y,width:r.width,height:r.height,visible};const key=JSON.stringify(bounds);
   if(key===last)return;if(!label&&!visible)return;
   pending=true;
   try{
    if(!label){const mounted=await invoke<string>("mount_company_view",{handle,kind,entry,bounds});if(closed){await invoke("close_company_view",{label:mounted});return;}label=mounted;}
    else await invoke("position_company_view",{label,bounds});
    last=key;
   }catch{if(!closed){setError("This Company surface is unavailable. Refresh its verified package from Settings.");closed=true;if(label)void invoke("close_company_view",{label}).catch(()=>{});}}
   finally{pending=false;}
  };
  void listen<{view:string}>("company-view-unavailable",e=>{if(e.payload.view===label)setError("Company access changed. Refresh to verify the current release.");}).then(u=>closed?u():unlisteners.push(u));
  void listen<{view:string;discuss:boolean;artifact:{workspace_id:string;revision:number;path:string;work_id:string;delegation_id:string;target_id:string;expected_environment_id:string}}>("company-view-reference",e=>{
   if(closed||e.payload.view!==label)return;
   const a=e.payload.artifact;const target={kind:"package-artifact",workspace:a.workspace_id,revision:a.revision,path:a.path,workId:a.work_id,delegationId:a.delegation_id,targetId:a.target_id,expectedEnvironmentId:a.expected_environment_id};
   if(e.payload.discuss)callbacks.current.discuss({label:a.path,target});else callbacks.current.open(target);
  }).then(u=>closed?u():unlisteners.push(u));
  const timer=setInterval(()=>void position(),200);void position();
  return()=>{closed=true;clearInterval(timer);for(const unlisten of unlisteners)unlisten();if(label)void invoke("close_company_view",{label}).catch(()=>{});};
 },[handle,kind,entry]);
 return <div ref={element} className="company-surface" style={{minHeight:280,height:"100%"}}>{!isTauri()?<EmptyState title="Open in the Mac app" detail="Company code runs in an isolated native surface."/>:error?<EmptyState title="Company view unavailable" detail={error}/>:<span className="type-meta muted">Company package · {entry}</span>}</div>;
}
