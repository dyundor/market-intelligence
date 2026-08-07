# Query Engine

版本：V1（Sprint 1 完成：Query Engine Core + 两个真实路由迁移）

## 为什么存在

任何页面不能直接查询数据库或调用 Provider。所有数据访问统一走 Query Engine，
由它决定：什么时候用免费数据、什么时候需要付费数据、如何缓存、如何估算成本、
如何审批。目标是让数据访问有唯一入口，为 Top 50、Buyer Ranking、Credits 控制
提供复用基础。

## 分层

```
页面/API Route
   ↓ executeQuery()
Query Engine (lib/query/engine.ts)
   ├─ Validator   校验意图/市场/期间/排名
   ├─ Hash        查询标准化 → SHA-256 queryId（Top20 与 Top50 同 hash）
   ├─ Planner     选择 Provider（免费优先），记录拒绝原因
   ├─ Resolver    Cache → Provider 顺序解析（CacheResolver）
   ├─ Budget      Credits 估算（免费 0 / 付费按量）
   ├─ Normalizer  不同源格式 → 统一结构
   └─ Logger      每次查询记录
```

## 统一返回结构

所有 `executeQuery()` 返回：

```json
{
  "queryId": "sha256...",
  "intent": "buyer_ranking | supplier_ranking | trade_trend",
  "source": ["importyeti_web"],
  "cached": true,
  "cost": { "estimated": 0, "percentOfTotal": 0 },
  "data": { "kind": "trade" | "discovery" | "companies", ... },
  "metadata": { "provider": "...", "cached": true, "fetchedAt": "..." },
  "status": "cache_hit | completed | awaiting_approval | failed"
}
```

- `status === "awaiting_approval"`：付费 Provider 且未获审批，不执行、不扣 credits。
- `cost.estimated`：付费查询的预估 credits；免费查询恒为 0。

## 目录

```
lib/
├── query/
│   ├── types.ts       统一类型（QueryRequest / QueryResult / NormalizedData）
│   ├── hash.ts        标准化 + SHA-256
│   ├── validator.ts   输入校验
│   ├── planner.ts     Provider 选择（免费优先）+ 拒绝原因
│   └── engine.ts      executeQuery 编排
├── providers/
│   ├── types.ts       Provider / ProviderCapability / ProviderRegistry 接口
│   ├── registry.ts    SimpleProviderRegistry
│   ├── comtrade/      真实 UN Comtrade Provider（月/年、fallback 探测、伙伴图）
│   ├── importyeti-web/ 真实 ImportYeti 免费 web 数据 Provider（D1 查询）
│   └── mock/          测试用 Mock Provider
├── normalizers/       源格式 → TradeMetric / SupplierDiscovery / Company
└── cache/resolver.ts  CacheResolver（缓存命中则跳过 Provider）
```

## 已迁移路由

| 路由 | Intent | Provider | 说明 |
|---|---|---|---|
| `/api/trade` | `trade_trend` | comtrade（免费） | 官方统计，含 fallback 探测 |
| `/api/supplier-discovery` | `buyer_ranking` | importyeti_web（免费） | 企业级逐票数据（存储于 D1） |

## 缓存顺序

1. Database Cache（`paid_api_cache`，经 `D1CacheAdapter`）
2. Provider 调用（免费）
3. 付费 Provider（需审批，当前未注册真实 operation）

## 预算与审批

- 总预算 100 credits，默认保留 25。
- 付费查询：planner 估算 → 超出预算 `budget_blocked`；未审批 `awaiting_approval`，
  审批流程复用 `/api/importyeti-paid` 网关。
- 测试全部使用 Mock，不调用付费 API（见 `tests/query-engine.test.ts` 集成测试）。

## 设计边界（V1 不含）

- 不含 Opportunity Score / AI 分析 / 任务调度（属于 Ranking Engine / AI Insight
  Engine / Scheduler，未来独立模块）。
- 付费 Provider 仅作骨架，未注册真实 operation，不会消耗 credits。

## 如何新增一个 Provider

1. 实现 `Provider` 接口（capability + fetch）。
2. 在 `lib/providers/mock/capabilities.ts` 注册 capability（含 `estimateCredits`）。
3. 在 `app/api/_shared/query-engine-production.ts` 的 `createQueryEngine` 中装配。
4. 在 normalizers 中把 fetch 结果转换为统一 `NormalizedData`。
5. 路由调用 `engine.execute({ intent, subject, market, period, ... })`。
