import { db } from '@/lib/db';
import { resources } from '@/lib/db/schema/resources';
import { eq } from 'drizzle-orm';

interface SQLQueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  query?: string;
  analysis?: string;
}

interface CSVMetadata {
  headers: string[];
  rows: number;
  columns: number;
  fileName: string;
  bucketId: string;
}

export class SQLAnalyzer {
  // Use shared database connection like RAG system
  constructor() {
    // No need for separate connection - use shared db
  }

  async cleanup() {
    // No cleanup needed - shared connection is managed globally
  }

  // Detect if a question requires SQL analysis vs semantic search
  detectAnalysisType(question: string): 'sql' | 'rag' | 'hybrid' {
    const sqlKeywords = [
      'duplicate', 'duplicates', 'count', 'sum', 'average', 'avg', 'max', 'min',
      'group by', 'aggregate', 'total', 'how many', 'statistics', 'stats',
      'unique', 'distinct', 'sort', 'order', 'ranking', 'top', 'bottom',
      'filter', 'where', 'greater than', 'less than', 'between',
      'percentage', 'ratio', 'compare', 'comparison', 'trend', 'pattern'
    ];

    const questionLower = question.toLowerCase();
    const sqlScore = sqlKeywords.reduce((score, keyword) => {
      return questionLower.includes(keyword) ? score + 1 : score;
    }, 0);

    if (sqlScore >= 2) return 'sql';
    if (sqlScore === 1) return 'hybrid';
    return 'rag';
  }

  // Get CSV metadata from resources table
  async getCSVMetadata(fileName: string, bucketId: string): Promise<CSVMetadata | null> {
    try {
      const resourceData = await db
        .select()
        .from(resources)
        .where(eq(resources.fileName, fileName))
        .limit(1);

      if (resourceData.length === 0) return null;

      const content = resourceData[0].content;
      
      // Extract headers from the content (assuming it contains CSV data)
      const lines = content.split('\n').filter((line: string) => line.trim());
      if (lines.length === 0) return null;

      // Parse headers from first line that looks like CSV headers
      let headers: string[] = [];
      for (const line of lines) {
        if (line.includes('Headers:')) {
          const headerMatch = line.match(/Headers:\s*(.+)/);
          if (headerMatch) {
            headers = headerMatch[1].split(',').map((h: string) => h.trim());
            break;
          }
        }
        // Fallback: if first line looks like CSV headers
        if (line.includes(',') && !line.includes(':') && headers.length === 0) {
          headers = this.parseCSVRow(line);
          break;
        }
      }

      // Extract row count
      let rowCount = 0;
      for (const line of lines) {
        const rowMatch = line.match(/(\d+)\s+rows/);
        if (rowMatch) {
          rowCount = parseInt(rowMatch[1]);
          break;
        }
      }

      return {
        headers: headers,
        rows: rowCount,
        columns: headers.length,
        fileName,
        bucketId
      };
    } catch (error) {
      console.error('Error getting CSV metadata:', error);
      return null;
    }
  }

  // Parse CSV row (handles quoted values)
  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  // Generate SQL queries for common analysis patterns
  generateSQLQueries(question: string, metadata: CSVMetadata): string[] {
    const { headers, fileName } = metadata;
    const tableName = this.sanitizeTableName(fileName);
    const questionLower = question.toLowerCase();

    const queries: string[] = [];

    // Duplicate detection
    if (questionLower.includes('duplicate') || questionLower.includes('duplicates')) {
      // Find duplicates across all columns
      queries.push(
        `SELECT *, COUNT(*) as duplicate_count FROM ${tableName} GROUP BY ${headers.map(h => `"${h}"`).join(', ')} HAVING COUNT(*) > 1`
      );

      // Find duplicates for specific columns (common patterns)
      const likelyIdColumns = headers.filter(h => 
        h.toLowerCase().includes('id') || 
        h.toLowerCase().includes('email') || 
        h.toLowerCase().includes('name')
      );

      likelyIdColumns.forEach(column => {
        queries.push(
          `SELECT "${column}", COUNT(*) as count FROM ${tableName} GROUP BY "${column}" HAVING COUNT(*) > 1 ORDER BY count DESC`
        );
      });
    }

    // Count and aggregations
    if (questionLower.includes('count') || questionLower.includes('how many')) {
      queries.push(`SELECT COUNT(*) as total_rows FROM ${tableName}`);
      
      // Count unique values for categorical columns
      headers.forEach(header => {
        queries.push(
          `SELECT "${header}", COUNT(*) as count FROM ${tableName} GROUP BY "${header}" ORDER BY count DESC LIMIT 10`
        );
      });
    }

    // Statistical analysis
    if (questionLower.includes('average') || questionLower.includes('avg') || 
        questionLower.includes('sum') || questionLower.includes('max') || questionLower.includes('min')) {
      const numericColumns = this.detectNumericColumns(headers);
      
      numericColumns.forEach(column => {
        queries.push(
          `SELECT 
            COUNT("${column}") as count,
            AVG(CAST("${column}" AS DECIMAL)) as average,
            SUM(CAST("${column}" AS DECIMAL)) as sum,
            MIN(CAST("${column}" AS DECIMAL)) as minimum,
            MAX(CAST("${column}" AS DECIMAL)) as maximum
          FROM ${tableName} 
          WHERE "${column}" IS NOT NULL AND "${column}" != ''`
        );
      });
    }

    // Top/Bottom analysis
    if (questionLower.includes('top') || questionLower.includes('highest') || 
        questionLower.includes('bottom') || questionLower.includes('lowest')) {
      const numericColumns = this.detectNumericColumns(headers);
      
      numericColumns.forEach(column => {
        queries.push(`SELECT * FROM ${tableName} ORDER BY CAST("${column}" AS DECIMAL) DESC LIMIT 10`);
        queries.push(`SELECT * FROM ${tableName} ORDER BY CAST("${column}" AS DECIMAL) ASC LIMIT 10`);
      });
    }

    // Unique values analysis
    if (questionLower.includes('unique') || questionLower.includes('distinct')) {
      headers.forEach(header => {
        queries.push(`SELECT DISTINCT "${header}" FROM ${tableName} ORDER BY "${header}"`);
      });
    }

    return queries;
  }

  private sanitizeTableName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  }

  private detectNumericColumns(headers: string[]): string[] {
    // Heuristics to detect likely numeric columns
    const numericKeywords = [
      'price', 'cost', 'amount', 'total', 'sum', 'count', 'number', 'num',
      'age', 'year', 'score', 'rating', 'quantity', 'qty', 'weight', 'height',
      'salary', 'income', 'revenue', 'profit', 'sales', 'value', 'rate',
      'percentage', 'percent', 'ratio', 'index', 'level', 'grade'
    ];

    return headers.filter(header => {
      const headerLower = header.toLowerCase();
      return numericKeywords.some(keyword => headerLower.includes(keyword)) ||
             /\b(id|code)\b/.test(headerLower) ||
             /\d+/.test(header); // Contains numbers
    });
  }

  // Execute SQL analysis on CSV data stored in our resources
  async executeCSVAnalysis(question: string, fileName: string, bucketId: string): Promise<SQLQueryResult> {
    try {
      const metadata = await this.getCSVMetadata(fileName, bucketId);
      if (!metadata) {
        return {
          success: false,
          error: 'Could not find CSV metadata for analysis'
        };
      }

      // Get all CSV content chunks
      const resourceData = await db
        .select()
        .from(resources)
        .where(eq(resources.fileName, fileName));

      if (resourceData.length === 0) {
        return {
          success: false,
          error: 'No CSV data found'
        };
      }

      // Parse CSV data from all chunks
      const csvData = await this.parseCSVFromResources(resourceData);
      
      // Generate and execute queries
      const queries = this.generateSQLQueries(question, metadata);
      const results = [];

      for (const query of queries.slice(0, 3)) { // Limit to 3 queries for performance
        try {
          const result = await this.executeSQLOnData(query, csvData, metadata.headers);
          if (result.length > 0) {
            results.push({
              query,
              data: result,
              rowCount: result.length
            });
          }
        } catch (queryError) {
          console.warn('Query execution warning:', query, queryError);
        }
      }

      return {
        success: true,
        data: results,
        analysis: this.generateAnalysis(results, question)
      };

    } catch (error) {
      console.error('SQL analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown analysis error'
      };
    }
  }

  private async parseCSVFromResources(resourceData: any[]): Promise<any[]> {
    const allRows: any[] = [];
    
    for (const resource of resourceData) {
      const content = resource.content;
      const lines = content.split('\n').filter((line: string) => line.trim());
      
      // Find CSV data lines (skip metadata)
      let csvLines: string[] = [];
      let inCSVSection = false;
      
      for (const line of lines) {
        if (line.includes('Full CSV Content:') || line.includes('CSV Data:')) {
          inCSVSection = true;
          continue;
        }
        if (inCSVSection && line.includes('Structured JSON Format:')) {
          break;
        }
        if (inCSVSection && line.includes(',')) {
          csvLines.push(line);
        }
      }
      
      // Parse CSV lines
      if (csvLines.length > 0) {
        const headers = this.parseCSVRow(csvLines[0]);
        for (let i = 1; i < csvLines.length; i++) {
          const values = this.parseCSVRow(csvLines[i]);
          if (values.length === headers.length) {
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index];
            });
            allRows.push(row);
          }
        }
      }
    }
    
    return allRows;
  }

  private async executeSQLOnData(query: string, data: any[], headers: string[]): Promise<any[]> {
    // This is a simplified SQL executor for basic operations
    // In production, you'd want to use a more robust SQL engine like DuckDB or similar
    
    // For now, implement basic operations manually
    if (query.includes('COUNT(*)')) {
      return [{ total_rows: data.length }];
    }

    if (query.includes('GROUP BY') && query.includes('HAVING COUNT(*) > 1')) {
      // Duplicate detection
      const duplicates: any[] = [];
      const seen = new Map();
      
      data.forEach(row => {
        const key = headers.map(h => row[h]).join('|');
        if (seen.has(key)) {
          seen.set(key, seen.get(key) + 1);
        } else {
          seen.set(key, 1);
        }
      });

      seen.forEach((count, key) => {
        if (count > 1) {
          const values = key.split('|');
          const duplicate: any = { duplicate_count: count };
          headers.forEach((header, index) => {
            duplicate[header] = values[index];
          });
          duplicates.push(duplicate);
        }
      });

      return duplicates;
    }

    if (query.includes('GROUP BY') && !query.includes('HAVING')) {
      // Basic grouping
      const columnMatch = query.match(/GROUP BY "(.+?)"/);
      if (columnMatch) {
        const groupColumn = columnMatch[1];
        const groups = new Map();
        
        data.forEach(row => {
          const key = row[groupColumn];
          if (groups.has(key)) {
            groups.set(key, groups.get(key) + 1);
          } else {
            groups.set(key, 1);
          }
        });

        const result: any[] = [];
        groups.forEach((count, value) => {
          result.push({ [groupColumn]: value, count });
        });

        return result.sort((a, b) => b.count - a.count);
      }
    }

    // For complex queries, return a sample of the data
    return data.slice(0, 10);
  }

  private generateAnalysis(results: any[], question: string): string {
    if (results.length === 0) {
      return 'No significant patterns found in the data.';
    }

    let analysis = 'Analysis Results:\n\n';
    
    results.forEach((result, index) => {
      analysis += `Query ${index + 1}: ${result.query}\n`;
      analysis += `Found ${result.rowCount} results\n`;
      
      if (result.data.length > 0) {
        const sample = result.data[0];
        analysis += `Sample result: ${JSON.stringify(sample, null, 2)}\n`;
      }
      analysis += '\n';
    });

    return analysis;
  }
}