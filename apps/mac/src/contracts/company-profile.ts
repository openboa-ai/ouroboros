/** Display data never establishes a principal, assignment or permission. */
export interface DisplayProfile { principalId:string; name:string; description?:string; }
export interface CompanyProfile { schemaVersion:1; companyId:string; revision:number; name:string; people:DisplayProfile[]; }
export interface CompanyContext { companyId:string; principalId:string; profile:CompanyProfile|null; }
export function readCompanyProfile(value:unknown,companyId:string):CompanyProfile {
 if(!value||typeof value!=="object")throw new Error("Company profile unavailable");
 const p=value as CompanyProfile;
 const text=(v:unknown)=>typeof v==="string"&&v.trim().length>0&&v.length<=160&&!Array.from(v).some(c=>c.charCodeAt(0)<32);
 if(p.schemaVersion!==1||p.companyId!==companyId||!Number.isSafeInteger(p.revision)||p.revision<1||!text(p.name)||!Array.isArray(p.people)||p.people.length>512)throw new Error("Invalid company profile");
 if(new Set(p.people.map(x=>x.principalId)).size!==p.people.length||p.people.some(x=>!text(x.principalId)||!text(x.name)||(x.description!==undefined&&!text(x.description))))throw new Error("Invalid member profile");
 return {schemaVersion:1,companyId,revision:p.revision,name:p.name,people:p.people.map(x=>({principalId:x.principalId,name:x.name,...(x.description?{description:x.description}:{})}))};
}
export function displayName(profile:CompanyProfile|null,id:string){return profile?.people.find(p=>p.principalId===id)?.name??`Member ${id.slice(0,8)}`;}
