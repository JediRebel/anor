-- apps/backend/drizzle/0006_cuddly_adam_warlock.sql

-- 删除了那 4 行 CREATE TYPE ...

CREATE TABLE "tool_records" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "tool_type" varchar(50) NOT NULL,
    "input_payload" jsonb NOT NULL,
    "result_payload" jsonb NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_records" ADD CONSTRAINT "tool_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;