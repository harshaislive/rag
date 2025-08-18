import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { buckets, insertBucketSchema } from '@/lib/db/schema/buckets';
import { resources } from '@/lib/db/schema/resources';
import { sql, eq } from 'drizzle-orm';
import { nanoid } from '@/lib/utils';

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate the input
    const validatedInput = insertBucketSchema.parse(body);
    
    console.log('Creating bucket:', validatedInput);

    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    // Create the bucket with generated ID
    const bucketId = nanoid();
    const [newBucket] = await db
      .insert(buckets)
      .values({
        id: bucketId,
        ...validatedInput,
      })
      .returning();

    await connection.end();

    console.log('Successfully created bucket:', newBucket);

    return Response.json({ 
      success: true, 
      bucket: {
        ...newBucket,
        documentCount: 0
      } 
    });

  } catch (error) {
    console.error('Error creating bucket:', error);
    return Response.json({ 
      error: 'Failed to create bucket',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}