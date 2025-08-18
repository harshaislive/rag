import { createResource } from "@/lib/actions/resources";
import { findRelevantContent } from "@/lib/ai/embedding";
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
    system: `You are a helpful assistant with access to a knowledge base.

TOOL USAGE GUIDELINES:
1. **For simple greetings and casual questions**: Respond directly without tools
2. **For document search and content questions**: Use getInformation tool  
3. **For saving new information**: Use addResource tool

EXAMPLES:
- "Hello" → Direct response
- "How are you?" → Direct response  
- "What's in my documents?" → getInformation tool
- "Tell me about uploaded files" → getInformation tool

Be helpful and conversational while using tools only when needed.`,
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
    },
  });

  return result.toDataStreamResponse();
}
