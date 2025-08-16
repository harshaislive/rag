-- Create buckets table
CREATE TABLE IF NOT EXISTS "buckets" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#344736',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add new columns to resources table (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'bucket_id') THEN
        ALTER TABLE "resources" ADD COLUMN "bucket_id" varchar(191);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_name') THEN
        ALTER TABLE "resources" ADD COLUMN "file_name" varchar(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_type') THEN
        ALTER TABLE "resources" ADD COLUMN "file_type" varchar(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'file_size') THEN
        ALTER TABLE "resources" ADD COLUMN "file_size" integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'chunk_index') THEN
        ALTER TABLE "resources" ADD COLUMN "chunk_index" integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'total_chunks') THEN
        ALTER TABLE "resources" ADD COLUMN "total_chunks" integer DEFAULT 1;
    END IF;
END $$;

-- Create a default bucket for existing data
INSERT INTO "buckets" ("id", "name", "description", "color") 
VALUES ('default-bucket', 'Default Documents', 'Default bucket for existing documents', '#344736')
ON CONFLICT DO NOTHING;

-- Update existing resources to reference the default bucket
UPDATE "resources" SET "bucket_id" = 'default-bucket' WHERE "bucket_id" IS NULL;

-- Add foreign key constraints
ALTER TABLE "resources" ADD CONSTRAINT "resources_bucket_id_buckets_id_fk" 
FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE cascade ON UPDATE no action;