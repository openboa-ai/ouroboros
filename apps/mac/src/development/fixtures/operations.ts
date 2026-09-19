import * as company from "./company";
import { resources } from "./resources";
import type { OperationsModel } from "@/features/operations/model";
import type { Scenario } from "@/app/contracts";
export function operationFixtures(scenario:Scenario):OperationsModel {
  const state = scenario==="delayed" ? "Not observed" : scenario==="uncertain" ? "Unconfirmed" : "Waiting";
  if(scenario==="empty") return {work:[],members:[],executions:[],services:[],events:[],source:"Sample company"};
  return {source:"Sample company · Sep 13, 2026",work:company.work.map(w=>({id:w.id,title:w.title,description:w.result,state:w.member==="nova"&&scenario==="observed"?"Working":state,observed:"20:50 KST",owner:w.member==="atlas"?"Atlas":"Nova",next:w.next,target:{kind:"work",id:w.id}})),members:company.members.map(m=>({id:m.id,title:m.name,description:m.role,state:m.id==="atlas"?"Waiting":"Working",observed:"20:50 KST",target:{kind:"member",id:m.id}})),executions:company.work.map(w=>({id:w.execution,title:w.member==="atlas"?"Atlas · Order reconciliation":"Nova · Funding review",description:w.execution,state:w.member==="atlas"?state:"Working",observed:"20:50 KST",target:{kind:"execution",id:w.execution}})),services:resources.map(r=>({id:r.id,title:r.name,description:r.purpose,state:r.state,observed:r.observed,owner:r.owner,target:{kind:"connections",id:r.id},fields:r.facts})),events:company.trace.map(t=>({id:t.id,title:t.tool,description:t.result,state:"Recorded",observed:t.time,target:t.target}))};
}
