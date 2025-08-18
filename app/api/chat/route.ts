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
  
  // Modify the last user message if in required mode
  const modifiedMessages = toolChoice === 'required' && messages.length > 0 && messages[messages.length - 1].role === 'user' 
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
    toolChoice,
    system: `You are a helpful assistant with access to a knowledge base. Be helpful and conversational.`,
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
