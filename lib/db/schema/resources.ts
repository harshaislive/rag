import { sql } from "drizzle-orm";
import { text, varchar, timestamp, pgTable, integer } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@/lib/utils";
import { buckets } from "./buckets";

export const resources = pgTable("resources", {
  id: varchar("id", { length: 191 })
    .primaryKey()
    .$defaultFn(() => nanoid()),
  bucketId: varchar("bucket_id", { length: 191 })
    .references(() => buckets.id, { onDelete: "cascade" })
    .notNull(),
  
  // Document metadata
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 50 }).notNull(), // pdf, docx, txt
  fileSize: integer("file_size"), // in bytes
  
  // Extracted text content (no file storage)
  content: text("content").notNull(),
  
  // Chunking info
  chunkIndex: integer("chunk_index").default(0),
  totalChunks: integer("total_chunks").default(1),

  createdAt: timestamp("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at")
    .notNull()
    .default(sql`now()`),
});

// Schema for resources - used to validate API requests
export const insertResourceSchema = createSelectSchema(resources)
  .extend({})
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Type for resources - used to type API request params and within Components
export type NewResourceParams = z.infer<typeof insertResourceSchema>;
