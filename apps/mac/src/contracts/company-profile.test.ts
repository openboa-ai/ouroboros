import {describe,it,expect} from 'vitest';
import {readCompanyProfile,displayName} from './company-profile';
import {readCompanyComposition} from './modules';
const profile={schemaVersion:1,companyId:'company-a',revision:1,name:'Example A',people:[{principalId:'owner-a',name:'Alex'}]};
describe('firm data and public product boundary',()=>{
 it('changes display data without changing the stable principal identity',()=>{
  const first=readCompanyProfile(profile,'company-a');const next=readCompanyProfile({...profile,revision:2,people:[{principalId:'owner-a',name:'Robin'}]},'company-a');
  expect(displayName(first,'owner-a')).toBe('Alex');expect(displayName(next,'owner-a')).toBe('Robin');expect(next.people[0].principalId).toBe(first.people[0].principalId);
 });
 it('rejects cross-company data and duplicate principal records, never invents a person',()=>{
  expect(()=>readCompanyProfile(profile,'company-b')).toThrow();expect(()=>readCompanyProfile({...profile,people:[profile.people[0],profile.people[0]]},'company-a')).toThrow();expect(displayName(null,'owner-a')).toBe('Member owner-a');
 });
 it('preserves pinned package references independently of app-bundled components',()=>{
  const config={schemaVersion:2,companyId:'company-a',revision:2,author:'principal-a',pages:[{id:'report',title:'Report',module:'research',screen:'report',widgets:[]}],packages:[{id:'research',path:'releases/v1/manifest.json',revision:7,sha256:'a'.repeat(64)}]};
  const result=readCompanyComposition(config,'company-a');expect(result.packages).toEqual(config.packages);
  expect(()=>readCompanyComposition({...config,packages:[{...config.packages[0],path:'../private.json'}]},'company-a')).toThrow();
  expect(()=>readCompanyComposition({...config,schemaVersion:1},'company-a')).toThrow();
 });
 it('cannot configure Notifications or Owner controls as a Company page',()=>{
  for(const id of ['notifications','controls'])expect(()=>readCompanyComposition({schemaVersion:1,companyId:'company-a',revision:1,author:'Agent',pages:[{id,title:'Override',module:'test',widgets:[]}]},'company-a')).toThrow();
 });
});
