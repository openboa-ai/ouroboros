import { sampleProfile } from "./fixtures/profile";
import { sampleServices } from "./fixtures/services";
import { ServiceDetail } from "@/features/services/Services";
import { displayName } from "@/contracts/company-profile";
import { ModuleInventory } from "@/modules/ModuleInventory";
import { useMemo, useState, type ReactNode } from "react";
import { NotificationsScreen } from "@/features/notifications/Notifications";
import { notificationBadges, type NotificationPage, type NotificationReadReceipt } from "@/features/notifications/model";
import { notificationFixture, sampleUnread } from "./fixtures/notifications";
import { openNotificationSource } from "@/features/notifications/open-source";
import { Workspace, type ScreenContext } from "@/app/Workspace";
import type { Destination, Scenario, DetailTarget } from "@/app/contracts";
import { createInvestmentModule } from "@/domains/investment/module";
import { companyPageEntries, type CompanyComposition } from "@/contracts/modules";
import { investmentFixture } from "./fixtures/investment";
import { operationFixtures } from "./fixtures/operations";
import { rooms } from "./fixtures/rooms";
import { materials } from "./fixtures/materials";
import { resources } from "./fixtures/resources";
import { OperationsScreen, OperationWidget } from "@/features/operations/Operations";
import { ConversationsScreen } from "@/features/conversations/Conversations";
import { LibraryScreen } from "@/features/library/Library";
import { ResourcesPanel } from "@/features/resources/ResourcesPanel";
import { InspectorContent, detailTitle } from "./InspectorContent";
import { RecordLink, Facts, EmptyState } from "@/ui/components/patterns";
import { ModuleSettings } from "@/modules/ModuleSettings";
import { CompanyPageScreen } from "@/modules/CompanyPage";
import { registeredCompanyModules } from "@/bootstrap/company-modules";
import type { ModuleDefinition, WidgetDefinition } from "@/contracts/modules";
import type { OperationsModel } from "@/features/operations/model";
interface SampleModel {operations:OperationsModel;modules:ModuleDefinition[];composition:CompanyComposition;notifications?:NotificationPage;readNotifications?:(ids:string[])=>Promise<NotificationReadReceipt>}
function SampleScreen({destination,model,...p}:ScreenContext&{destination:Destination;model:SampleModel}) {
 if(destination==="notifications")return <NotificationsScreen sourceLabel="Sample notifications · Read states reset on reload" page={model.notifications??null} read={model.readNotifications!} loadMore={async()=>{}} open={location=>{if(model.notifications?.items.find(item=>item.id===location.notificationId)?.read_at===null)void model.readNotifications?.([location.notificationId]);if(location.destination==="library")p.open({kind:"artifact",id:"position-review",revision:12});else if(location.destination==="system")p.open({kind:"controls",tab:"requests"});else openNotificationSource(location,p);}}/>;
 if(["work","agents","system"].includes(destination)) return <OperationsScreen {...p} kind={destination as "work"|"agents"|"system"} model={model.operations}/>;
 if(destination==="conversations")return <ConversationsScreen {...p} rooms={rooms}/>;
 if(destination==="library")return <LibraryScreen {...p} materials={materials}/>;
 if(destination==="settings/connections")return <ResourcesPanel {...p} target={{kind:"connections"}} records={resources}/>;
 if(destination==="settings/company")return <ModuleSettings {...p} modules={model.modules} current={model.composition} scope="sample-company"/>;
 if(destination==="settings/modules")return <ModuleInventory modules={model.modules} current={model.composition} scope="sample-company" configurationLabel="Sample configuration"/>;
 if(destination==="settings/maintenance")return <div className="settings-page"><Facts rows={[["Environment","Sample company"],["Service management","Not connected"],["Backup","Not observed"],["Recovery","Not observed"]]}/></div>;
 if(destination.startsWith("company/"))return <CompanyPageScreen {...p} pageId={destination.slice(8)} modules={model.modules} composition={model.composition} scope="sample-company"/>;
 return <EmptyState title="View unavailable" detail="This page is not registered."/>;
}
export function SampleWorkspace({scenario="observed",footerAccessory}:{scenario?:Scenario;footerAccessory?:ReactNode}) {
 const [notifications,setNotifications]=useState<NotificationPage>(()=>structuredClone(notificationFixture));
 async function readNotifications(ids:string[]) {
  const read_at=new Date().toISOString();
  const items=notifications.items.map(item=>ids.includes(item.id)?{...item,read_at:item.read_at??read_at}:item);
  const unread=sampleUnread(items);
  setNotifications({...notifications,items,unread});
  return {ids,read_at,unread};
 }
 const model=useMemo<SampleModel>(()=>({operations:{...operationFixtures(scenario),continuations:sampleServices(scenario)},modules:[createInvestmentModule(investmentFixture),...registeredCompanyModules],composition:{schemaVersion:1,companyId:"sample-company",revision:1,author:"Sample configuration",pages:[{id:"portfolio",title:"Portfolio",module:"investment",screen:"portfolio",widgets:[]}]}}),[scenario]);
 const widgets=useMemo<WidgetDefinition[]>(()=>[
  ...model.modules.find(m=>m.id==="investment")!.widgets,
  {id:"workspace.work",title:"Priority work",description:"The work and conditions moving your company forward",provider:"Workspace",sizes:["medium","wide"],Component:p=><OperationWidget {...p} records={model.operations.work} empty="No current work"/>},
  {id:"workspace.executions",title:"Current executions",description:"Actual runs and their observed state",provider:"Workspace",sizes:["medium","wide"],Component:p=><OperationWidget {...p} records={model.operations.executions} empty="No executions observed"/>},
  {id:"workspace.system",title:"System status",description:"Connected services and missing observations",provider:"Workspace",sizes:["small","medium"],Component:p=><OperationWidget {...p} records={model.operations.services.slice(0,2)} empty="Not observed"/>},
  {id:"workspace.artifacts",title:"Recent materials",description:"Published results with their exact revision",provider:"Workspace",sizes:["small","medium"],Component:p=><div>{materials.slice(0,2).map(m=><RecordLink key={m.id} variant="row" title={m.title} meta={`Revision ${m.revision}`} onClick={()=>p.open({kind:"artifact",id:m.id,revision:m.revision})}/>)}</div>},
  {id:"workspace.conversations",title:"Conversations",description:"Open a conversation with its context",provider:"Workspace",sizes:["small","medium"],Component:p=><RecordLink variant="row" title="Atlas" meta="Portfolio direction · sample conversation" onClick={()=>p.discuss({label:"Company overview",target:{kind:"member",id:"atlas"}})}/>},
  ...model.modules.filter(m=>m.id!=="investment").flatMap(m=>m.widgets),
 ],[model]);
 return <Workspace adapter={{company:sampleProfile.name,owner:displayName(sampleProfile,"sample-owner"),source:"Sample company",subtitle:"Company workspace",scope:"sample-company.owner",scenario,model:{...model,notifications,readNotifications},Screen:SampleScreen,Inspector:SampleInspector,detailTitle:t=>t.kind==="service-continuation"?"Call recovery":detailTitle(t),footerAccessory,badges:{...notificationBadges(notifications.unread)},widgets,companyPages:companyPageEntries(model.composition)}}/>;
}
function SampleInspector({model,...props}:ScreenContext&{target:DetailTarget;model:SampleModel}) {
 if(props.target.kind==="service-continuation") {
  const service=model.operations.continuations?.groups.flatMap(g=>g.items).find(s=>s.root_intent_id===props.target.id);
  return service?<ServiceDetail {...props} service={service} source="Sample observation"/>:<EmptyState title="Sample call unavailable" detail="Choose another preview state to see this call."/>;
 }
 return <InspectorContent {...props}/>;
}
