-- Additive Floor Ops + kitchen timing (Atithie standout layer)

CREATE TYPE "public"."table_status" AS ENUM('FREE', 'OCCUPIED', 'TURNING');
CREATE TYPE "public"."seating_source" AS ENUM('AI', 'HOST');

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "party_size" smallint DEFAULT 2 NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "status_changed_at" timestamptz DEFAULT now() NOT NULL;

UPDATE "orders" SET "status_changed_at" = "created_at" WHERE "status_changed_at" IS NULL;

CREATE TABLE IF NOT EXISTS "order_status_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL,
  "from_status" "public"."order_status",
  "to_status" "public"."order_status" NOT NULL,
  "changed_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "order_status_events_order_id_idx" ON "order_status_events" USING btree ("order_id");

CREATE TABLE IF NOT EXISTS "dining_tables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "label" text NOT NULL,
  "capacity" smallint NOT NULL,
  "status" "public"."table_status" DEFAULT 'FREE' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dining_tables_label_unique" ON "dining_tables" USING btree ("label");

CREATE TABLE IF NOT EXISTS "seating_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "table_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "party_size" smallint NOT NULL,
  "source" "public"."seating_source" NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "cleared_at" timestamptz
);

DO $$ BEGIN
  ALTER TABLE "seating_assignments" ADD CONSTRAINT "seating_assignments_table_id_dining_tables_id_fk"
    FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "seating_assignments" ADD CONSTRAINT "seating_assignments_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "seating_assignments_table_id_idx" ON "seating_assignments" USING btree ("table_id");
CREATE INDEX IF NOT EXISTS "seating_assignments_order_id_idx" ON "seating_assignments" USING btree ("order_id");

-- One active seating per order / per table
CREATE UNIQUE INDEX IF NOT EXISTS "seating_assignments_active_order_unique"
  ON "seating_assignments" ("order_id") WHERE "cleared_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "seating_assignments_active_table_unique"
  ON "seating_assignments" ("table_id") WHERE "cleared_at" IS NULL;
