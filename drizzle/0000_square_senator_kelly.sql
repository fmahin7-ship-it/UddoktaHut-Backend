CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "ai_usage_monthly" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"period" varchar(7) NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar DEFAULT 'stripe' NOT NULL,
	"event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"payload_json" jsonb,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" varchar NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"order_item_id" integer NOT NULL,
	"quantity_returned" integer NOT NULL,
	"restock" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"status" varchar(32) DEFAULT 'requested' NOT NULL,
	"reason" text,
	"merchant_note" text,
	"refund_status" varchar(32) DEFAULT 'none' NOT NULL,
	"refund_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"order_number" varchar(32) NOT NULL,
	"customer_name" varchar NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"customer_address" text NOT NULL,
	"note" text,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(32) DEFAULT 'cod' NOT NULL,
	"payment_status" varchar(32) DEFAULT 'unpaid' NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "plan_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"market" varchar(2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" integer NOT NULL,
	"gateway_price_id" varchar,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar NOT NULL,
	"billing_cycle" varchar NOT NULL,
	"price" integer NOT NULL,
	"max_products" integer DEFAULT 20 NOT NULL,
	"includes_ai" boolean DEFAULT false NOT NULL,
	"ai_token_limit_monthly" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"image" varchar,
	"price" numeric(12, 2) NOT NULL,
	"stock" integer NOT NULL,
	"status" varchar NOT NULL,
	"category" varchar NOT NULL,
	"sku" varchar NOT NULL,
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_name" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"store_name" varchar NOT NULL,
	"store_url" varchar NOT NULL,
	"store_type" varchar NOT NULL,
	"store_address" varchar,
	"country" varchar(2) DEFAULT 'BD' NOT NULL,
	"template_name" varchar DEFAULT 'default',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "stores_store_name_unique" UNIQUE("store_name"),
	CONSTRAINT "stores_store_url_unique" UNIQUE("store_url")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"status" varchar,
	"start_date" timestamp with time zone DEFAULT now(),
	"trial_ends_at" timestamp with time zone,
	"end_date" timestamp with time zone,
	"is_auto_renew" boolean DEFAULT false,
	"plan_id" integer,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"billing_provider" varchar,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_routing" (
	"id" serial PRIMARY KEY NOT NULL,
	"example_question" text NOT NULL,
	"tool_name" varchar(64) NOT NULL,
	"locale" varchar(8) DEFAULT 'any' NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"onboarded" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar,
	"phone_number" varchar,
	"name" varchar NOT NULL,
	"password" varchar NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage_monthly" ADD CONSTRAINT "ai_usage_monthly_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_return_id_order_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."order_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_webhook_events_provider_event_uidx" ON "billing_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_prices_plan_market_uidx" ON "plan_prices" USING btree ("plan_id","market");