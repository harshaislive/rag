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
      // First, get the resource to check if it exists and get fileName for deleting all chunks
      const resource = await db
        .select()
        .from(resources)
        .where(eq(resources.id, documentId))
        .limit(1);

      if (resource.length === 0) {
        await connection.end();
        return Response.json({ error: 'Document not found' }, { status: 404 });
      }

      const fileName = resource[0].fileName;
      const bucketId = resource[0].bucketId;

      // Get all resources (chunks) for this document
      const allDocumentResources = await db
        .select()
        .from(resources)
        .where(eq(resources.fileName, fileName));

      // Delete embeddings for all chunks of this document
      let totalDeletedEmbeddings = 0;
      for (const res of allDocumentResources) {
        const deletedEmbeddings = await db
          .delete(embeddings)
          .where(eq(embeddings.resourceId, res.id))
          .returning();
        totalDeletedEmbeddings += deletedEmbeddings.length;
      }

      console.log(`Deleted ${totalDeletedEmbeddings} embeddings for document ${fileName}`);

      // Delete all resources (chunks) for this document
      const deletedResources = await db
        .delete(resources)
        .where(eq(resources.fileName, fileName))
        .returning();

      await connection.end();

      if (deletedResources.length === 0) {
        return Response.json({ error: 'Failed to delete document' }, { status: 500 });
      }

      console.log(`Successfully deleted document: ${fileName} (${deletedResources.length} chunks)`);
      
      return Response.json({
        success: true,
        message: 'Document deleted successfully',
        fileName: fileName,
        deletedEmbeddings: totalDeletedEmbeddings,
        deletedChunks: deletedResources.length
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