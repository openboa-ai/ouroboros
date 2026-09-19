import { useState } from "react";
import { ArrowUpRight, Circle, Search, Users, Server, ListTodo } from "lucide-react";
import { Input } from "@/ui/primitives/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/primitives/tabs";
import { EmptyState, RecordLink, Status, SectionHeading } from "@/ui/components/patterns";
import type { ViewProps } from "@/app/contracts";
import type { OperationalRecord, OperationsModel } from "./model";
import "./operations.css";
import { ServiceList } from "@/features/services/Services";
function RecordRows({records,open,empty}: Pick<ViewProps,"open"> & {records: OperationalRecord[];empty:string}) {
  if (!records.length) return <EmptyState title={empty} detail="No records are available in the current scope."/>;
  return <div className="operation-rows">{records.map(r=><button className="operation-row" key={r.id} onClick={()=>open(r.target)}><div className="operation-row-copy"><span className="type-control">{r.title}</span><span className="type-data muted">{r.description}</span>{r.next&&<span className="type-meta muted">Next · {r.next}</span>}</div><div className="operation-row-state"><Status>{r.state}</Status><span className="type-meta muted">{r.owner??r.observed}</span></div><ArrowUpRight size={14}/></button>)}</div>;
}
export function OperationsScreen({kind, model, open}: ViewProps & {kind:"work"|"agents"|"system"; model:OperationsModel}) {
  const [query,setQuery]=useState("");
  const match=(rows:OperationalRecord[])=>rows.filter(r=>`${r.title} ${r.description} ${r.state} ${r.owner}`.toLowerCase().includes(query.toLowerCase()));
  const config = kind === "work" ? {title:"What the company is working toward", description:"Purpose, progress and the next condition", icon:ListTodo} : kind === "agents" ? {title:"People and their actual executions",description:"Continuing responsibility across individual runs",icon:Users} : {title:"The environment behind your company",description:"Observed services, resources and unresolved requests",icon:Server};
  const Icon=config.icon;
  return <div className="operations-screen">
    <div className="operations-heading"><div><h2 className="type-section">{config.title}</h2><p className="type-meta muted">{config.description}</p></div><span className="type-meta muted">{model.source}</span></div>
    <div className="operations-summary"><div><Icon size={20}/><span className="type-amount-secondary">{kind==="work"?model.work.length:kind==="agents"?model.executions.length:model.services.length}</span><span className="type-data muted">{kind==="work"?"visible work items":kind==="agents"?"visible executions":"observed service records"}</span></div><div className="operation-search"><Search size={16}/><Input aria-label={`Search ${kind}`} placeholder="Search by name, purpose or state" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
    {kind==="work" ? <div className="operations-columns"><section><SectionHeading title="Work" note="Open a work item to follow its results and evidence"/><RecordRows records={match(model.work)} open={open} empty="No work observed"/></section><aside><SectionHeading title="Recent changes"/><div className="operations-events">{model.events.slice(0,4).map(r=><RecordLink key={r.id} variant="row" title={r.title} meta={r.observed} onClick={()=>open(r.target)}/>)}</div></aside></div> : kind==="agents" ? <>
      <section><SectionHeading title="Members" note="A member can exist without a running execution"/><div className="member-grid">{match(model.members).map(r=><button className="member-profile" key={r.id} onClick={()=>open(r.target)}><span className="member-initial type-section">{r.title[0]}</span><span className="record-copy"><span className="type-control">{r.title}</span><span className="type-meta muted">{r.description}</span></span><Status>{r.state}</Status><ArrowUpRight size={14}/></button>)}</div>{!model.members.length&&<EmptyState title="No members observed" detail="Member identities are shown only when supplied by the environment."/>}</section>
      <Tabs defaultValue="executions"><TabsList aria-label="Agent records"><TabsTrigger value="executions">Executions</TabsTrigger><TabsTrigger value="activity">Activity & trace</TabsTrigger></TabsList><TabsContent value="executions"><RecordRows records={match(model.executions)} open={open} empty="No executions observed"/></TabsContent><TabsContent value="activity"><RecordRows records={match(model.events)} open={open} empty="No retained activity"/></TabsContent></Tabs>
    </> : <Tabs defaultValue="services"><TabsList aria-label="System records"><TabsTrigger value="services">Services & connections</TabsTrigger><TabsTrigger value="resources">Execution resources</TabsTrigger><TabsTrigger value="events">Events</TabsTrigger></TabsList><TabsContent value="services"><div className="system-services"><ServiceList collection={model.continuations} query={query} open={open}/><section><SectionHeading title="Platform observations"/><RecordRows records={match(model.services)} open={open} empty="Service status not observed"/></section></div></TabsContent><TabsContent value="resources"><RecordRows records={match(model.executions)} open={open} empty="No resource observations"/></TabsContent><TabsContent value="events"><RecordRows records={match(model.events)} open={open} empty="No system events"/></TabsContent></Tabs>}
    <div className="operations-footnote type-meta muted"><Circle size={8}/> Status and timestamps come from the selected source. Missing observations are not healthy or zero.</div>
  </div>;
}
export function OperationWidget({records,open,empty}: Pick<ViewProps,"open">&{records:OperationalRecord[];empty:string}) {
  return records.length ? <div>{records.slice(0,3).map(r=><RecordLink variant="row" key={r.id} title={r.title} meta={`${r.state} · ${r.description}`} onClick={()=>open(r.target)}/>)}</div> : <EmptyState title={empty} detail="Nothing has been reported in this scope."/>;
}
