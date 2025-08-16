import { env } from "@/lib/env.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";

const runBucketMigration = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Running bucket migration...");

  try {
    // Create buckets table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "buckets" (
        "id" varchar(191) PRIMARY KEY NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "color" varchar(7) DEFAULT '#344736',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    // Add columns to resources table if they don't exist
    await db.execute(sql`
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
      END $$
    `);

    // Create default bucket
    await db.execute(sql`
      INSERT INTO "buckets" ("id", "name", "description", "color") 
      VALUES ('default-bucket', 'Default Documents', 'Default bucket for existing documents', '#344736')
      ON CONFLICT ("id") DO NOTHING
    `);

    // Update existing resources to reference the default bucket
    await db.execute(sql`
      UPDATE "resources" SET "bucket_id" = 'default-bucket' WHERE "bucket_id" IS NULL
    `);

    console.log("✅ Bucket migration completed successfully");
  } catch (error) {
    console.error("❌ Bucket migration failed:", error);
  }

  await connection.end();
  process.exit(0);
};

runBucketMigration().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});