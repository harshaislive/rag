import { env } from "@/lib/env.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import "dotenv/config";

const fixEmbeddingSmall = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Fixing embedding for text-embedding-3-small (1536 dimensions)...");

  try {
    // Drop the existing embedding column and recreate with 1536 dimensions
    await db.execute(sql`
      ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "embedding"
    `);

    await db.execute(sql`
      ALTER TABLE "embeddings" ADD COLUMN "embedding" vector(1536) NOT NULL
    `);

    // Drop and recreate the HNSW index (works with 1536 dimensions)
    await db.execute(sql`
      DROP INDEX IF EXISTS "embeddingIndex"
    `);

    await db.execute(sql`
      CREATE INDEX "embeddingIndex" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops)
    `);

    console.log("✅ Embedding dimensions fixed for text-embedding-3-small (1536)");
  } catch (error) {
    console.error("❌ Failed to fix embedding dimensions:", error);
  }

  await connection.end();
  process.exit(0);
};

fixEmbeddingSmall().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});