import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import "dotenv/config";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().min(1),
    AZURE_OPENAI_API_VERSION: z.string().min(1),
    AZURE_OPENAI_DEPLOYMENT: z.string().min(1),
    AZURE_OPENAI_ENDPOINT: z.string().min(1),
    AZURE_OPENAI_KEY: z.string().min(1),
    AZURE_OPENAI_DEPLOYMENT_NAME: z.string().min(1),
    AZURE_OPENAI_MODEL_NAME: z.string().min(1),
    AZURE_EMBEDDING_ENDPOINT: z.string().min(1),
    AZURE_EMBEDDING_MODEL_NAME: z.string().min(1),
    AZURE_EMBEDDING_DEPLOYMENT: z.string().min(1),
    AZURE_EMBEDDING_API_VERSION: z.string().min(1),
    AZURE_EMBEDDING_API_KEY: z.string().min(1),
  },
  client: {
    // NEXT_PUBLIC_PUBLISHABLE_KEY: z.string().min(1),
  },
  // If you're using Next.js < 13.4.4, you'll need to specify the runtimeEnv manually
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    AZURE_OPENAI_MODEL_NAME: process.env.AZURE_OPENAI_MODEL_NAME,
    AZURE_EMBEDDING_ENDPOINT: process.env.AZURE_EMBEDDING_ENDPOINT,
    AZURE_EMBEDDING_MODEL_NAME: process.env.AZURE_EMBEDDING_MODEL_NAME,
    AZURE_EMBEDDING_DEPLOYMENT: process.env.AZURE_EMBEDDING_DEPLOYMENT,
    AZURE_EMBEDDING_API_VERSION: process.env.AZURE_EMBEDDING_API_VERSION,
    AZURE_EMBEDDING_API_KEY: process.env.AZURE_EMBEDDING_API_KEY,
    //   NEXT_PUBLIC_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PUBLISHABLE_KEY,
  },
  // For Next.js >= 13.4.4, you only need to destructure client variables:
  experimental__runtimeEnv: {
    // NEXT_PUBLIC_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_PUBLISHABLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY,
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    AZURE_OPENAI_MODEL_NAME: process.env.AZURE_OPENAI_MODEL_NAME,
    AZURE_EMBEDDING_ENDPOINT: process.env.AZURE_EMBEDDING_ENDPOINT,
    AZURE_EMBEDDING_MODEL_NAME: process.env.AZURE_EMBEDDING_MODEL_NAME,
    AZURE_EMBEDDING_DEPLOYMENT: process.env.AZURE_EMBEDDING_DEPLOYMENT,
    AZURE_EMBEDDING_API_VERSION: process.env.AZURE_EMBEDDING_API_VERSION,
    AZURE_EMBEDDING_API_KEY: process.env.AZURE_EMBEDDING_API_KEY,
  },
});
