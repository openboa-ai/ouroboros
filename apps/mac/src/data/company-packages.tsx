import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ModuleDefinition, WidgetSize } from "@/contracts/modules";
import type { ObservedConfiguration } from "./company-configuration";
import { CompanySurface } from "@/modules/CompanySurface";
import { readCompanyProfile, type CompanyProfile } from "@/contracts/company-profile";
import { record } from "./live";
import type {ViewProps} from "@/app/contracts";
interface Entry {id:string;title:string;entry:string;sizes:WidgetSize[]}
interface Prepared {handle:string;manifest:{id:string;name:string;version:string;pages:Entry[];widgets:Entry[]}}
export interface PackageReference {id:string;path:string;revision:number;sha256:string}
export function useCompanyPackages(observed:ObservedConfiguration|null,environment:string,owner:string,connectionGeneration?:string){
 const key=JSON.stringify([environment,owner,connectionGeneration,observed?.file.workspace,observed?.file.revision,observed?.composition]);
 const [state,setState]=useState<{key:string;modules:ModuleDefinition[];profile:CompanyProfile|null;error:string}>({key:"",modules:[],profile:null,error:""});
 useEffect(()=>{
  let active=true;const handles:string[]=[];
  if(!observed)return;
  const artifact=(path:string,revision=observed.file.revision)=>({workspace_id:observed.file.workspace,revision,path,...observed.file.scope,expected_environment_id:environment,connection_generation:connectionGeneration});
  void(async()=>{
   const modules:ModuleDefinition[]=[];let profile:CompanyProfile|null=null;const errors:string[]=[];
   try{const reply=record(await invoke("read_artifact",{artifact:artifact("company-profile.json")}));profile=readCompanyProfile(JSON.parse(String(reply.content)),observed.composition.companyId);}catch{errors.push("Company profile not observed.");}
   for(const ref of observed.composition.packages??[]){
    try{
     const p=await invoke<Prepared>("prepare_company_package",{artifact:artifact(ref.path,ref.revision),sha256:ref.sha256,expectedCompanyId:observed.composition.companyId,expectedOwnerId:owner});
     if(!active){await invoke("release_company_package",{handle:p.handle});break;}
     handles.push(p.handle);
     if(p.manifest.id!==ref.id)throw new Error("Package identity mismatch");
     const entry=(kind:"page"|"widget",id:string)=>(props:ViewProps)=><CompanySurface {...props} handle={p.handle} kind={kind} entry={id}/>;
     modules.push({id:p.manifest.id,name:p.manifest.name,version:p.manifest.version,pages:p.manifest.pages.map(e=>({id:e.id,title:e.title,Screen:entry("page",e.id)})),widgets:p.manifest.widgets.map(e=>({id:e.id,title:e.title,description:"Verified company package",provider:"Company",sizes:e.sizes,Component:entry("widget",e.id)}))});
    }catch{errors.push(`Package ${ref.id} could not be verified.`);}
   }
   if(active)setState({key,modules,profile,error:errors.join(" ")});
  })();
  return()=>{active=false;for(const handle of handles)void invoke("release_company_package",{handle}).catch(()=>{});};
 // All observed inputs are captured by the immutable scope key.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 return state.key===key?state:{key,modules:[],profile:null,error:""};
}