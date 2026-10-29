-- Reference data the app needs everywhere (roles, plans, market prices).
-- Idempotent: safe on fresh DBs and on existing production after stamp.

INSERT INTO "roles" ("id", "role_name")
SELECT 1, 'admin'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "id" = 1 OR "role_name" = 'admin');
--> statement-breakpoint
INSERT INTO "roles" ("id", "role_name")
SELECT 2, 'employee'
WHERE NOT EXISTS (SELECT 1 FROM "roles" WHERE "id" = 2 OR "role_name" = 'employee');
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"roles"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "roles"), 1));
--> statement-breakpoint
INSERT INTO "plans" (
  "id", "slug", "name", "billing_cycle", "price",
  "max_products", "includes_ai", "ai_token_limit_monthly"
)
VALUES
  (1, 'trial', 'Free Trial', 'trial', 0, 20, false, 0),
  (2, 'basic', 'Basic', 'monthly', 500, 300, false, 0),
  (3, 'pro', 'Pro', 'monthly', 2500, 700, true, 200000),
  (4, 'business', 'Business', 'monthly', 4000, 2000, true, 1000000)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "billing_cycle" = EXCLUDED."billing_cycle",
  "price" = EXCLUDED."price",
  "max_products" = EXCLUDED."max_products",
  "includes_ai" = EXCLUDED."includes_ai",
  "ai_token_limit_monthly" = EXCLUDED."ai_token_limit_monthly";
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('"plans"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "plans"), 1));
--> statement-breakpoint
INSERT INTO "plan_prices" ("plan_id", "market", "currency", "amount", "is_active")
SELECT p."id", v."market", v."currency", v."amount", true
FROM (VALUES
  ('trial', 'BD', 'BDT', 0),
  ('basic', 'BD', 'BDT', 50000),
  ('pro', 'BD', 'BDT', 150000),
  ('business', 'BD', 'BDT', 400000),
  ('trial', 'AU', 'AUD', 0),
  ('basic', 'AU', 'AUD', 1500),
  ('pro', 'AU', 'AUD', 3900),
  ('business', 'AU', 'AUD', 9900)
) AS v("slug", "market", "currency", "amount")
JOIN "plans" p ON p."slug" = v."slug"
ON CONFLICT ("plan_id", "market") DO UPDATE SET
  "currency" = EXCLUDED."currency",
  "amount" = EXCLUDED."amount",
  "is_active" = true;
