import { NextRequest } from 'next/server';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env.mjs';
import { resources } from '@/lib/db/schema/resources';
import { embeddings } from '@/lib/db/schema/embeddings';
import { generateEmbedding } from '@/lib/ai/embedding';
import { nanoid } from '@/lib/utils';
import { extractTextFromFile, chunkText } from '@/lib/text-extraction-comprehensive';

// Allow longer processing time for large files
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    console.log('Upload working API called');
    
    // Check content length with more generous limits for CSV files
    const contentLength = req.headers.get('content-length');
    const maxSize = 50 * 1024 * 1024; // 50MB limit for large CSV files
    
    console.log(`Request content length: ${contentLength} bytes (${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) : 'unknown'} MB)`);
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      console.log(`File too large: ${contentLength} bytes > ${maxSize} bytes`);
      return Response.json({ 
        error: `File too large. Maximum file size is ${maxSize / (1024 * 1024)}MB. Your file is ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB.` 
      }, { status: 413 });
    }
    
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (error) {
      console.error('Error parsing form data:', error);
      return Response.json({ 
        error: 'Failed to parse upload data. File may be too large or corrupted.' 
      }, { status: 413 });
    }

    const file = formData.get('file') as File;
    const bucketId = formData.get('bucketId') as string;
    const description = formData.get('description') as string || '';
    const uploadedBy = formData.get('uploadedBy') as string || '';
    const brand = formData.get('brand') as string || 'Beforest';
    
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!bucketId) {
      return Response.json({ error: 'No bucket ID provided' }, { status: 400 });
    }

    console.log(`File received: ${file.name} (${file.type}, ${file.size} bytes) for bucket: ${bucketId}`);

    // Additional file size check after parsing
    if (file.size > maxSize) {
      console.log(`File too large after parsing: ${file.size} bytes > ${maxSize} bytes`);
      return Response.json({ 
        error: `File too large. Maximum file size is ${maxSize / (1024 * 1024)}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.` 
      }, { status: 413 });
    }

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
        error: 'Failed to extract text from file: ' + (extractionError instanceof Error ? extractionError.message : 'Unknown error')
      }, { status: 400 });
    }
    
    // Smart chunking using enhanced text chunking
    const chunks = chunkText(text, 1000, 100);
    console.log(`Created ${chunks.length} chunks`);
    
    // Warn if too many chunks (potential performance issue)
    if (chunks.length > 200) {
      console.warn(`Large number of chunks detected: ${chunks.length}. This may take longer to process.`);
    }
    
    // Dynamic chunk limit based on file characteristics
    const maxChunks = text.includes('Large CSV Dataset:') ? 300 : // Very large CSVs get lower limit
                      text.includes('CSV Data (') ? 600 :          // Regular large CSVs get higher limit
                      500;                                         // Default limit for other files
    
    if (chunks.length > maxChunks) {
      return Response.json({ 
        error: `File too complex. Generated ${chunks.length} chunks, but maximum allowed is ${maxChunks}. Please consider splitting the file or reducing content size.` 
      }, { status: 413 });
    }
    
    // Connect to database
    const connection = postgres(env.DATABASE_URL, { max: 1 });
    const db = drizzle(connection);

    try {
      const results = [];
      const batchSize = 5; // Process in smaller batches to avoid timeouts
      
      console.log(`Processing ${chunks.length} chunks in batches of ${batchSize}`);
      
      // Process chunks in batches to avoid memory/timeout issues
      for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, chunks.length);
        const batch = chunks.slice(batchStart, batchEnd);
        
        console.log(`Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (chunks ${batchStart + 1}-${batchEnd})`);
        
        // Prepare batch data
        const resourceBatch = [];
        const embeddingBatch = [];
        
        for (let i = 0; i < batch.length; i++) {
          const globalIndex = batchStart + i;
          const chunk = batch[i].trim();
          const resourceId = nanoid();
          
          // Prepare resource record
          resourceBatch.push({
            id: resourceId,
            bucketId,
            fileName: file.name,
            fileType: file.type || 'text/plain',
            fileSize: file.size,
            description,
            uploadedBy,
            brand,
            content: chunk,
            chunkIndex: globalIndex,
            totalChunks: chunks.length,
          });
          
          // Generate embedding
          console.log(`Generating embedding for chunk ${globalIndex + 1}/${chunks.length}`);
          const embedding = await generateEmbedding(chunk);
          
          embeddingBatch.push({
            resourceId,
            content: chunk,
            embedding,
          });
          
          results.push({
            resourceId,
            chunkIndex: globalIndex,
            contentLength: chunk.length
          });
        }
        
        // Bulk insert resources and embeddings
        console.log(`Bulk inserting batch of ${resourceBatch.length} records`);
        await db.insert(resources).values(resourceBatch);
        await db.insert(embeddings).values(embeddingBatch);
        
        console.log(`Completed batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
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
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload working API error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    return Response.json({ 
      error: 'Failed to process uploaded file',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}