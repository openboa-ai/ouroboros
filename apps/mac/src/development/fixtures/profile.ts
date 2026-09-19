import type {CompanyProfile} from "@/contracts/company-profile";
/** Fictional preview data, never a fallback for a connected company. */
export const sampleProfile:CompanyProfile={schemaVersion:1,companyId:"sample-company",revision:1,name:"Example company",people:[{principalId:"sample-owner",name:"Alex"},{principalId:"atlas",name:"Atlas",description:"CEO"},{principalId:"nova",name:"Nova",description:"Research"}]};
