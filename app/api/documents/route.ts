import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { resources } from '@/lib/db/schema/resources';
import { sql, eq, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const bucketId = url.searchParams.get('bucketId');

    if (!bucketId) {
      return Response.json({ error: 'bucketId parameter is required' }, { status: 400 });
    }

    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    // Get unique documents (group by fileName since we chunk documents)
    const documents = await db
      .select({
        fileName: resources.fileName,
        fileType: resources.fileType,
        fileSize: resources.fileSize,
        uploadDate: sql<string>`${resources.createdAt}::date`.as('uploadDate'),
        totalChunks: sql<number>`max(${resources.totalChunks})`.as('totalChunks'),
        bucketId: resources.bucketId
      })
      .from(resources)
      .where(eq(resources.bucketId, bucketId))
      .groupBy(resources.fileName, resources.fileType, resources.fileSize, resources.bucketId, sql`${resources.createdAt}::date`)
      .orderBy(desc(sql`max(${resources.createdAt})`));

    await connection.end();

    // Transform to match frontend interface
    const transformedDocs = documents.map((doc, index) => ({
      id: `${doc.bucketId}-${doc.fileName}-${index}`,
      bucketId: doc.bucketId,
      name: doc.fileName,
      fileType: doc.fileType?.toUpperCase() || 'UNKNOWN',
      fileSize: doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
      uploadDate: doc.uploadDate,
      status: 'completed' as const,
      chunks: doc.totalChunks
    }));

    return Response.json({ documents: transformedDocs });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return Response.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}