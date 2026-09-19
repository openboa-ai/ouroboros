import { useEffect, useReducer, useRef, useState, type ReactNode, type ComponentType } from "react";
import { ArrowLeft, X, LayoutDashboard } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { UnreadBadge } from "@/ui/components/UnreadBadge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/primitives/tabs";
import { WorkspaceLayout } from "@/ui/layouts/WorkspaceLayout";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { HomeScreen } from "@/features/home/Home";
import { EmptyState } from "@/ui/components/EmptyState";
import type { ContextReference, Destination, DetailTarget, ViewProps } from "./contracts";
import type { WidgetDefinition } from "@/contracts/modules";
import { ModuleBoundary } from "./ModuleBoundary";
import { initialNavigation, navigationReducer } from "./navigation";
import { destinations, settingsRoutes } from "./routes";
import "@/ui/layouts/inspector.css";
export interface ScreenContext extends ViewProps { context: ContextReference | null; clearContext: () => void; navigate:(destination:Destination)=>void; }
export interface WorkspaceAdapter<T> {
 company:string; owner:string; source:string; subtitle:string; scope?:string;
 scenario:ViewProps["scenario"]; model:T;
 Screen:ComponentType<ScreenContext & {destination:Destination;model:T}>;
 Inspector:ComponentType<ScreenContext & {target:DetailTarget;model:T}>;
 detailTitle:(target:DetailTarget)=>string;
 companyPages?: readonly {id:string;label:string}[];
 widgets?:readonly WidgetDefinition[];
 headerAccessory?:(destination:Destination,navigate:(id:Destination)=>void)=>ReactNode;
 footerAccessory?:ReactNode;
 badges?:Readonly<Record<string,number>>;
}
/** Host owns fixed routes. Company routes arrive only through its registered adapter. */
export function Workspace<T>({adapter:a}:{adapter:WorkspaceAdapter<T>}) {
 const Screen=a.Screen, Inspector=a.Inspector;
 const [state,dispatch]=useReducer(navigationReducer,initialNavigation);
 const [lastSettings,setLastSettings]=useState("settings/general");
 const opener=useRef<HTMLElement|null>(null);
 const previousDepth=useRef(0);
 const headings=useRef<HTMLDivElement|null>(null);
 const companyItems=(a.companyPages??[]).map(p=>({...p,icon:LayoutDashboard}));
 const routes=[...destinations,...companyItems,...settingsRoutes];
 const title=routes.find(r=>r.id===state.destination)?.label??"Unavailable view";
 const isSettings=state.destination.startsWith("settings/");
 function navigate(id:Destination){if(id.startsWith("settings/"))setLastSettings(id);dispatch({type:"navigate",destination:id});}
 const target=state.stack.at(-1);
 const detailName=(t:DetailTarget)=>t.kind==="settings"?"General":a.detailTitle(t);
 const open=(reference:DetailTarget)=>{if(!state.stack.length)opener.current=document.activeElement as HTMLElement;dispatch({type:"open",target:reference});};
 const discuss=(context:ContextReference)=>dispatch({type:"discuss",context});
 const context:ScreenContext={open,discuss,navigate,scenario:a.scenario,updateDetail:patch=>dispatch({type:"patch-detail",patch}),context:state.context,clearContext:()=>dispatch({type:"clear-context"})};
 function close(){dispatch({type:"close"});requestAnimationFrame(()=>opener.current?.focus());}
 useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key==="k"){event.preventDefault();dispatch({type:"open",target:{kind:"search"}});}if(event.key==="Escape")dispatch({type:"back"});};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
 const focusReference=target?`${target.kind}:${target.id??""}:${state.stack.length}`:"";
 useEffect(()=>{if(focusReference)headings.current?.focus();},[focusReference]);
 useEffect(()=>{if(previousDepth.current>0&&state.stack.length===0)requestAnimationFrame(()=>opener.current?.focus());previousDepth.current=state.stack.length;},[state.stack.length]);
 const origin=state.stack.length>1?detailName(state.stack[state.stack.length-2]):title;
 return <WorkspaceLayout company={a.company} owner={a.owner} source={a.source} subtitle={a.subtitle} items={destinations} companyItems={companyItems} active={state.destination} title={target?detailName(target):isSettings?"Settings":title} onNavigate={navigate} onSearch={()=>open({kind:"search"})} onSettings={()=>navigate(lastSettings)} onControls={()=>open({kind:"controls"})} notice={a.scenario==="uncertain"} badges={a.badges} headerAccessory={a.headerAccessory?.(state.destination,navigate)}>
   {routes.filter(route=>!route.id.startsWith("settings/")).map(route=><div className={`destination-page ${route.id==="conversations"?"conversation-destination":""}`} key={route.id} hidden={state.destination!==route.id||!!target}>
    {route.id==="conversations"&&state.returnTo&&<div className="context-return"><Button variant="ghost" onClick={()=>dispatch({type:"return"})}><ArrowLeft size={14}/>Return to {state.returnTo.stack.length?detailName(state.returnTo.stack.at(-1)!):routes.find(r=>r.id===state.returnTo!.destination)?.label}</Button></div>}
    <ModuleBoundary>{route.id==="home"?<HomeScreen {...context} scope={a.scope??`${a.company}.${a.owner}.${a.source}`} widgets={a.widgets??[]}/>:<Screen destination={route.id} model={a.model} {...context}/>}</ModuleBoundary>
   </div>)}
   <Tabs className="settings-workspace" hidden={!isSettings||!!target} value={isSettings?state.destination:"settings/general"} onValueChange={value=>navigate(String(value))}>
    <div className="settings-tab-scroll"><TabsList aria-label="Settings categories">{settingsRoutes.map(route=><TabsTrigger key={route.id} value={route.id} onFocus={event=>event.currentTarget.scrollIntoView({block:"nearest",inline:"nearest"})}>{route.label}<UnreadBadge count={a.badges?.[route.id]}/></TabsTrigger>)}</TabsList></div>
    {settingsRoutes.map(route=><TabsContent key={route.id} value={route.id} keepMounted className="destination-page"><ModuleBoundary>{route.id==="settings/general"?<div className="settings-page"><SettingsPanel connectionActions={a.footerAccessory}/></div>:<Screen destination={route.id} model={a.model} {...context}/>}</ModuleBoundary></TabsContent>)}
   </Tabs>
   {!routes.some(r=>r.id===state.destination)&&!target&&<EmptyState title="View unavailable" detail="The company module is not registered for this environment."/>}
   {target&&<section className="full-detail" aria-label={`${detailName(target)} details`}><div className="full-detail-heading" tabIndex={-1} ref={headings}><Button variant="ghost" onClick={()=>dispatch({type:"back"})}><ArrowLeft size={14}/>{origin}</Button><Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={close}><X/></Button></div><div key={JSON.stringify({...target,tab:undefined,query:undefined})}><ModuleBoundary>{target.kind==="settings"?<SettingsPanel/>:<Inspector target={target} model={a.model} {...context}/>}</ModuleBoundary></div></section>}
 </WorkspaceLayout>;
}
