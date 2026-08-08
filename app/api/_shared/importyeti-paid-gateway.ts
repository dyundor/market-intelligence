import {
  IMPORTYETI_PROVIDER,
  IMPORTYETI_RESERVE_CREDITS,
  IMPORTYETI_TOTAL_CREDITS,
  budgetSnapshot,
  costPercentages,
  limitPaidResponse,
  normalizePaidQuery,
  paidQueryHash,
  roundCredits,
  type PaidGatewayStatus,
  type QueryParameters,
} from "./importyeti-credit-policy.ts";

export type UsageRequest = {
  id:string; provider:string; endpoint:string; queryHash:string; queryDescription:string;
  estimatedCost:number; approvedCost:number|null; actualCost:number|null;
  totalBudget:number; reserveBudget:number; remainingBudgetBefore:number|null; remainingBudgetAfter:number|null;
  percentOfTotalBudget:number|null; percentOfRemainingBudget:number|null;
  status:PaidGatewayStatus; failureReason:string|null; approvedAt:string|null; executedAt:string|null;
  createdAt:string; updatedAt:string;
};

export type UsageEvent = {
  requestId:string; queryHash:string; eventType:string; estimatedCost?:number|null;
  approvedCost?:number|null; actualCost?:number|null; remainingBefore?:number|null;
  remainingAfter?:number|null; detail?:string|null;
};

export interface UsageStore {
  findActive(queryHash:string):Promise<UsageRequest|null>;
  get(id:string):Promise<UsageRequest|null>;
  costs():Promise<{actualSpent:number;approvedReservations:number}>;
  create(request:UsageRequest):Promise<void>;
  update(id:string,changes:Partial<UsageRequest>):Promise<void>;
  reserveApproval(id:string,approvedCost:number,approvedAt:string):Promise<boolean>;
  log(event:UsageEvent):Promise<void>;
}

export type PaidOperation = {
  id:string;
  description:(parameters:QueryParameters)=>string;
  estimate:(parameters:QueryParameters)=>number;
  maximumCost:(parameters:QueryParameters)=>number;
  freeSource?:(parameters:QueryParameters)=>Promise<unknown|null>;
  execute?:(parameters:QueryParameters)=>Promise<{raw:unknown;actualCost:number}>;
  ttlMs?:number;
};

type CacheResult<T> = {value:T;cache:{hit:boolean;source:"database"|"coalesced"|"upstream"|"stale"|"memory";storedAt:string;expiresAt:string}};

export type GatewayResult<T=unknown> = {
  status:PaidGatewayStatus;
  request?:UsageRequest;
  value?:T;
  cache?:CacheResult<T>["cache"];
  reason?:string;
};

export type CacheAdapter = {
  read:<T>(provider:string,key:string)=>Promise<CacheResult<T>|null>;
  request:<T>(options:{provider:string;cacheKey:string;ttlMs:number;staleTtlMs?:number;requirePersistent?:boolean},fetcher:()=>Promise<T>)=>Promise<CacheResult<T>>;
};

const productionOperations:Record<string,PaidOperation> = {};

export class ImportYetiPaidGateway {
  private readonly store:UsageStore;
  private readonly operations:Record<string,PaidOperation>;
  private readonly cache:CacheAdapter;
  private readonly executions=new Map<string,Promise<GatewayResult>>();

  constructor(
    store:UsageStore,
    operations:Record<string,PaidOperation> = productionOperations,
    cache:CacheAdapter,
  ) {
    this.store=store;
    this.operations=operations;
    this.cache=cache;
  }

  async preflight(operationId:string,parameters:QueryParameters):Promise<GatewayResult> {
    const normalized = normalizePaidQuery(operationId,parameters);
    const operation = this.operations[normalized.operation];
    if (!operation) return {status:"failed",reason:"Unsupported ImportYeti paid operation"};
    const queryHash = await paidQueryHash(operation.id,normalized.parameters);
    const cacheKey = canonicalCacheKey(operation.id,normalized.parameters as Record<string,string|number|boolean|null>);
    const cached = await this.cache.read<unknown>(IMPORTYETI_PROVIDER,cacheKey);
    if (cached) return {status:"cache_hit",value:limitPaidResponse(cached.value,normalized.responseLimit),cache:cached.cache};

    const freeValue = await operation.freeSource?.(normalized.parameters);
    if (freeValue !== undefined && freeValue !== null) return {status:"free_source",value:limitPaidResponse(freeValue,normalized.responseLimit)};

    const active = await this.store.findActive(queryHash);
    if (active) return {status:active.status,request:active};

    const estimatedCost = checkedCost(operation.estimate(normalized.parameters));
    const {actualSpent,approvedReservations} = await this.store.costs();
    const budget = budgetSnapshot(actualSpent,approvedReservations);

    if (budget.available <= 0) {
      return {
        status: "credit_required",
        reason: [
          "ImportYeti credits are required before running paid collection.",
          `Estimated cost: ${estimatedCost} credits`,
          `Available: ${budget.available} credits (${IMPORTYETI_TOTAL_CREDITS} total, ${IMPORTYETI_RESERVE_CREDITS} reserved)`,
          "Recommended action: Add credits first",
        ].join("\n"),
      };
    }

    const percentages = costPercentages(estimatedCost,budget.remainingBeforeReserve);
    const now = new Date().toISOString();
    const blocked = estimatedCost > budget.available;
    const request:UsageRequest = {
      id:crypto.randomUUID(),provider:IMPORTYETI_PROVIDER,endpoint:operation.id,queryHash,
      queryDescription:operation.description(normalized.parameters),estimatedCost,approvedCost:null,actualCost:null,
      totalBudget:IMPORTYETI_TOTAL_CREDITS,reserveBudget:IMPORTYETI_RESERVE_CREDITS,
      remainingBudgetBefore:budget.remainingBeforeReserve,remainingBudgetAfter:null,
      percentOfTotalBudget:percentages.percentOfTotal,percentOfRemainingBudget:percentages.percentOfRemaining,
      status:blocked ? "budget_blocked" : "awaiting_approval",failureReason:blocked ? "Estimated cost would spend the reserved credits" : null,
      approvedAt:null,executedAt:null,createdAt:now,updatedAt:now,
    };
    try {
      await this.store.create(request);
    } catch (error) {
      const matching = await this.store.findActive(queryHash);
      if (matching) return {status:matching.status,request:matching};
      throw error;
    }
    await this.store.log({requestId:request.id,queryHash,eventType:request.status,estimatedCost,remainingBefore:budget.remainingBeforeReserve,detail:request.failureReason});
    return {status:request.status,request};
  }

  async approve(requestId:string,approvedCost:number,approve:boolean):Promise<GatewayResult> {
    const request = await this.store.get(requestId);
    if (!request) return {status:"failed",reason:"Usage request not found"};
    if (!approve) {
      await this.store.update(requestId,{status:"failed",failureReason:"Rejected by administrator",updatedAt:new Date().toISOString()});
      await this.store.log({requestId,queryHash:request.queryHash,eventType:"rejected",estimatedCost:request.estimatedCost,detail:"Rejected by administrator"});
      return {status:"failed",request:{...request,status:"failed",failureReason:"Rejected by administrator"}};
    }
    const approved = checkedCost(approvedCost);
    if (approved < request.estimatedCost) return {status:"failed",reason:"Approved cost cannot be lower than estimated cost"};
    const {actualSpent,approvedReservations} = await this.store.costs();
    const budget = budgetSnapshot(actualSpent,approvedReservations);
    if (approved > budget.available) {
      await this.store.update(requestId,{status:"budget_blocked",failureReason:"Approval would spend reserved credits",updatedAt:new Date().toISOString()});
      await this.store.log({requestId,queryHash:request.queryHash,eventType:"budget_blocked",estimatedCost:request.estimatedCost,approvedCost:approved,remainingBefore:budget.remainingBeforeReserve});
      return {status:"budget_blocked",request:{...request,status:"budget_blocked",failureReason:"Approval would spend reserved credits"}};
    }
    const now = new Date().toISOString();
    if (!await this.store.reserveApproval(requestId,approved,now)) {
      await this.store.update(requestId,{status:"budget_blocked",failureReason:"Concurrent approval exhausted the available credits",updatedAt:now});
      await this.store.log({requestId,queryHash:request.queryHash,eventType:"budget_blocked",estimatedCost:request.estimatedCost,approvedCost:approved,remainingBefore:budget.remainingBeforeReserve,detail:"Concurrent approval exhausted the available credits"});
      return {status:"budget_blocked",request:{...request,status:"budget_blocked",failureReason:"Concurrent approval exhausted the available credits"}};
    }
    await this.store.log({requestId,queryHash:request.queryHash,eventType:"approved",estimatedCost:request.estimatedCost,approvedCost:approved,remainingBefore:budget.remainingBeforeReserve});
    return {status:"approved",request:{...request,status:"approved",approvedCost:approved,approvedAt:now,updatedAt:now,failureReason:null}};
  }

  async execute(requestId:string,parameters:QueryParameters):Promise<GatewayResult> {
    const running=this.executions.get(requestId);
    if (running) return running;
    const promise=this.executeOnce(requestId,parameters).finally(()=>this.executions.delete(requestId));
    this.executions.set(requestId,promise);
    return promise;
  }

  private async executeOnce(requestId:string,parameters:QueryParameters):Promise<GatewayResult> {
    const request = await this.store.get(requestId);
    if (!request) return {status:"failed",reason:"Usage request not found"};
    if (request.status !== "approved" || request.approvedCost === null) return {status:request.status,request,reason:"Explicit approval is required"};
    const normalized = normalizePaidQuery(request.endpoint,parameters);
    const expectedHash = await paidQueryHash(request.endpoint,normalized.parameters);
    if (expectedHash !== request.queryHash) return {status:"failed",reason:"Approved query does not match execution query"};
    const operation = this.operations[request.endpoint];
    if (!operation?.execute) return {status:"execution_disabled",request,reason:"ImportYeti paid transport is not configured"};
    const maximumCost = checkedCost(operation.maximumCost(normalized.parameters));
    if (maximumCost > request.approvedCost) {
      const now = new Date().toISOString();
      await this.store.update(requestId,{status:"reapproval_required",estimatedCost:maximumCost,failureReason:"Maximum cost exceeds approved cost",updatedAt:now});
      await this.store.log({requestId,queryHash:request.queryHash,eventType:"reapproval_required",estimatedCost:maximumCost,approvedCost:request.approvedCost,detail:"Maximum cost exceeds approved cost"});
      return {status:"reapproval_required",request:{...request,status:"reapproval_required",estimatedCost:maximumCost,failureReason:"Maximum cost exceeds approved cost",updatedAt:now}};
    }
    const cacheKey = canonicalCacheKey(operation.id,normalized.parameters as Record<string,string|number|boolean|null>);
    let actualCost = 0;
    try {
      const result = await this.cache.request<unknown>({provider:IMPORTYETI_PROVIDER,cacheKey,ttlMs:operation.ttlMs || 365*24*60*60*1000,staleTtlMs:365*24*60*60*1000},async () => {
        const executed = await operation.execute!(normalized.parameters);
        actualCost = checkedCost(executed.actualCost);
        if (actualCost > request.approvedCost!) throw new Error("Reported actual cost exceeds approved cost");
        return executed.raw;
      });
      const {actualSpent,approvedReservations} = await this.store.costs();
      const before = budgetSnapshot(actualSpent,Math.max(0,approvedReservations-request.approvedCost)).remainingBeforeReserve;
      const after = roundCredits(before-actualCost);
      const now = new Date().toISOString();
      await this.store.update(requestId,{status:"completed",actualCost,remainingBudgetAfter:after,executedAt:now,updatedAt:now,failureReason:null});
      await this.store.log({requestId,queryHash:request.queryHash,eventType:"completed",estimatedCost:request.estimatedCost,approvedCost:request.approvedCost,actualCost,remainingBefore:before,remainingAfter:after});
      return {status:result.cache.hit ? "cache_hit" : "completed",request:{...request,status:"completed",actualCost,remainingBudgetAfter:after,executedAt:now,updatedAt:now},value:limitPaidResponse(result.value,normalized.responseLimit),cache:result.cache};
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown paid gateway error";
      const status:PaidGatewayStatus = message.includes("exceeds approved") ? "reapproval_required" : "failed";
      await this.store.update(requestId,{status,failureReason:message,updatedAt:new Date().toISOString()});
      await this.store.log({requestId,queryHash:request.queryHash,eventType:status,estimatedCost:request.estimatedCost,approvedCost:request.approvedCost,detail:message});
      return {status,request:{...request,status,failureReason:message},reason:message};
    }
  }
}

function checkedCost(value:number) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid ImportYeti credit estimate");
  return roundCredits(value);
}

function canonicalCacheKey(endpoint:string,parameters:Record<string,unknown>) {
  const normalized = Object.entries(parameters).map(([key,value]) => [key,String(value)]).sort(([left],[right]) => left.localeCompare(right));
  return `${endpoint}?${new URLSearchParams(normalized).toString()}`;
}
