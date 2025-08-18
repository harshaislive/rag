import { NextRequest } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { buckets } from '@/lib/db/schema/buckets';
import { resources } from '@/lib/db/schema/resources';
import { embeddings } from '@/lib/db/schema/embeddings';
import { eq, sql } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bucketId } = await params;
    
    if (!bucketId) {
      return Response.json({ error: 'Bucket ID is required' }, { status: 400 });
    }

    console.log(`Deleting bucket: ${bucketId}`);

    // Connect to database
    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    try {
      // First, get the bucket to check if it exists
      const bucket = await db
        .select()
        .from(buckets)
        .where(eq(buckets.id, bucketId))
        .limit(1);

      if (bucket.length === 0) {
        await connection.end();
        return Response.json({ error: 'Bucket not found' }, { status: 404 });
      }

      console.log(`Starting optimized deletion for bucket: ${bucketId}`);

      // OPTIMIZED: Use subquery to delete all embeddings in one operation
      // This is much faster than the previous loop approach
      const deletedEmbeddings = await db
        .delete(embeddings)
        .where(sql`${embeddings.resourceId} IN (
          SELECT ${resources.id} 
          FROM ${resources} 
          WHERE ${resources.bucketId} = ${bucketId}
        )`)
        .returning();

      console.log(`Deleted ${deletedEmbeddings.length} embeddings for bucket ${bucketId}`);

      // Delete all resources in this bucket
      const deletedResources = await db
        .delete(resources)
        .where(eq(resources.bucketId, bucketId))
        .returning();

      console.log(`Deleted ${deletedResources.length} resources for bucket ${bucketId}`);

      // Finally, delete the bucket itself
      const deletedBuckets = await db
        .delete(buckets)
        .where(eq(buckets.id, bucketId))
        .returning();

      await connection.end();

      if (deletedBuckets.length === 0) {
        return Response.json({ error: 'Failed to delete bucket' }, { status: 500 });
      }

      console.log(`Successfully deleted bucket: ${bucket[0].name}`);
      
      return Response.json({
        success: true,
        message: 'Bucket deleted successfully',
        bucketName: bucket[0].name,
        deletedResources: deletedResources.length,
        deletedEmbeddings: deletedEmbeddings.length
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      return Response.json({ 
        error: 'Database error while deleting bucket',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Delete bucket error:', error);
    return Response.json({ 
      error: 'Failed to delete bucket',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}