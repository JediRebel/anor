DO $$ BEGIN
  CREATE TYPE "course_access_type" AS ENUM ('free', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "courses" ADD COLUMN "access_type" "course_access_type" DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "price_cents" integer DEFAULT 0 NOT NULL;