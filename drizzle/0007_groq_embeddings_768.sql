-- Switch embedding column from OpenAI 1536-dim to Groq nomic-embed-text-v1.5 768-dim.
-- All existing embeddings were NULL (key was always a placeholder), so no data loss.
DROP INDEX IF EXISTS "email_meta_embedding_hnsw_idx";--> statement-breakpoint
ALTER TABLE "email_meta" ALTER COLUMN "embedding" TYPE vector(768);--> statement-breakpoint
CREATE INDEX "email_meta_embedding_hnsw_idx" ON "email_meta" USING hnsw ("embedding" vector_cosine_ops);
