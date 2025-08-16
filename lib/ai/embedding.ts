import { embed, embedMany } from "ai";
import { createAzure } from "@ai-sdk/azure";
import { cosineDistance, desc, gt, sql } from "drizzle-orm";
import { embeddings } from "../db/schema/embeddings";
import { resources } from "../db/schema/resources";
import { db } from "../db";
import { env } from "../env.mjs";

const azure = createAzure({
  resourceName: 'openaiharsha',
  apiKey: env.AZURE_EMBEDDING_API_KEY,
});

const embeddingModel = azure.embedding(env.AZURE_EMBEDDING_DEPLOYMENT);

const generateChunks = (input: string): string[] => {
  return input
    .trim()
    .split(".")
    .filter((i) => i !== "");
};

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  try {
    console.log('Generating embedding for value:', value.substring(0, 100) + '...');
    const input = value.replaceAll("\n", " ");
    const { embedding } = await embed({
      model: embeddingModel,
      value: input,
    });
    console.log('Embedding generated successfully, length:', embedding.length);
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

export const findRelevantContent = async (userQuery: string) => {
  try {
    console.log('Finding relevant content for query:', userQuery);
    const userQueryEmbedded = await generateEmbedding(userQuery);
    console.log('Generated embedding successfully');
    
    const similarity = sql<number>`1 - (${cosineDistance(embeddings.embedding, userQueryEmbedded)})`;
    const similarGuides = await db
      .select({ 
        name: embeddings.content,
        similarity,
        fileName: resources.fileName,
        fileType: resources.fileType,
        chunkIndex: resources.chunkIndex,
        totalChunks: resources.totalChunks
      })
      .from(embeddings)
      .leftJoin(resources, sql`${embeddings.resourceId} = ${resources.id}`)
      .where(gt(similarity, 0.1))
      .orderBy((t) => desc(t.similarity))
      .limit(4);
    
    console.log('Found similar guides:', similarGuides.length);
    return similarGuides;
  } catch (error) {
    console.error('Error in findRelevantContent:', error);
    return []; // Return empty array if there's an error
  }
};
