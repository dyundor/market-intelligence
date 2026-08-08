import { env } from "cloudflare:workers";
import { cachedApiRequest,readCachedApiValue } from "./paid-cache";
import { IMPORTYETI_PROVIDER,type PaidGatewayStatus } from "./importyeti-credit-policy";
import { ImportYetiPaidGateway,type UsageEvent,type UsageRequest,type UsageStore } from "./importyeti-paid-gateway";
import { createCompanySearchOperation, createProductSearchOperation } from "./importyeti-production-provider";

let schemaReady:Promise<void>|null = null;
async function initializeUsageSchema() {
  if (!schemaReady) schemaReady = (async () => {
    if (!env.DB) throw new Error("Usage database is unavailable");
    await env.DB.batch([
      env.DB.prepare("CREATE TABLE IF NOT EXISTS api_usage_requests (id TEXT PRIMARY KEY, provider TEXT NOT NULL, endpoint TEXT NOT NULL, query_hash TEXT NOT NULL, query_description TEXT NOT NULL, estimated_cost TEXT NOT NULL, approved_cost TEXT, actual_cost TEXT, total_budget TEXT NOT NULL DEFAULT '100', reserve_budget TEXT NOT NULL DEFAULT '25', remaining_budget_before TEXT, remaining_budget_after TEXT, percent_of_total_budget TEXT, percent_of_remaining_budget TEXT, status TEXT NOT NULL DEFAULT 'awaiting_approval', failure_reason TEXT, approved_at TEXT, executed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS api_usage_requests_provider_status_idx ON api_usage_requests(provider,status)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS api_usage_requests_query_hash_idx ON api_usage_requests(query_hash)"),
      env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS api_usage_requests_active_query_uq ON api_usage_requests(provider,query_hash) WHERE status IN ('awaiting_approval','approved','executing','reapproval_required')"),
      env.DB.prepare("CREATE TABLE IF NOT EXISTS api_usage_log (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, provider TEXT NOT NULL, query_hash TEXT NOT NULL, event_type TEXT NOT NULL, estimated_cost TEXT, approved_cost TEXT, actual_cost TEXT, remaining_budget_before TEXT, remaining_budget_after TEXT, detail TEXT, created_at TEXT NOT NULL)"),
      env.DB.prepare("CREATE INDEX IF NOT EXISTS api_usage_log_request_date_idx ON api_usage_log(request_id,created_at)"),
    ]);
  })().catch(error => {schemaReady=null;throw error;});
  return schemaReady;
}

const columns = "id,provider,endpoint,query_hash,query_description,estimated_cost,approved_cost,actual_cost,total_budget,reserve_budget,remaining_budget_before,remaining_budget_after,percent_of_total_budget,percent_of_remaining_budget,status,failure_reason,approved_at,executed_at,created_at,updated_at";

export class D1UsageStore implements UsageStore {
  async findActive(queryHash:string) { await initializeUsageSchema(); const row=await env.DB.prepare(`SELECT ${columns} FROM api_usage_requests WHERE provider=? AND query_hash=? AND status IN ('awaiting_approval','approved','executing','reapproval_required') ORDER BY created_at DESC LIMIT 1`).bind(IMPORTYETI_PROVIDER,queryHash).first<Record<string,unknown>>(); return row?mapRow(row):null; }
  async get(id:string) { await initializeUsageSchema(); const row=await env.DB.prepare(`SELECT ${columns} FROM api_usage_requests WHERE id=?`).bind(id).first<Record<string,unknown>>(); return row?mapRow(row):null; }
  async costs() { await initializeUsageSchema(); const row=await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN status='completed' THEN CAST(actual_cost AS REAL) ELSE 0 END),0) actual_spent, COALESCE(SUM(CASE WHEN status IN ('approved','executing') THEN CAST(approved_cost AS REAL) ELSE 0 END),0) approved_reservations FROM api_usage_requests WHERE provider=?").bind(IMPORTYETI_PROVIDER).first<{actual_spent:number;approved_reservations:number}>(); return {actualSpent:Number(row?.actual_spent||0),approvedReservations:Number(row?.approved_reservations||0)}; }
  async create(r:UsageRequest) { await initializeUsageSchema(); await env.DB.prepare("INSERT INTO api_usage_requests (id,provider,endpoint,query_hash,query_description,estimated_cost,approved_cost,actual_cost,total_budget,reserve_budget,remaining_budget_before,remaining_budget_after,percent_of_total_budget,percent_of_remaining_budget,status,failure_reason,approved_at,executed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(r.id,r.provider,r.endpoint,r.queryHash,r.queryDescription,num(r.estimatedCost),num(r.approvedCost),num(r.actualCost),num(r.totalBudget),num(r.reserveBudget),num(r.remainingBudgetBefore),num(r.remainingBudgetAfter),num(r.percentOfTotalBudget),num(r.percentOfRemainingBudget),r.status,r.failureReason,r.approvedAt,r.executedAt,r.createdAt,r.updatedAt).run(); }
  async update(id:string,changes:Partial<UsageRequest>) { await initializeUsageSchema(); const fields:Record<string,unknown>={status:changes.status,approved_cost:changes.approvedCost,estimated_cost:changes.estimatedCost,actual_cost:changes.actualCost,remaining_budget_after:changes.remainingBudgetAfter,failure_reason:changes.failureReason,approved_at:changes.approvedAt,executed_at:changes.executedAt,updated_at:changes.updatedAt}; const entries=Object.entries(fields).filter(([,v])=>v!==undefined); if(entries.length)await env.DB.prepare(`UPDATE api_usage_requests SET ${entries.map(([k])=>`${k}=?`).join(",")} WHERE id=?`).bind(...entries.map(([k,v])=>k.includes("cost")||k.includes("budget")?num(v as number|null):v),id).run(); }
  async reserveApproval(id:string,approvedCost:number,approvedAt:string) { await initializeUsageSchema(); const result=await env.DB.prepare("UPDATE api_usage_requests SET status='approved',approved_cost=?,approved_at=?,updated_at=?,failure_reason=NULL WHERE id=? AND status='awaiting_approval' AND ? <= 75 - COALESCE((SELECT SUM(CASE WHEN status='completed' THEN CAST(actual_cost AS REAL) WHEN status IN ('approved','executing') THEN CAST(approved_cost AS REAL) ELSE 0 END) FROM api_usage_requests WHERE provider=? AND id<>?),0)").bind(num(approvedCost),approvedAt,approvedAt,id,approvedCost,IMPORTYETI_PROVIDER,id).run(); return Number(result.meta.changes||0)===1; }
  async log(e:UsageEvent) { await initializeUsageSchema(); await env.DB.prepare("INSERT INTO api_usage_log (id,request_id,provider,query_hash,event_type,estimated_cost,approved_cost,actual_cost,remaining_budget_before,remaining_budget_after,detail,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),e.requestId,IMPORTYETI_PROVIDER,e.queryHash,e.eventType,num(e.estimatedCost),num(e.approvedCost),num(e.actualCost),num(e.remainingBefore),num(e.remainingAfter),e.detail??null,new Date().toISOString()).run(); }
}

function num(value:number|null|undefined) { return value===null||value===undefined?null:String(value); }
function mapRow(row:Record<string,unknown>):UsageRequest { const n=(v:unknown)=>v===null||v===undefined?null:Number(v); return {id:String(row.id),provider:String(row.provider),endpoint:String(row.endpoint),queryHash:String(row.query_hash),queryDescription:String(row.query_description),estimatedCost:Number(row.estimated_cost),approvedCost:n(row.approved_cost),actualCost:n(row.actual_cost),totalBudget:Number(row.total_budget),reserveBudget:Number(row.reserve_budget),remainingBudgetBefore:n(row.remaining_budget_before),remainingBudgetAfter:n(row.remaining_budget_after),percentOfTotalBudget:n(row.percent_of_total_budget),percentOfRemainingBudget:n(row.percent_of_remaining_budget),status:String(row.status) as PaidGatewayStatus,failureReason:row.failure_reason===null?null:String(row.failure_reason),approvedAt:row.approved_at===null?null:String(row.approved_at),executedAt:row.executed_at===null?null:String(row.executed_at),createdAt:String(row.created_at),updatedAt:String(row.updated_at)}; }

export function createProductionImportYetiGateway() {
  const operations: Record<string, typeof import("./importyeti-paid-gateway.ts")["PaidOperation"]> = {
    importyeti_company_search: createCompanySearchOperation({
      IMPORTYETI_API_KEY: (env as Record<string, string>).IMPORTYETI_API_KEY,
      IMPORTYETI_API_URL: (env as Record<string, string>).IMPORTYETI_API_URL,
    }),
    importyeti_product_search: createProductSearchOperation({
      IMPORTYETI_API_KEY: (env as Record<string, string>).IMPORTYETI_API_KEY,
      IMPORTYETI_API_URL: (env as Record<string, string>).IMPORTYETI_API_URL,
    }),
  };
  return new ImportYetiPaidGateway(new D1UsageStore(), operations, {read:readCachedApiValue,request:cachedApiRequest});
}
