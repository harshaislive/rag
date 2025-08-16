CREATE TABLE "buckets" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#344736',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"resource_id" varchar(191),
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "bucket_id" varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "file_name" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "file_type" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "file_size" integer;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "chunk_index" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "total_chunks" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_bucket_id_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."buckets"("id") ON DELETE cascade ON UPDATE no action;