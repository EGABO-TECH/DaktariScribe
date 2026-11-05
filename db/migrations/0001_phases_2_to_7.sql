CREATE TABLE "billing_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"phone_masked" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blob" (
	"key" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_value" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"encounter_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"template_id" text NOT NULL,
	"field_key" text NOT NULL,
	"num_value" real,
	"text_value" text,
	"site" text NOT NULL,
	"encounter_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"tokens" real NOT NULL,
	"refilled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event" text NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pass" ADD COLUMN "seats" integer;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "provider_invoice_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "invoice_url" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "seats" integer;--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "file_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "duration_sec" real;--> statement-breakpoint
ALTER TABLE "source" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "metric_value" ADD CONSTRAINT "metric_value_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "metric_org_field_date_idx" ON "metric_value" USING btree ("org_id","field_key","encounter_date");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_encounter_field_uq" ON "metric_value" USING btree ("encounter_id","field_key");