import { env } from "@/lib/env.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";

const fixEmbeddingDimensions = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Fixing embedding dimensions...");

  try {
    // Drop the existing embedding column and recreate with correct dimensions
    await db.execute(sql`
      ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "embedding"
    `);

    await db.execute(sql`
      ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(3072)
    `);

    // Drop and recreate the index with correct dimensions using IVF (supports more dimensions)
    await db.execute(sql`
      DROP INDEX IF EXISTS "embeddingIndex"
    `);

    await db.execute(sql`
      CREATE INDEX "embeddingIndex" ON "embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)
    `);

    console.log("✅ Embedding dimensions fixed successfully");
  } catch (error) {
    console.error("❌ Failed to fix embedding dimensions:", error);
  }

  await connection.end();
  process.exit(0);
};

fixEmbeddingDimensions().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});