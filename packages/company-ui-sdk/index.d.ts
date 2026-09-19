export interface Snapshot<T=unknown>{content:T;sha256:string;workspace:string;revision:number;path:string}
export interface CompanyHost{
 context():Promise<{companyId:string;moduleId:string;version:string;entry:string}>;
 query<T=unknown>(binding:string):Promise<Snapshot<T>>;
 open(binding:string):Promise<{delivered:boolean}>;
 discuss(binding:string):Promise<{delivered:boolean}>;
}
export declare const company:CompanyHost;
