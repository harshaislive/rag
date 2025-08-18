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
  const { messages, toolChoice = 'auto' } = await req.json();
  
  const result = streamText({
    model: azure(env.AZURE_OPENAI_DEPLOYMENT),
    messages,
    maxSteps: 2,
    toolChoice,
    system: `You are a helpful assistant with access to a knowledge base.

TOOL CHOICE MODE: ${toolChoice.toUpperCase()}

${toolChoice === 'required' ? `
**REQUIRED MODE** - Always search knowledge base first, then provide helpful answers:
1. Use getInformation tool to search for relevant context
2. After getting search results, ALWAYS provide a complete answer based on the findings
3. If no relevant information is found, still provide a helpful response
4. Don't get stuck searching - one tool call per response, then answer

IMPORTANT: After using tools, you must provide a conversational response to the user.

` : `
**AUTO MODE** - Use tools intelligently when needed:
1. **For simple greetings and casual questions**: Respond directly without tools
2. **For document search and content questions**: Use getInformation tool  
3. **For saving new information**: Use addResource tool

EXAMPLES:
- "Hello" → Direct response
- "How are you?" → Direct response  
- "What's in my documents?" → getInformation tool
- "Tell me about uploaded files" → getInformation tool

`}Be helpful and conversational while following the tool usage mode.`,
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
          description: 'Content added from chat conversation',
          uploadedBy: 'Chat Assistant',
          brand: 'Beforest',
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
