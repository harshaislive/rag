// Handle pdf-parse import for build compatibility
let pdfParse: any;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('pdf-parse not available during build');
  pdfParse = null;
}
import mammoth from 'mammoth';

export async function extractTextFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Extract text from PDF
      if (!pdfParse) {
        throw new Error('PDF parsing not available - pdf-parse not loaded');
      }
      const data = await pdfParse(buffer);
      return data.text;
    } 
    
    else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      // Extract text from DOCX
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    
    else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      // For older DOC files, mammoth might work but with limitations
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    
    else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      // Extract text from plain text files
      return new TextDecoder('utf-8').decode(buffer);
    }
    
    else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error('Text extraction failed:', error);
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // If we're not at the end, try to break at a sentence or word boundary
    if (end < text.length) {
      const sentenceBreak = text.lastIndexOf('.', end);
      const paragraphBreak = text.lastIndexOf('\n', end);
      const wordBreak = text.lastIndexOf(' ', end);
      
      // Choose the best break point
      if (sentenceBreak > start + maxChunkSize * 0.5) {
        end = sentenceBreak + 1;
      } else if (paragraphBreak > start + maxChunkSize * 0.3) {
        end = paragraphBreak;
      } else if (wordBreak > start + maxChunkSize * 0.3) {
        end = wordBreak;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + maxChunkSize - overlap, end);
  }

  return chunks.filter(chunk => chunk.length > 0);
}