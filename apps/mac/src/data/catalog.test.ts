import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicationDocuments } from "./catalog";
import type { LiveSnapshot } from "./live";
vi.mock("@tauri-apps/api/core",()=>({invoke:vi.fn()}));
import { invoke } from "@tauri-apps/api/core";
const snapshot:LiveSnapshot={schema_version:2,source:"gateway",conditions:{},work:{},coverage:"partial",environment_id:"environment",connection_generation:"connection-1",
 observations:[{work_id:"work",workspaces:{items:[{workspace_id:"workspace",read_scope:{work_id:"work",delegation_id:"grant",target_id:"catalog"}}]}}]};
const publication={intent_id:"original",revision:1,files:[{workspace_id:"workspace",revision:1,path:"result.json"}]};
beforeEach(()=>vi.mocked(invoke).mockReset());
describe("original publication resolution",()=>{
 it("reads the exact receipt even when the latest manifest has moved on",async()=>{
  vi.mocked(invoke).mockResolvedValue({publication_observation:{confirmed_publication:publication,latest_confirmed_publication:{intent_id:"new",revision:2}}});
  const files=await publicationDocuments(snapshot,"original","work");
  expect(files.map(f=>[f.workspace,f.revision,f.path])).toEqual([["workspace",1,"result.json"]]);
  expect(invoke).toHaveBeenCalledWith("catalog_publication",{workspaceId:"workspace",intentId:"original",scope:{work_id:"work",delegation_id:"grant",target_id:"catalog",expected_environment_id:"environment",connection_generation:"connection-1"}});
 });
 it("never substitutes another publication or confirmed-retired files",async()=>{
  for(const replacement of [{...publication,intent_id:"other"},{...publication,retirement_state:"confirmed"}]){
   vi.mocked(invoke).mockResolvedValue({publication_observation:{confirmed_publication:replacement}});
   expect(await publicationDocuments(snapshot,"original","work")).toEqual([]);
  }
 });
 it("distinguishes inaccessible evidence from absent evidence and rejects mismatched revisions",async()=>{
  vi.mocked(invoke).mockRejectedValue(new Error("denied"));
  await expect(publicationDocuments(snapshot,"original","work")).rejects.toThrow("unavailable");
  vi.mocked(invoke).mockResolvedValue({publication_observation:{confirmed_publication:{...publication,files:[{workspace_id:"workspace",revision:2,path:"result.json"}]}}});
  await expect(publicationDocuments(snapshot,"original","work")).rejects.toThrow("unavailable");
 });
});
