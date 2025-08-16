import { env } from "@/lib/env.mjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { buckets } from "@/lib/db/schema/buckets";
import "dotenv/config";

const createDefaultBuckets = async () => {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Creating default buckets...");

  try {
    const defaultBuckets = [
      {
        id: 'hr-docs',
        name: 'HR Documents',
        description: 'Company policies, handbooks, and HR materials',
        color: '#344736', // Forest green
      },
      {
        id: 'reports',
        name: 'Reports & Analytics',
        description: 'Quarterly reports, business analytics, and performance data',
        color: '#86312b', // Rich red
      },
      {
        id: 'marketing',
        name: 'Marketing Materials',
        description: 'Brand guidelines, marketing campaigns, and promotional content',
        color: '#002140', // Deep blue
      }
    ];

    for (const bucket of defaultBuckets) {
      await db.insert(buckets).values(bucket).onConflictDoNothing();
      console.log(`✅ Created bucket: ${bucket.name}`);
    }

    console.log("✅ Default buckets created successfully");
  } catch (error) {
    console.error("❌ Failed to create default buckets:", error);
  }

  await connection.end();
  process.exit(0);
};

createDefaultBuckets().catch((err) => {
  console.error("❌ Script failed");
  console.error(err);
  process.exit(1);
});