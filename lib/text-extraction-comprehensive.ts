import mammoth from 'mammoth';
import * as xlsx from 'xlsx';

// Import pdf2json with proper typing
const PDFParser = require('pdf2json');

interface ExtractionResult {
  text: string;
  metadata?: {
    pages?: number;
    author?: string;
    title?: string;
    sheets?: string[];
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
    throw new Error(`Failed to extract text from ${file.name}: ${error.message}`);
  }
}

// PDF Extraction using pdf2json
async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
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
        reject(new Error(`Error processing PDF data: ${error.message}`));
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

// CSV Extraction
function extractFromCSV(buffer: Buffer): ExtractionResult {
  const text = new TextDecoder('utf-8').decode(buffer);
  return {
    text,
    metadata: {}
  };
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

// Enhanced text chunking with smart boundaries
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