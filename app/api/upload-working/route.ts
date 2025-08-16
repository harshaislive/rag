import { NextRequest } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { resources } from '@/lib/db/schema/resources';
import { embeddings } from '@/lib/db/schema/embeddings';
import { generateEmbedding } from '@/lib/ai/embedding';
import { nanoid } from '@/lib/utils';
import { extractTextFromFile, chunkText } from '@/lib/text-extraction-comprehensive';

export async function POST(req: NextRequest) {
  try {
    console.log('Upload working API called');
    
    // Check content length
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
      return Response.json({ 
        error: 'File too large. Maximum file size is 10MB.' 
      }, { status: 413 });
    }
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const bucketId = formData.get('bucketId') as string;
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!bucketId) {
      return Response.json({ error: 'No bucket ID provided' }, { status: 400 });
    }

    console.log(`File received: ${file.name} (${file.type}, ${file.size} bytes) for bucket: ${bucketId}`);

    // Extract text from file using comprehensive extraction utility
    let text = '';
    let metadata = {};
    try {
      const extractionResult = await extractTextFromFile(file);
      text = extractionResult.text;
      metadata = extractionResult.metadata || {};
      
      console.log(`Extracted ${text.length} characters from ${file.name}`);
      
      if (!text || text.trim().length === 0) {
        return Response.json({ 
          error: 'Could not extract text from file. The file might be empty, image-based, or corrupted.' 
        }, { status: 400 });
      }
    } catch (extractionError) {
      console.error('Text extraction error:', extractionError);
      return Response.json({ 
        error: 'Failed to extract text from file: ' + extractionError.message 
      }, { status: 400 });
    }
    
    // Smart chunking using enhanced text chunking
    const chunks = chunkText(text, 1000, 100);
    console.log(`Created ${chunks.length} chunks`);
    
    // Connect to database
    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    try {
      const results = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        
        // Create resource record
        const resourceId = nanoid();
        await db.insert(resources).values({
          id: resourceId,
          bucketId,
          fileName: file.name,
          fileType: file.type || 'text/plain',
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
        bucketId,
        chunksCreated: chunks.length,
        totalTextLength: text.length,
        results
      });

    } catch (dbError) {
      await connection.end();
      console.error('Database error:', dbError);
      return Response.json({ 
        error: 'Database error while storing document',
        details: dbError.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload working API error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: 'Failed to process uploaded file',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}