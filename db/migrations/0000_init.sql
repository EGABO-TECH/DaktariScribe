CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounter" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"worker_id" text NOT NULL,
	"worker_name" text NOT NULL,
	"template_id" text NOT NULL,
	"template_version" integer NOT NULL,
	"site" text NOT NULL,
	"encounter_date" date NOT NULL,
	"respondent_ref" text,
	"consent_obtained" boolean NOT NULL,
	"interview_language" text DEFAULT 'eng' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"current_version_id" text,
	"device_created_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"scope" jsonb NOT NULL,
	"format" text NOT NULL,
	"language" text DEFAULT 'eng' NOT NULL,
	"storage_key" text,
	"created_by" text NOT NULL,
	"watermark" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"amount_ugx" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider_ref" text,
	"pdf_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"clerk_user_id" text NOT NULL,
	"role" text DEFAULT 'worker' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisation" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_key" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"seat_limit" integer,
	"monthly_encounter_quota" integer,
	"default_language" text DEFAULT 'eng' NOT NULL,
	"data_region" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pass" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"product_code" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reports_total" integer NOT NULL,
	"reports_used" integer DEFAULT 0 NOT NULL,
	"voice_seconds_total" integer NOT NULL,
	"voice_seconds_used" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_payment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"reference" text NOT NULL,
	"product_code" text NOT NULL,
	"amount_ugx" integer NOT NULL,
	"method" text NOT NULL,
	"phone_masked" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_transaction_id" text,
	"raw_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refined_version" (
	"id" text PRIMARY KEY NOT NULL,
	"encounter_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"created_by" text NOT NULL,
	"content" text NOT NULL,
	"verification" jsonb,
	"parent_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signoff" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"signer_id" text NOT NULL,
	"signer_name" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"statement" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"encounter_id" text NOT NULL,
	"kind" text NOT NULL,
	"storage_key" text,
	"mime_type" text,
	"bytes" bigint,
	"raw_text" text,
	"language" text,
	"engine" text,
	"segments" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"definition" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"target_language" text NOT NULL,
	"engine" text NOT NULL,
	"content" text NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"quality_tier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"phone_hash" text NOT NULL,
	"device_hash" text,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"quantity" bigint NOT NULL,
	"cost_usd_micros" bigint DEFAULT 0 NOT NULL,
	"encounter_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounter" ADD CONSTRAINT "encounter_template_id_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."template"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export" ADD CONSTRAINT "export_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refined_version" ADD CONSTRAINT "refined_version_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoff" ADD CONSTRAINT "signoff_version_id_refined_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."refined_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_encounter_id_encounter_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounter"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_org_id_organisation_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organisation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_version_id_refined_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."refined_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_log" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "encounter_org_date_idx" ON "encounter" USING btree ("org_id","encounter_date");--> statement-breakpoint
CREATE INDEX "encounter_org_worker_idx" ON "encounter" USING btree ("org_id","worker_id");--> statement-breakpoint
CREATE INDEX "encounter_org_status_idx" ON "encounter" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "encounter_idempotency_uq" ON "encounter" USING btree ("org_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "export_org_idx" ON "export" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_org_user_uq" ON "membership" USING btree ("org_id","clerk_user_id");--> statement-breakpoint
CREATE INDEX "pass_user_idx" ON "pass" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_reference_uq" ON "payment" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "refined_version_no_uq" ON "refined_version" USING btree ("encounter_id","version_no");--> statement-breakpoint
CREATE UNIQUE INDEX "signoff_version_uq" ON "signoff" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "source_encounter_idx" ON "source" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "template_org_idx" ON "template" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_user_uq" ON "trial_claim" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trial_phone_uq" ON "trial_claim" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX "usage_org_created_idx" ON "usage_event" USING btree ("org_id","created_at");