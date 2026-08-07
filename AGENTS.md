# Market Intelligence Development Rules

## Paid API policy

ImportYeti has a fixed project budget of 100 credits.

Reserve at least 25 credits unless the user explicitly overrides this policy.

Before any ImportYeti API request:

1. Check the persistent database cache first.
2. Check whether an existing free data source can answer the query.
3. Estimate the API credit cost.
4. Show:
   - estimated credits
   - percentage of the original 100-credit budget
   - percentage of the remaining balance
5. Ask the user for explicit approval.
6. Do not execute the request without approval.
7. Never automatically approve spending.
8. If actual cost may exceed the approved amount, stop and request approval again.
9. Cache every successful paid response.
10. Reuse cached Top 50 results for Top 20 views.
11. Tests must use mocks or fixtures and must never call paid APIs.

## ImportYeti access

Do not call ImportYeti directly from UI components.

All paid ImportYeti traffic must eventually use a single gateway layer.

Existing cache infrastructure must be reused rather than duplicated.

## Data principles

Store raw paid API responses whenever practical so future parsing or ranking logic can be rebuilt without paying for the same data again.

Prefer free official sources such as UN Comtrade for country-level and HS-code-level statistics.
