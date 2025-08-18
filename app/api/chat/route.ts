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
  const { messages, toolMode = 'auto' } = await req.json();
  
  // Modify the last user message if in required mode
  const modifiedMessages = toolMode === 'required' && messages.length > 0 && messages[messages.length - 1].role === 'user' 
    ? [
        ...messages.slice(0, -1),
        {
          ...messages[messages.length - 1],
          content: `${messages[messages.length - 1].content}\n\nOnly check my database and don't use your personal knowledge.`
        }
      ]
    : messages;
  
  const result = streamText({
    model: azure(env.AZURE_OPENAI_DEPLOYMENT),
    messages: modifiedMessages,
    maxSteps: 5,
    toolChoice: toolMode === 'required' ? 'required' : 'auto',
    system: `You are a helpful assistant with access to a document knowledge base. 

When users ask questions about documents, uploaded files, or want to search their knowledge base, ALWAYS use the getInformation tool to search for relevant content before responding.

Examples of when to use getInformation tool:
- "What's in my documents?"
- "Search my files for..."
- "Tell me about my uploaded content"
- "Check my database for..."
- Any question about specific topics that might be in uploaded documents

Be helpful and conversational, but prioritize using the knowledge base when relevant.`,
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
        description: `Search the uploaded documents and knowledge base to find relevant information. Use this tool when users ask about their documents, want to search their files, or ask questions that might be answered by uploaded content.`,
        parameters: z.object({
          question: z.string().describe("The user's question or search query"),
          similarQuestions: z.array(z.string()).describe("Keywords, related terms, and similar questions to search for comprehensive results"),
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
