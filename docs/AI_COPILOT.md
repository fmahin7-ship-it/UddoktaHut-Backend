# Store analytics AI

Notes on the dashboard copilot — how requests flow, what to configure, and where the code lives.

The chat answers from tool results (fixed SQL handlers), not from the model inventing numbers. Routes are `/ai` on the API; the Next app proxies through `/api/ai/stream`.

## How a query runs

1. JWT auth — owner must match the store context.
2. Plan check — AI needs Pro or Business (`includes_ai` on the plan). See [ENTITLEMENTS.md](./ENTITLEMENTS.md).
3. Optional `history` (up to 8 turns) for follow-up questions.
4. Block-list validation on the question text.
5. Intent routing — embed the question (plus recent history when present), match against seeded utterances in pgvector, pick a tier (auto-run one tool, narrow tool list, or full set).
6. Tool loop — OpenAI tool calling, max 3 rounds. `storeName` is always injected server-side.
7. Stream the final answer as plain text chunks.
8. Record estimated tokens against the store monthly AI budget.

Langfuse traces are optional (`LANGFUSE_*` env vars). Each query can be traced as `ai-query`.

## Tools

| Tool | Use for |
|------|---------|
| `get_store_summary` | Store profile, template, product count |
| `get_product_stats` | Totals, active count, avg price, stock units |
| `list_products` | Product list (optional category filter) |
| `get_low_stock_products` | SKUs below threshold |
| `get_categories_breakdown` | Count and value by category |
| `get_order_summary` | Order counts and revenue for a period |
| `get_recent_orders` | Latest orders |
| `get_top_selling_products` | Best sellers for a period |
| `get_returns_summary` | Return/refund aggregates |

Handlers sit in `app/services/ai/tools/`. The LLM never runs raw SQL.

## Chat history

The client may send:

```json
{
  "question": "And by category?",
  "history": [
    { "role": "user", "content": "How many products do I have?" },
    { "role": "assistant", "content": "You have 52 products." }
  ]
}
```

- Max 8 messages in `history`.
- Intent routing uses the last few turns plus the new question so short follow-ups ("which one?", "what about that?") route to a sensible tool.
- The model is told to call tools again for fresh metrics; history is for topic and pronouns, not for stale counts.

## Environment

| Variable | Notes |
|----------|--------|
| `AI_PROVIDER` | `openai` (default) |
| `OPENAI_API_KEY` | Required for chat + embeddings |
| `AI_USE_TOOLS` | Set `false` to disable tool path |
| `AI_INTENT_RESOLUTION` | pgvector routing; off = expose all tools |
| `AI_INTENT_AUTO_RUN` | High-confidence match can run one tool before the answer stream |
| `AI_RATE_LIMIT_MAX` | Per-user window on `POST /ai/query` (default 10/min) |

Intent utterances: `npm run seed-intent-utterances` (use `--replace` to rebuild embeddings).

## Evals

Golden routing tests for dev/CI:

```bash
npm run ai:eval
# optional: EVAL_STORE_NAME=my-store npm run ai:eval -- --min-pass=85
```

Cases live in `app/services/ai/evals/golden/routing.json`. The runner calls the same copilot path with `collectAnswer: true` and checks tools used (and soft refusal on off-topic prompts).

## Code map

```
app/routes/aiRoutes.js
app/controllers/aiController.js
app/services/ai/copilot/runCopilot.js    # shared stream + eval entry
app/services/ai/copilot/prompts.js
app/services/ai/intent/                  # pgvector utterance match
app/services/ai/tools/
app/services/ai/chat/chatHistory.js      # normalize history + intent query text
scripts/run-ai-evals.js
```

Frontend: `uddoktahut` → `hooks/use-ai.js`, `app/api/ai/stream/route.js`, analytics chat components. Session chat is kept in `sessionStorage` on refresh (browser only, not the API).
