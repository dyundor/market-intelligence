import assert from "node:assert/strict";
import test from "node:test";
import { ImportYetiPaidGateway,type CacheAdapter,type PaidOperation,type UsageEvent,type UsageRequest,type UsageStore } from "../app/api/_shared/importyeti-paid-gateway.ts";
import { budgetSnapshot,constantTimeSecretMatch,paidQueryHash } from "../app/api/_shared/importyeti-credit-policy.ts";

class MemoryStore implements UsageStore {
  requests:UsageRequest[]=[]; events:UsageEvent[]=[];
  async findActive(hash:string) { return this.requests.find(row=>row.queryHash===hash&&["awaiting_approval","approved","executing","reapproval_required"].includes(row.status))||null; }
  async get(id:string) { return this.requests.find(row=>row.id===id)||null; }
  async costs() { return {actualSpent:this.requests.filter(row=>row.status==="completed").reduce((sum,row)=>sum+(row.actualCost||0),0),approvedReservations:this.requests.filter(row=>row.status==="approved"||row.status==="executing").reduce((sum,row)=>sum+(row.approvedCost||0),0)}; }
  async create(request:UsageRequest) { if(await this.findActive(request.queryHash))throw new Error("duplicate query");this.requests.push({...request}); }
  async update(id:string,changes:Partial<UsageRequest>) { Object.assign(this.requests.find(row=>row.id===id)!,changes); }
  async reserveApproval(id:string,approvedCost:number,approvedAt:string) { const row=this.requests.find(item=>item.id===id);const costs=await this.costs();if(!row||row.status!=="awaiting_approval"||approvedCost>75-costs.actualSpent-costs.approvedReservations)return false;Object.assign(row,{status:"approved",approvedCost,approvedAt,updatedAt:approvedAt,failureReason:null});return true; }
  async log(event:UsageEvent) { this.events.push({...event}); }
}

function memoryCache():CacheAdapter & {values:Map<string,unknown>;executions:number} {
  const values=new Map<string,unknown>();const running=new Map<string,Promise<unknown>>();
  return {values,executions:0,async read<T>(_provider:string,key:string){return values.has(key)?{value:values.get(key) as T,cache:{hit:true as const,source:"database" as const,storedAt:new Date(0).toISOString(),expiresAt:new Date(86400000).toISOString()}}:null;},async request<T>(_options:{cacheKey:string},fetcher:()=>Promise<T>){const key=_options.cacheKey;if(values.has(key))return {value:values.get(key) as T,cache:{hit:true as const,source:"database" as const,storedAt:new Date(0).toISOString(),expiresAt:new Date(86400000).toISOString()}};let promise=running.get(key) as Promise<T>|undefined;if(!promise){this.executions+=1;promise=fetcher();running.set(key,promise);}const value=await promise!;values.set(key,value);running.delete(key);return {value:value as T,cache:{hit:false as const,source:"upstream" as const,storedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}};}};
}

function operation(overrides:Partial<PaidOperation>={}):PaidOperation {
  return {id:"shipment_search",description:()=>"Mock shipment search",estimate:()=>10,maximumCost:()=>10,execute:async()=>({raw:{results:Array.from({length:50},(_,id)=>({id}))},actualCost:8}),...overrides};
}

test("normalizes Top 20 and Top 50 to the same paid query hash",async()=>{
  assert.equal(await paidQueryHash("shipment_search",{q:" Faucet ",limit:20}),await paidQueryHash("shipment_search",{limit:50,q:"faucet"}));
});

test("cache and free source bypass approval and credit records",async()=>{
  const store=new MemoryStore();const cache=memoryCache();const op=operation({freeSource:async()=>({results:["free"]})});
  let result=await new ImportYetiPaidGateway(store,{shipment_search:op},cache).preflight("shipment_search",{q:"x"});
  assert.equal(result.status,"free_source");assert.equal(store.requests.length,0);
  const cacheKey="shipment_search?limit=50&q=x";cache.values.set(cacheKey,{results:Array.from({length:50},(_,id)=>id)});
  result=await new ImportYetiPaidGateway(store,{shipment_search:operation()},cache).preflight("shipment_search",{q:"x",limit:20});
  assert.equal(result.status,"cache_hit");assert.equal((result.value as {results:number[]}).results.length,20);assert.equal(store.requests.length,0);
});

test("requires explicit approval, preserves reserve, logs actual cost and raw response",async()=>{
  const store=new MemoryStore();const cache=memoryCache();const gateway=new ImportYetiPaidGateway(store,{shipment_search:operation()},cache);
  const preflight=await gateway.preflight("shipment_search",{q:"x",limit:20});
  assert.equal(preflight.status,"awaiting_approval");assert.equal(preflight.request?.percentOfTotalBudget,10);assert.equal(preflight.request?.percentOfRemainingBudget,10);
  assert.equal((await gateway.execute(preflight.request!.id,{q:"x",limit:20})).status,"awaiting_approval");
  assert.equal((await gateway.approve(preflight.request!.id,10,true)).status,"approved");
  const completed=await gateway.execute(preflight.request!.id,{q:"x",limit:20});
  assert.equal(completed.status,"completed");assert.equal(completed.request?.actualCost,8);assert.equal((completed.value as {results:unknown[]}).results.length,20);
  assert.equal((cache.values.values().next().value as {results:unknown[]}).results.length,50);
  assert.ok(store.events.some(event=>event.eventType==="completed"&&event.actualCost===8));
  assert.deepEqual(budgetSnapshot(60,10),{total:100,reserve:25,remainingBeforeReserve:30,available:5});
});

test("blocks reserve spending and requires reapproval before a higher maximum cost",async()=>{
  const blockedStore=new MemoryStore();blockedStore.requests.push({...await seededCompleted(70)});
  const blocked=await new ImportYetiPaidGateway(blockedStore,{shipment_search:operation()},memoryCache()).preflight("shipment_search",{q:"x"});
  assert.equal(blocked.status,"budget_blocked");
  const store=new MemoryStore();const gateway=new ImportYetiPaidGateway(store,{shipment_search:operation({estimate:()=>5,maximumCost:()=>7})},memoryCache());
  const pending=await gateway.preflight("shipment_search",{q:"y"});await gateway.approve(pending.request!.id,5,true);
  assert.equal((await gateway.execute(pending.request!.id,{q:"y"})).status,"reapproval_required");
});

test("dedupes concurrent execution and never accepts an automatic or wrong admin secret",async()=>{
  const store=new MemoryStore();const cache=memoryCache();let releases!:()=>void;const hold=new Promise<void>(resolve=>{releases=resolve});
  const op=operation({execute:async()=>{await hold;return {raw:{results:[1]},actualCost:1}}});const gateway=new ImportYetiPaidGateway(store,{shipment_search:op},cache);
  const pending=await gateway.preflight("shipment_search",{q:"z"});await gateway.approve(pending.request!.id,10,true);
  const first=gateway.execute(pending.request!.id,{q:"z"});const second=gateway.execute(pending.request!.id,{q:"z"});releases();await Promise.all([first,second]);assert.equal(cache.executions,1);
  assert.equal(constantTimeSecretMatch(undefined,"secret"),false);assert.equal(constantTimeSecretMatch("wrong","secret"),false);assert.equal(constantTimeSecretMatch("secret","secret"),true);
});

test("dedupes concurrent preflight requests",async()=>{
  const store=new MemoryStore();const gateway=new ImportYetiPaidGateway(store,{shipment_search:operation()},memoryCache());
  const [left,right]=await Promise.all([gateway.preflight("shipment_search",{q:"same"}),gateway.preflight("shipment_search",{q:"same"})]);
  assert.equal(store.requests.length,1);assert.equal(left.request?.id,right.request?.id);
});

async function seededCompleted(actualCost:number):Promise<UsageRequest> { const now=new Date().toISOString();return {id:crypto.randomUUID(),provider:"importyeti_paid",endpoint:"shipment_search",queryHash:"old",queryDescription:"old",estimatedCost:actualCost,approvedCost:actualCost,actualCost,totalBudget:100,reserveBudget:25,remainingBudgetBefore:100,remainingBudgetAfter:100-actualCost,percentOfTotalBudget:actualCost,percentOfRemainingBudget:actualCost,status:"completed",failureReason:null,approvedAt:now,executedAt:now,createdAt:now,updatedAt:now}; }
