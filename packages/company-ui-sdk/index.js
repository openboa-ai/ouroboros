/** Packaged by the firm build. The native host supplies a narrowly bound bridge. */
function request(value) {
 const host=globalThis.__OURO_COMPANY__;
 if(!host||typeof host.request!=="function")return Promise.reject(new Error("Company host unavailable"));
 return host.request(value);
}
export const company=Object.freeze({
 context:()=>request({kind:"context"}),
 query:binding=>request({kind:"query",binding}),
 open:binding=>request({kind:"open",binding}),
 discuss:binding=>request({kind:"discuss",binding}),
});
