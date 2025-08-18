ALTER TABLE "resources" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "uploaded_by" varchar(255);--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "brand" varchar(50);