import { env } from "@/lib/env.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { embeddings } from "@/lib/db/schema/embeddings";
import { sql } from "drizzle-orm";
import "dotenv/config";

const testEmbeddings = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("🧠 Testing embeddings...");

  try {
    // Simple count and content check
    const embeddingCount = await db.select({ count: sql<number>`count(*)` }).from(embeddings);
    console.log(`Total embeddings: ${embeddingCount[0]?.count || 0}`);

    // Get first few embeddings with content
    const sampleEmbeddings = await db.select({
      id: embeddings.id,
      content: embeddings.content,
    }).from(embeddings).limit(3);

    console.log("\nSample embeddings:");
    sampleEmbeddings.forEach((emb, i) => {
      console.log(`${i + 1}. ID: ${emb.id}`);
      console.log(`   Content: ${emb.content.substring(0, 200)}...`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Error testing embeddings:", error);
  }

  await connection.end();
  process.exit(0);
};

testEmbeddings().catch((err) => {
  console.error("❌ Script failed");
  console.error(err);
  process.exit(1);
});