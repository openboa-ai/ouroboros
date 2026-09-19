import { describe, it, expect } from "vitest";
import { retainMessage } from "./outbox";
import { defaultLayout, moveWidget, readLayout } from "@/features/home/layout";
import { destinations } from "@/app/routes";
describe("Protected workspace and personal presentation",()=>{
 it("retains missing-module widgets without introducing routes",()=>{
  const custom=[{id:"one",widget:"removed-company.metric",size:"wide" as const}];
  expect(readLayout(JSON.stringify(custom),[])).toEqual(custom);
  expect(destinations.map(r=>r.id)).toEqual(["home","work","agents","system","conversations","library","notifications"]);
  expect(defaultLayout([])).toEqual([]);
 });
 it("rejects corrupt layouts and preserves immutable order changes",()=>{
  const rows=[{id:"a",widget:"x",size:"small" as const},{id:"b",widget:"x",size:"medium" as const}];
  expect(readLayout(JSON.stringify([rows[0],rows[0]]),[])).toEqual([]);
  expect(moveWidget(rows,"a",1).map(r=>r.id)).toEqual(["b","a"]);
  expect(rows.map(r=>r.id)).toEqual(["a","b"]);
 });
});
describe("Uncertain messages",()=>{
 it("reuses only the identical request within the same environment scope",()=>{
  const map=new Map<string,string>(),storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);}};
  const original={key:"original",text:"Inspect revision 2",replyTo:null};
  retainMessage(storage,"env.company.owner.room",original);
  expect(retainMessage(storage,"env.company.owner.room",{...original,key:"new"}).key).toBe("original");
  expect(()=>retainMessage(storage,"env.company.owner.room",{...original,text:"different"})).toThrow("previous message");
  expect(retainMessage(storage,"another.company.owner.room",{...original,key:"new"}).key).toBe("new");
 });
});
