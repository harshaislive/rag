"use server";

import { SQLAnalyzer } from '@/lib/sql-analysis';
import { findRelevantContent } from '@/lib/ai/embedding';

export interface AnalysisResult {
  type: 'rag' | 'sql' | 'hybrid';
  success: boolean;
  data?: any;
  sqlResults?: any[];
  ragResults?: any;
  explanation?: string;
  error?: string;
}

// Main function to intelligently analyze user questions
export async function analyzeQuery(
  query: string, 
  bucketId?: string
): Promise<AnalysisResult> {
  const analyzer = new SQLAnalyzer();
  
  try {
    // Determine analysis approach
    const analysisType = analyzer.detectAnalysisType(query);
    console.log(`Query analysis type: ${analysisType} for query: "${query}"`);

    switch (analysisType) {
      case 'sql':
        return await performSQLAnalysis(query, bucketId, analyzer);
      
      case 'hybrid':
        return await performHybridAnalysis(query, bucketId, analyzer);
      
      case 'rag':
      default:
        return await performRAGAnalysis(query, bucketId);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    return {
      type: 'rag',
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  } finally {
    await analyzer.cleanup();
  }
}

// Pure SQL analysis for data questions
async function performSQLAnalysis(
  query: string, 
  bucketId: string | undefined, 
  analyzer: SQLAnalyzer
): Promise<AnalysisResult> {
  if (!bucketId) {
    return {
      type: 'sql',
      success: false,
      error: 'Bucket ID required for SQL analysis'
    };
  }

  // Get CSV files from the bucket
  const csvFiles = await findCSVFilesInBucket(bucketId);
  if (csvFiles.length === 0) {
    // Fallback to RAG if no CSV files found
    return await performRAGAnalysis(query, bucketId);
  }

  const results: any[] = [];
  for (const fileName of csvFiles.slice(0, 2)) { // Analyze up to 2 CSV files
    try {
      const sqlResult = await analyzer.executeCSVAnalysis(query, fileName, bucketId);
      if (sqlResult.success) {
        results.push({
          fileName,
          ...sqlResult
        });
      }
    } catch (error) {
      console.warn(`SQL analysis failed for ${fileName}:`, error);
    }
  }

  if (results.length === 0) {
    // Fallback to RAG if SQL analysis fails
    return await performRAGAnalysis(query, bucketId);
  }

  return {
    type: 'sql',
    success: true,
    sqlResults: results,
    explanation: generateSQLExplanation(results, query)
  };
}

// Hybrid analysis combining SQL and RAG
async function performHybridAnalysis(
  query: string, 
  bucketId: string | undefined, 
  analyzer: SQLAnalyzer
): Promise<AnalysisResult> {
  try {
    // Run both SQL and RAG analysis in parallel
    const [sqlResult, ragResult] = await Promise.allSettled([
      bucketId ? performSQLAnalysis(query, bucketId, analyzer) : Promise.resolve(null),
      performRAGAnalysis(query, bucketId)
    ]);

    const sqlData = sqlResult.status === 'fulfilled' ? sqlResult.value : null;
    const ragData = ragResult.status === 'fulfilled' ? ragResult.value : null;

    // Combine results
    return {
      type: 'hybrid',
      success: true,
      sqlResults: sqlData?.sqlResults,
      ragResults: ragData?.ragResults,
      explanation: combineAnalysisResults(sqlData, ragData, query)
    };
  } catch (error) {
    console.error('Hybrid analysis error:', error);
    return await performRAGAnalysis(query, bucketId);
  }
}

// Standard RAG analysis
async function performRAGAnalysis(
  query: string, 
  bucketId?: string
): Promise<AnalysisResult> {
  try {
    const ragResults = await findRelevantContent(query);
    return {
      type: 'rag',
      success: true,
      ragResults: ragResults,
      explanation: `Found ${ragResults?.length || 0} relevant documents`
    };
  } catch (error) {
    console.error('RAG analysis error:', error);
    return {
      type: 'rag',
      success: false,
      error: error instanceof Error ? error.message : 'RAG analysis failed'
    };
  }
}

// Helper function to find CSV files in a bucket
async function findCSVFilesInBucket(bucketId: string): Promise<string[]> {
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const postgres = (await import('postgres')).default;
  const { env } = await import('@/lib/env.mjs');
  const { resources } = await import('@/lib/db/schema/resources');
  const { eq, sql } = await import('drizzle-orm');

  const connection = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  try {
    const csvFiles = await db
      .select({ fileName: resources.fileName })
      .from(resources)
      .where(sql`${resources.bucketId} = ${bucketId} AND (${resources.fileType} = 'text/csv' OR ${resources.fileName} LIKE '%.csv')`)
      .groupBy(resources.fileName);

    await connection.end();
    return csvFiles.map(f => f.fileName);
  } catch (error) {
    await connection.end();
    console.error('Error finding CSV files:', error);
    return [];
  }
}

// Generate explanation for SQL results
function generateSQLExplanation(results: any[], query: string): string {
  if (results.length === 0) return 'No data analysis results found.';

  let explanation = `SQL Analysis Results for: "${query}"\n\n`;
  
  results.forEach((result, index) => {
    explanation += `File: ${result.fileName}\n`;
    if (result.analysis) {
      explanation += result.analysis + '\n';
    }
    if (result.data && result.data.length > 0) {
      explanation += `Found ${result.data.length} analysis results\n`;
    }
    explanation += '\n';
  });

  return explanation;
}

// Combine SQL and RAG results
function combineAnalysisResults(sqlData: any, ragData: any, query: string): string {
  let explanation = `Combined Analysis for: "${query}"\n\n`;
  
  if (sqlData && sqlData.success) {
    explanation += 'Quantitative Analysis (SQL):\n';
    explanation += sqlData.explanation || 'Data analysis completed';
    explanation += '\n\n';
  }
  
  if (ragData && ragData.success) {
    explanation += 'Contextual Information (RAG):\n';
    explanation += ragData.explanation || 'Semantic search completed';
    explanation += '\n';
  }

  return explanation;
}

// Function to be called by AI tools
export async function executeDataAnalysis(args: {
  query: string;
  bucketId?: string;
  analysisType?: 'auto' | 'sql' | 'rag';
}) {
  const { query, bucketId, analysisType = 'auto' } = args;
  
  if (analysisType === 'sql') {
    const analyzer = new SQLAnalyzer();
    try {
      if (!bucketId) throw new Error('Bucket ID required for SQL analysis');
      
      const csvFiles = await findCSVFilesInBucket(bucketId);
      if (csvFiles.length === 0) throw new Error('No CSV files found in bucket');
      
      return await analyzer.executeCSVAnalysis(query, csvFiles[0], bucketId);
    } finally {
      await analyzer.cleanup();
    }
  } else if (analysisType === 'rag') {
    return await performRAGAnalysis(query, bucketId);
  } else {
    // Auto-detect best approach
    return await analyzeQuery(query, bucketId);
  }
}