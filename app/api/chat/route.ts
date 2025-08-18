import { createResource } from "@/lib/actions/resources";
import { findRelevantContent } from "@/lib/ai/embedding";
import { executeDataAnalysis } from "@/lib/actions/sql-analysis";
import { createAzure } from "@ai-sdk/azure";
import { generateObject, streamText, tool } from "ai";
import { z } from "zod";
import { env } from "@/lib/env.mjs";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const azure = createAzure({
  resourceName: 'harsh-mdpv63be-eastus2',
  apiKey: env.AZURE_OPENAI_KEY,
});

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = streamText({
    model: azure(env.AZURE_OPENAI_DEPLOYMENT),
    messages,
    maxSteps: 5,
    system: `You are a helpful assistant with access to a knowledge base and advanced data analysis capabilities.

TOOL USAGE GUIDELINES:
1. **For general questions and document search**: Use getInformation tool
2. **For data analysis questions** (duplicates, statistics, counts, patterns): Use analyzeData tool
3. **For specific duplicate detection**: Use findDuplicates tool  
4. **For statistical analysis**: Use getStatistics tool
5. **For new information**: Use addResource tool

DATA ANALYSIS CAPABILITIES:
- Detect duplicates in CSV data across all columns or specific fields
- Calculate statistics (count, sum, average, min/max) for numerical data
- Find top/bottom values, unique counts, and data distributions  
- Perform multi-query analysis for complex questions
- Intelligent routing between SQL analysis and document search

EXAMPLES:
- "Find duplicates in my data" → Use findDuplicates or analyzeData
- "How many unique customers?" → Use analyzeData or getStatistics
- "What's the average sales by region?" → Use getStatistics
- "Tell me about this document" → Use getInformation

Always explain your analysis approach and provide clear, actionable insights.`,
    tools: {
      addResource: tool({
        description: `Add a resource to your knowledge base when the user provides new information`,
        parameters: z.object({
          content: z.string().describe("The content or resource to add to the knowledge base"),
        }),
        execute: async ({ content }) => await createResource({ 
          content,
          bucketId: 'default-bucket',
          fileName: `chat-${Date.now()}.txt`,
          fileType: 'txt',
          fileSize: Buffer.byteLength(content, 'utf8'),
          chunkIndex: 0,
          totalChunks: 1
        }),
      }),
      getInformation: tool({
        description: `Search your knowledge base to find relevant information for answering questions`,
        parameters: z.object({
          question: z.string().describe("The users question"),
          similarQuestions: z.array(z.string()).describe("Keywords and similar questions to search"),
        }),
        execute: async ({ similarQuestions }) => {
          const results = await Promise.all(
            similarQuestions.map(async (question) => await findRelevantContent(question))
          );
          const uniqueResults = Array.from(
            new Map(results.flat().map((item) => [item?.name, item])).values()
          );
          return uniqueResults;
        },
      }),
      analyzeData: tool({
        description: `Analyze CSV data with intelligent SQL queries for quantitative questions like duplicates, statistics, counts, aggregations, and patterns. Use this for data analysis questions that require numerical calculations or structured analysis.`,
        parameters: z.object({
          query: z.string().describe("The data analysis question or request"),
          bucketId: z.string().optional().describe("Specific bucket ID to analyze (if known)"),
          analysisType: z.enum(['auto', 'sql', 'rag']).optional().describe("Type of analysis to perform - 'auto' for intelligent detection, 'sql' for data queries, 'rag' for document search"),
        }),
        execute: async ({ query, bucketId, analysisType = 'auto' }) => {
          const result = await executeDataAnalysis({ query, bucketId, analysisType });
          return result;
        },
      }),
      findDuplicates: tool({
        description: `Specifically find duplicate records in CSV data. Optimized for duplicate detection across all columns or specific fields.`,
        parameters: z.object({
          bucketId: z.string().optional().describe("Bucket ID containing the CSV data"),
          fileName: z.string().optional().describe("Specific CSV file name to analyze"),
        }),
        execute: async ({ bucketId, fileName }) => {
          const query = "Find all duplicate records in this data";
          const result = await executeDataAnalysis({ 
            query, 
            bucketId, 
            analysisType: 'sql' 
          });
          return result;
        },
      }),
      getStatistics: tool({
        description: `Get statistical analysis of CSV data including counts, averages, sums, min/max values, and distributions.`,
        parameters: z.object({
          query: z.string().describe("Statistical analysis request (e.g., 'average sales by region', 'count of unique customers')"),
          bucketId: z.string().optional().describe("Bucket ID containing the data"),
        }),
        execute: async ({ query, bucketId }) => {
          const result = await executeDataAnalysis({ 
            query, 
            bucketId, 
            analysisType: 'sql' 
          });
          return result;
        },
      }),
    },
  });

  return result.toDataStreamResponse();
}
