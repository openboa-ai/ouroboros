import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DetailTarget, ViewProps } from "@/app/contracts";
import { Facts } from "@/ui/components/Facts";
import { Button } from "@/ui/primitives/button";
import { record, str } from "@/data/live";
/** Reading a published file is an explicit governed resource call, never hover prefetch. */
export function PublishedFile({target,discuss,environmentId,connectionGeneration}:Pick<ViewProps,"discuss">&{target:DetailTarget;environmentId:string;connectionGeneration:string}) {
 const [content,setContent]=useState<string|null>(null),[status,setStatus]=useState(""),[busy,setBusy]=useState(false);
 const artifact={workspace_id:target.workspace,revision:target.revision,path:target.path,work_id:target.workId,delegation_id:target.delegationId,target_id:target.targetId,expected_environment_id:target.expectedEnvironmentId??environmentId,connection_generation:connectionGeneration};
 async function read(){setBusy(true);try{const r=record(await invoke("read_artifact",{artifact}));setContent(str(r.content,""));setStatus(`Verified ${r.size} bytes · SHA-256 ${r.sha256}`);}catch(error){setStatus(String(error));}finally{setBusy(false);}}
 async function save(){setBusy(true);try{setStatus(str(await invoke("save_artifact",{artifact}),"Saved"));}catch(error){setStatus(String(error));}finally{setBusy(false);}}
 return <div className="inspector-content"><Facts rows={[["File",str(target.path)],["Workspace",str(target.workspace)],["Revision",String(target.revision)],["Source","Confirmed Catalog publication"]]}/><div className="detail-toolbar"><Button variant="secondary" disabled={busy} onClick={()=>void read()}>Read published file</Button><Button variant="secondary" disabled={busy} onClick={()=>void save()}>Save a copy</Button><Button variant="ghost" onClick={()=>discuss({label:str(target.path),target})}>Discuss this file</Button></div>{status&&<p role="status" className="type-meta muted">{status}</p>}{content!==null&&<pre className="published-content type-data">{content}</pre>}</div>;
}
