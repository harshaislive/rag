import { NextRequest } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { resources } from '@/lib/db/schema/resources';
import { embeddings } from '@/lib/db/schema/embeddings';
import { eq } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    
    if (!documentId) {
      return Response.json({ error: 'Document ID is required' }, { status: 400 });
    }

    console.log(`Deleting document: ${documentId}`);

    // Connect to database
    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    try {
      // First, get the resource to check if it exists
      const resource = await db
        .select()
        .from(resources)
        .where(eq(resources.id, documentId))
        .limit(1);

      if (resource.length === 0) {
        await connection.end();
        return Response.json({ error: 'Document not found' }, { status: 404 });
      }

      // Delete associated embeddings first (foreign key constraint)
      const deletedEmbeddings = await db
        .delete(embeddings)
        .where(eq(embeddings.resourceId, documentId))
        .returning();

      console.log(`Deleted ${deletedEmbeddings.length} embeddings for document ${documentId}`);

      // Delete the resource
      const deletedResources = await db
        .delete(resources)
        .where(eq(resources.id, documentId))
        .returning();

      await connection.end();

      if (deletedResources.length === 0) {
        return Response.json({ error: 'Failed to delete document' }, { status: 500 });
      }

      console.log(`Successfully deleted document: ${resource[0].fileName}`);
      
      return Response.json({
        success: true,
        message: 'Document deleted successfully',
        fileName: resource[0].fileName,
        deletedEmbeddings: deletedEmbeddings.length
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      return Response.json({ 
        error: 'Database error while deleting document',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Delete document error:', error);
    return Response.json({ 
      error: 'Failed to delete document',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}