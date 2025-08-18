import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Import pdf2json with proper typing - handle build-time issues
let PDFParser: any;
try {
  PDFParser = require('pdf2json');
} catch (error) {
  console.warn('pdf2json not available during build');
  PDFParser = null;
}

interface ExtractionResult {
  text: string;
  metadata?: {
    pages?: number;
    author?: string;
    title?: string;
    sheets?: string[];
    rows?: number;
    columns?: number;
    headers?: string[];
    isLargeFile?: boolean;
    isVeryLarge?: boolean;
    sampleSize?: number;
    processingType?: 'full' | 'sample' | 'minimal';
    extractionError?: string;
    extractionType?: 'fallback' | 'timeout' | 'success';
  };
}

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  
  try {
    // PDF Files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await extractFromPDF(buffer);
    }
    
    // Microsoft Word Documents
    else if (
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileName.endsWith('.docx')
    ) {
      return await extractFromDOCX(buffer);
    }
    
    // Legacy DOC files (limited support)
    else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      return await extractFromDOC(buffer);
    }
    
    // Excel Files
    else if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType === 'application/vnd.ms-excel' ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls')
    ) {
      return await extractFromExcel(buffer);
    }
    
    // CSV Files
    else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      return extractFromCSV(buffer);
    }
    
    // JSON Files
    else if (fileType === 'application/json' || fileName.endsWith('.json')) {
      return extractFromJSON(buffer);
    }
    
    // Plain Text Files
    else if (
      fileType === 'text/plain' || 
      fileName.endsWith('.txt') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.log')
    ) {
      return extractFromText(buffer);
    }
    
    // HTML Files
    else if (fileType === 'text/html' || fileName.endsWith('.html')) {
      return extractFromHTML(buffer);
    }
    
    // XML Files
    else if (fileType === 'application/xml' || fileType === 'text/xml' || fileName.endsWith('.xml')) {
      return extractFromXML(buffer);
    }
    
    else {
      throw new Error(`Unsupported file type: ${fileType || 'unknown'}`);
    }
  } catch (error) {
    console.error('Text extraction failed:', error);
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// PDF Extraction using pdf2json
async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
  if (!PDFParser) {
    throw new Error('PDF parsing not available - pdf2json not loaded');
  }
  
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      resolve({
        text: `[PDF Document: Extraction timeout - This PDF took too long to process. Please try a simpler PDF file.]`,
        metadata: {
          pages: 0,
          extractionError: 'Timeout after 30 seconds',
          extractionType: 'timeout'
        }
      });
    }, 30000); // 30 second timeout
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      const errorMessage = errData.parserError?.toString() || 'Unknown PDF error';
      console.warn('PDF parsing failed:', errorMessage);
      
      // For problematic PDFs, return a fallback response instead of rejecting
      if (errorMessage.includes('Invalid XRef') || 
          errorMessage.includes('corrupted') || 
          errorMessage.includes('Invalid PDF') ||
          errorMessage.includes('Error: Error:')) {
        
        resolve({
          text: `[PDF Document: Text extraction failed - This PDF may be image-based, password-protected, or corrupted. Please try converting to text format or use OCR software for better results.]`,
          metadata: {
            pages: 0,
            extractionError: errorMessage,
            extractionType: 'fallback'
          }
        });
      } else {
        reject(new Error(`PDF parsing error: ${errorMessage}`));
      }
      clearTimeout(timeout);
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      clearTimeout(timeout);
      try {
        let text = '';
        const pages = pdfData.Pages || [];
        
        pages.forEach((page: any) => {
          const pageTexts = page.Texts || [];
          pageTexts.forEach((textObj: any) => {
            if (textObj.R && textObj.R[0] && textObj.R[0].T) {
              text += decodeURIComponent(textObj.R[0].T) + ' ';
            }
          });
          text += '\n\n'; // Add page break
        });
        
        resolve({
          text: text.trim(),
          metadata: {
            pages: pages.length,
            title: pdfData.Meta?.Title || undefined,
            author: pdfData.Meta?.Author || undefined
          }
        });
      } catch (error) {
        reject(new Error(`Error processing PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
    
    pdfParser.parseBuffer(buffer);
  });
}

// DOCX Extraction using mammoth
async function extractFromDOCX(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    metadata: {}
  };
}

// DOC Extraction (limited support via mammoth)
async function extractFromDOC(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      metadata: {}
    };
  } catch (error) {
    throw new Error('DOC files have limited support. Please convert to DOCX for better results.');
  }
}

// Excel Extraction using xlsx
async function extractFromExcel(buffer: Buffer): Promise<ExtractionResult> {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheets = workbook.SheetNames;
  let text = '';
  
  sheets.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const sheetText = xlsx.utils.sheet_to_csv(worksheet);
    text += `=== Sheet: ${sheetName} ===\n${sheetText}\n\n`;
  });
  
  return {
    text: text.trim(),
    metadata: { sheets }
  };
}

// CSV Extraction with optimized processing for large files
function extractFromCSV(buffer: Buffer): ExtractionResult {
  const csvText = new TextDecoder('utf-8').decode(buffer);
  
  try {
    // Parse CSV to structured data
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) {
      return { text: csvText, metadata: {} };
    }
    
    // Get headers from first row
    const headers = parseCSVRow(lines[0]);
    const totalRows = lines.length - 1; // Exclude header
    
    // For large CSV files (>500 rows), optimize processing
    if (totalRows > 500) {
      console.log(`Large CSV detected: ${totalRows} rows. Using optimized processing.`);
      
      // For very large files (>2000 rows), use minimal processing
      if (totalRows > 2000) {
        console.log(`Very large CSV detected: ${totalRows} rows. Using minimal processing to reduce chunk count.`);
        
        // Create a compact representation with headers and row count info
        const searchableText = `Large CSV Dataset: ${totalRows} rows, ${headers.length} columns\n` +
          `Headers: ${headers.join(', ')}\n` +
          `File: ${lines[0]}\n` + // Header row
          `Sample rows:\n${lines.slice(1, 6).join('\n')}\n` + // First 5 data rows
          `...[${totalRows - 5} more rows]...\n` +
          `Last row: ${lines[lines.length - 1]}`;
        
        return {
          text: searchableText,
          metadata: {
            rows: totalRows,
            columns: headers.length,
            headers: headers,
            isLargeFile: true,
            isVeryLarge: true,
            processingType: 'minimal'
          }
        };
      } else {
        // For moderately large files (500-2000 rows), use sample approach
        const sampleSize = Math.min(20, totalRows);
        const sampleData: any[] = [];
        
        for (let i = 1; i <= sampleSize; i++) {
          const values = parseCSVRow(lines[i]);
          if (values.length === headers.length) {
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index];
            });
            sampleData.push(row);
          }
        }
        
        // Create optimized searchable text
        const sampleJsonString = JSON.stringify(sampleData, null, 2);
        const searchableText = `CSV Data (${totalRows} rows):\nHeaders: ${headers.join(', ')}\n\nSample Data (first ${sampleSize} rows):\n${sampleJsonString}\n\nFull CSV Content:\n${csvText}`;
        
        return {
          text: searchableText,
          metadata: {
            rows: totalRows,
            columns: headers.length,
            headers: headers,
            isLargeFile: true,
            sampleSize: sampleSize,
            processingType: 'sample'
          }
        };
      }
    } else {
      // For smaller files, use full JSON conversion
      const jsonData: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        if (values.length === headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          jsonData.push(row);
        }
      }
      
      // Create searchable text combining original CSV and JSON structure
      const jsonString = JSON.stringify(jsonData, null, 2);
      const searchableText = `CSV Data:\n${csvText}\n\nStructured JSON Format:\n${jsonString}`;
      
      return {
        text: searchableText,
        metadata: {
          rows: jsonData.length,
          columns: headers.length,
          headers: headers
        }
      };
    }
  } catch (error) {
    // If parsing fails, return original CSV text
    console.warn('CSV parsing failed, using raw text:', error);
    return {
      text: csvText,
      metadata: {}
    };
  }
}

// Helper function to parse CSV row (handles quoted values)
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current.trim());
  return result;
}

// JSON Extraction (convert to readable text)
function extractFromJSON(buffer: Buffer): ExtractionResult {
  const jsonText = new TextDecoder('utf-8').decode(buffer);
  try {
    const jsonData = JSON.parse(jsonText);
    
    // Convert JSON to searchable text
    const text = JSON.stringify(jsonData, null, 2)
      .replace(/[{}\[\]",]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      text: `JSON Content:\n${text}`,
      metadata: {}
    };
  } catch (error) {
    // If not valid JSON, return as text
    return {
      text: jsonText,
      metadata: {}
    };
  }
}

// Plain Text Extraction
function extractFromText(buffer: Buffer): ExtractionResult {
  const text = new TextDecoder('utf-8').decode(buffer);
  return {
    text,
    metadata: {}
  };
}

// HTML Extraction (strip tags, keep text)
function extractFromHTML(buffer: Buffer): ExtractionResult {
  const html = new TextDecoder('utf-8').decode(buffer);
  
  // Simple HTML tag removal (for basic extraction)
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    text,
    metadata: {}
  };
}

// XML Extraction (strip tags, keep text)
function extractFromXML(buffer: Buffer): ExtractionResult {
  const xml = new TextDecoder('utf-8').decode(buffer);
  
  // Simple XML tag removal
  const text = xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    text,
    metadata: {}
  };
}

// Enhanced text chunking with smart boundaries and structured data handling
export function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  // Detect if this is structured data (JSON, CSV, etc.)
  const isStructuredData = isStructuredContent(text);
  
  // Use larger chunks for very large structured data to reduce total chunk count
  if (isStructuredData) {
    // For very large CSV files, use much larger chunks
    if (text.includes('Large CSV Dataset:') || text.length > 100000) {
      console.log('Using large chunks for very large structured data');
      maxChunkSize = Math.max(maxChunkSize, 3000); // Use at least 3000 chars per chunk
      overlap = Math.min(overlap, 200); // Reduce overlap for efficiency
    }
    return chunkStructuredData(text, maxChunkSize, overlap);
  } else {
    return chunkUnstructuredText(text, maxChunkSize, overlap);
  }
}

// Detect if content is structured (JSON, CSV format, etc.)
function isStructuredContent(text: string): boolean {
  // Check for JSON structure
  if (text.trim().startsWith('{') || text.trim().startsWith('[') || text.includes('Structured JSON Format:')) {
    return true;
  }
  
  // Check for CSV structure
  if (text.includes('CSV Data:') || (text.includes(',') && text.split('\n').length > 2)) {
    const lines = text.split('\n');
    if (lines.length > 1) {
      const firstLine = lines[0];
      const secondLine = lines[1];
      const firstCommas = (firstLine.match(/,/g) || []).length;
      const secondCommas = (secondLine.match(/,/g) || []).length;
      // If first two lines have similar comma counts, likely CSV
      return Math.abs(firstCommas - secondCommas) <= 1 && firstCommas > 0;
    }
  }
  
  return false;
}

// Chunking for structured data (preserve record boundaries)
function chunkStructuredData(text: string, maxChunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  // Handle CSV format specifically
  if (text.includes('CSV Data:')) {
    return chunkCSVData(text, maxChunkSize, overlap);
  }
  
  // Handle JSON format
  if (text.includes('Structured JSON Format:') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    return chunkJSONData(text, maxChunkSize, overlap);
  }
  
  // Fallback to line-based chunking for other structured data
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    const testChunk = currentChunk + (currentChunk ? '\n' : '') + line;
    
    if (testChunk.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk = testChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return addOverlapToChunks(chunks, overlap);
}

// Specialized CSV chunking
function chunkCSVData(text: string, maxChunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sections = text.split('\n\nStructured JSON Format:\n');
  
  if (sections.length === 2) {
    const [csvSection, jsonSection] = sections;
    
    // Chunk CSV section (preserve header + rows)
    const csvChunks = chunkCSVSection(csvSection, maxChunkSize);
    
    // Chunk JSON section (preserve complete records)
    const jsonChunks = chunkJSONSection(jsonSection, maxChunkSize);
    
    // Combine and interleave for better searchability
    chunks.push(...csvChunks);
    chunks.push(...jsonChunks);
  } else {
    // Fallback if format is different
    return chunkUnstructuredText(text, maxChunkSize, overlap);
  }
  
  return addOverlapToChunks(chunks, overlap);
}

// CSV section chunking (preserve complete rows)
function chunkCSVSection(csvSection: string, maxChunkSize: number): string[] {
  const lines = csvSection.split('\n');
  const chunks: string[] = [];
  
  if (lines.length === 0) return [];
  
  // Always include header
  const header = lines[0];
  let currentChunk = header;
  
  for (let i = 1; i < lines.length; i++) {
    const testChunk = currentChunk + '\n' + lines[i];
    
    if (testChunk.length > maxChunkSize && currentChunk !== header) {
      chunks.push(currentChunk);
      currentChunk = header + '\n' + lines[i]; // Start new chunk with header
    } else {
      currentChunk = testChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// JSON section chunking (preserve complete objects)
function chunkJSONSection(jsonSection: string, maxChunkSize: number): string[] {
  try {
    const jsonData = JSON.parse(jsonSection);
    
    if (Array.isArray(jsonData)) {
      const chunks: string[] = [];
      let currentBatch: any[] = [];
      
      for (const item of jsonData) {
        const testBatch = [...currentBatch, item];
        const testChunk = JSON.stringify(testBatch, null, 2);
        
        if (testChunk.length > maxChunkSize && currentBatch.length > 0) {
          chunks.push(JSON.stringify(currentBatch, null, 2));
          currentBatch = [item];
        } else {
          currentBatch = testBatch;
        }
      }
      
      if (currentBatch.length > 0) {
        chunks.push(JSON.stringify(currentBatch, null, 2));
      }
      
      return chunks;
    }
  } catch (error) {
    // If JSON parsing fails, treat as regular text
    return chunkUnstructuredText(jsonSection, maxChunkSize, 100);
  }
  
  return [jsonSection];
}

// JSON data chunking
function chunkJSONData(text: string, maxChunkSize: number, overlap: number): string[] {
  try {
    const jsonData = JSON.parse(text);
    
    if (Array.isArray(jsonData)) {
      return chunkJSONArray(jsonData, maxChunkSize);
    } else if (typeof jsonData === 'object') {
      return chunkJSONObject(jsonData, maxChunkSize);
    }
  } catch (error) {
    // If not valid JSON, treat as regular text
    return chunkUnstructuredText(text, maxChunkSize, overlap);
  }
  
  return [text];
}

// Chunk JSON array preserving complete objects
function chunkJSONArray(jsonArray: any[], maxChunkSize: number): string[] {
  const chunks: string[] = [];
  let currentBatch: any[] = [];
  
  for (const item of jsonArray) {
    const testBatch = [...currentBatch, item];
    const testChunk = JSON.stringify(testBatch, null, 2);
    
    if (testChunk.length > maxChunkSize && currentBatch.length > 0) {
      chunks.push(JSON.stringify(currentBatch, null, 2));
      currentBatch = [item];
    } else {
      currentBatch = testBatch;
    }
  }
  
  if (currentBatch.length > 0) {
    chunks.push(JSON.stringify(currentBatch, null, 2));
  }
  
  return chunks;
}

// Chunk JSON object by properties
function chunkJSONObject(jsonObject: any, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const keys = Object.keys(jsonObject);
  let currentObject: any = {};
  
  for (const key of keys) {
    const testObject = { ...currentObject, [key]: jsonObject[key] };
    const testChunk = JSON.stringify(testObject, null, 2);
    
    if (testChunk.length > maxChunkSize && Object.keys(currentObject).length > 0) {
      chunks.push(JSON.stringify(currentObject, null, 2));
      currentObject = { [key]: jsonObject[key] };
    } else {
      currentObject = testObject;
    }
  }
  
  if (Object.keys(currentObject).length > 0) {
    chunks.push(JSON.stringify(currentObject, null, 2));
  }
  
  return chunks;
}

// Regular text chunking with smart boundaries
function chunkUnstructuredText(text: string, maxChunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChunkSize;
    
    // If we're not at the end, try to break at a sentence or word boundary
    if (end < text.length) {
      const sentenceBreak = text.lastIndexOf('.', end);
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      const lineBreak = text.lastIndexOf('\n', end);
      const wordBreak = text.lastIndexOf(' ', end);
      
      // Choose the best break point (prioritize paragraph > sentence > line > word)
      if (paragraphBreak > start + maxChunkSize * 0.3) {
        end = paragraphBreak + 2; // Include the double newline
      } else if (sentenceBreak > start + maxChunkSize * 0.5) {
        end = sentenceBreak + 1; // Include the period
      } else if (lineBreak > start + maxChunkSize * 0.3) {
        end = lineBreak + 1; // Include the newline
      } else if (wordBreak > start + maxChunkSize * 0.3) {
        end = wordBreak;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    
    // Move start position with overlap
    start = Math.max(start + maxChunkSize - overlap, end - overlap);
  }

  return chunks.filter(chunk => chunk.length > 0);
}

// Add overlap between chunks for better context preservation
function addOverlapToChunks(chunks: string[], overlapSize: number): string[] {
  if (chunks.length <= 1 || overlapSize <= 0) {
    return chunks;
  }
  
  const overlappedChunks: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i];
    
    // Add overlap from previous chunk
    if (i > 0 && overlapSize > 0) {
      const prevChunk = chunks[i - 1];
      const overlap = prevChunk.slice(-Math.min(overlapSize, prevChunk.length));
      chunk = overlap + '\n...\n' + chunk;
    }
    
    overlappedChunks.push(chunk);
  }
  
  return overlappedChunks;
}