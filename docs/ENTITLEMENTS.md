# Plan entitlements

Per-plan caps on products and AI usage. Trial/expiry behaviour is still in [SUBSCRIPTION.md](./SUBSCRIPTION.md) — read that first if you are debugging access denied on writes.

Each store's subscription row points at a `plans` record (`slug`, `max_products`, `includes_ai`, `ai_token_limit_monthly`). Middleware checks those columns before product create and before `POST /ai/query`.

## Plan catalog (seeded)

| Slug | `max_products` | `includes_ai` | `ai_token_limit_monthly` |
|------|----------------|---------------|---------------------------|
| `trial` | 20 | no | 0 |
| `basic` | 300 | no | 0 |
| `pro` | 700 | yes | 10,000 |
| `business` | 2000 | yes | 50,000 |

Migration: `migrations/20250621140000-plan-entitlements-and-ai-usage.cjs`.

## What gets enforced

**Products** — `POST /product` (create) checks count against `max_products`. Returns `PRODUCT_LIMIT_REACHED` at cap.

**AI chat** — `POST /ai/query` requires `includes_ai` on the plan (`AI_PLAN_REQUIRED` if not). Before the LLM runs, usage is checked against `ai_token_limit_monthly` (`AI_TOKEN_LIMIT_EXCEEDED`). After a successful stream, tokens are added to `ai_usage_monthly` (store + `YYYY-MM` period).

**Expired subscription** — existing middleware still blocks owner writes and can hide the public store. Entitlements do not bypass expiry.

## Subscription status API

`GET /subscription/status` (authenticated) now includes plan and usage fields on the user object when a store exists:

- `planSlug`, `planName`
- `includesAi`
- `maxProducts`, `productCount`, `productsRemaining`
- `aiTokenLimitMonthly`, `aiTokensUsed`, `aiTokensRemaining`
- `isActive`, `subscriptionStatus`

The dashboard uses this to show upgrade prompts and hide the analytics AI entry on trial/basic.

## Changing a plan in dev

There is no self-serve billing API yet. For local/staging:

```bash
npm run set-store-plan
# or: STORE_EMAIL=owner@example.com PLAN=pro npm run set-store-plan
```

That updates `subscriptions.plan_id` for the owner's store.

## Code map

```
app/constants/plans.js
app/services/subscription/entitlements.js
app/services/subscription/productLimitService.js
app/services/subscription/aiUsageService.js
app/middleware/entitlementMiddleware.js
scripts/set-store-plan.js
```

Error codes: `app/constants/plans.js` → `SUBSCRIPTION_ERROR_CODES`.
