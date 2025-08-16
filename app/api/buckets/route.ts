import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { buckets } from '@/lib/db/schema/buckets';
import { resources } from '@/lib/db/schema/resources';
import { sql, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    // Get all buckets with document counts
    const bucketsWithCounts = await db
      .select({
        id: buckets.id,
        name: buckets.name,
        description: buckets.description,
        color: buckets.color,
        createdAt: buckets.createdAt,
        documentCount: sql<number>`count(distinct ${resources.fileName})::int`.as('documentCount')
      })
      .from(buckets)
      .leftJoin(resources, eq(buckets.id, resources.bucketId))
      .groupBy(buckets.id, buckets.name, buckets.description, buckets.color, buckets.createdAt)
      .orderBy(buckets.createdAt);

    await connection.end();

    return Response.json({ buckets: bucketsWithCounts });
  } catch (error) {
    console.error('Error fetching buckets:', error);
    return Response.json({ error: 'Failed to fetch buckets' }, { status: 500 });
  }
}