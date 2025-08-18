import { NextRequest } from 'next/server';
import { chunkText } from '@/lib/text-extraction-comprehensive';
import { generateEmbedding } from '@/lib/ai/embedding';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { buckets } from '@/lib/db/schema/buckets';
import { resources } from '@/lib/db/schema/resources';
import { embeddings } from '@/lib/db/schema/embeddings';
import { nanoid } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucketId = formData.get('bucketId') as string;
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!bucketId) {
      return Response.json({ error: 'No bucket ID provided' }, { status: 400 });
    }

    console.log(`Processing file: ${file.name} (${file.type}, ${file.size} bytes) for bucket: ${bucketId}`);

    // Extract text from file (simplified for text files)
    console.log('Extracting text from file...');
    let fullText = '';
    
    if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fullText = new TextDecoder('utf-8').decode(buffer);
    } else {
      return Response.json({ error: 'Only text files (.txt) are supported for now' }, { status: 400 });
    }
    
    if (!fullText.trim()) {
      return Response.json({ error: 'No text content found in file' }, { status: 400 });
    }

    // Chunk the text
    console.log('Chunking text...');
    const chunks = chunkText(fullText, 1000, 100);
    console.log(`Created ${chunks.length} chunks`);

    // Connect to database
    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    try {
      // Store each chunk as a separate resource with embeddings
      const results = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        
        // Create resource record
        const resourceId = nanoid();
        await db.insert(resources).values({
          id: resourceId,
          bucketId,
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          content: chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
        });

        // Generate and store embedding
        console.log(`Generating embedding for chunk ${i + 1}`);
        const embedding = await generateEmbedding(chunk);
        
        await db.insert(embeddings).values({
          resourceId,
          content: chunk,
          embedding,
        });

        results.push({
          resourceId,
          chunkIndex: i,
          contentLength: chunk.length
        });
      }

      await connection.end();

      console.log(`Successfully processed ${file.name} into ${chunks.length} chunks`);
      
      return Response.json({
        success: true,
        fileName: file.name,
        fileSize: file.size,
        chunksCreated: chunks.length,
        totalTextLength: fullText.length,
        results
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      return Response.json({ 
        error: 'Database error while storing document',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload processing error:', error);
    return Response.json({ 
      error: 'Failed to process uploaded file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}