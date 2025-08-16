import { env } from "@/lib/env.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { embeddings } from "@/lib/db/schema/embeddings";
import { resources } from "@/lib/db/schema/resources";
import { sql } from "drizzle-orm";
import "dotenv/config";

const testSearch = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("🔍 Testing database content...");

  try {
    // Check resources table
    console.log("\n📄 Resources in database:");
    const allResources = await db.select().from(resources);
    console.log(`Found ${allResources.length} resources:`);
    allResources.forEach((resource, i) => {
      console.log(`${i + 1}. ${resource.fileName} (bucket: ${resource.bucketId})`);
      console.log(`   Content preview: ${resource.content.substring(0, 100)}...`);
    });

    // Check embeddings table
    console.log("\n🧠 Embeddings in database:");
    const allEmbeddings = await db.select({
      id: embeddings.id,
      contentPreview: sql<string>`substr(${embeddings.content}, 1, 50)`.as('contentPreview'),
      embeddingLength: sql<number>`array_length(${embeddings.embedding}, 1)`.as('embeddingLength')
    }).from(embeddings);
    console.log(`Found ${allEmbeddings.length} embeddings:`);
    allEmbeddings.forEach((emb, i) => {
      console.log(`${i + 1}. Content: "${emb.contentPreview}..." (embedding dims: ${emb.embeddingLength})`);
    });

  } catch (error) {
    console.error("❌ Error testing search:", error);
  }

  await connection.end();
  process.exit(0);
};

testSearch().catch((err) => {
  console.error("❌ Script failed");
  console.error(err);
  process.exit(1);
});