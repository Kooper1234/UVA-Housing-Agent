import { NextResponse } from "next/server";
import { Pool } from "pg";

import { createServiceRoleClient } from "@/lib/supabase";
import type { Citation } from "@/types/listings";

type HousingChunk = {
  id: string;
  topic: string | null;
  scope: string | null;
  source_url: string | null;
  content: string;
};

type RpcChunk = HousingChunk & {
  similarity?: number;
};

type ChatRequestBody = {
  message?: string;
  top_k?: number;
};

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const CHAT_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

let pool: Pool | null = null;

function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("Missing required environment variable: DATABASE_URL");
    }

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 5,
    });
  }

  return pool;
}

function getOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("Missing required environment variable: OPENROUTER_API_KEY");
  }

  return key;
}

async function getEmbedding(message: string): Promise<number[]> {
  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenRouterKey()}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: message,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Embedding request failed: ${details}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("No embedding returned by OpenRouter.");
  }

  return embedding;
}

async function searchChunksWithRpc(embedding: number[], topK: number) {
  const supabase = createServiceRoleClient();

  const attempts = [
    {
      fn: "match_housing_chunks",
      args: { query_embedding: embedding, match_count: topK },
    },
    {
      fn: "match_housing_chunks",
      args: { embedding, top_k: topK },
    },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase.rpc(attempt.fn, attempt.args);
    if (!error && Array.isArray(data)) {
      return data as RpcChunk[];
    }
  }

  return null;
}

async function searchChunksWithRawSql(
  embedding: number[],
  topK: number,
): Promise<HousingChunk[]> {
  const vectorLiteral = `[${embedding.join(",")}]`;
  const db = getDatabasePool();

  const result = await db.query<HousingChunk>(
    `
      SELECT id, topic, scope, source_url, content
      FROM housing_chunks
      ORDER BY embedding <-> $1::vector
      LIMIT $2
    `,
    [vectorLiteral, topK],
  );

  return result.rows;
}

async function searchRelevantChunks(
  embedding: number[],
  topK: number,
): Promise<HousingChunk[]> {
  const rpcRows = await searchChunksWithRpc(embedding, topK);
  if (rpcRows && rpcRows.length > 0) {
    return rpcRows.map((row) => ({
      id: row.id,
      topic: row.topic,
      scope: row.scope,
      source_url: row.source_url,
      content: row.content,
    }));
  }

  return searchChunksWithRawSql(embedding, topK);
}

function buildContext(chunks: HousingChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const topicLabel = chunk.topic ? `Topic: ${chunk.topic}` : "Topic: Unknown";
      const sourceLabel = chunk.source_url
        ? `Source: ${chunk.source_url}`
        : "Source: Not provided";

      return `[${index + 1}] ${topicLabel}\n${sourceLabel}\n${chunk.content}`;
    })
    .join("\n\n");
}

function buildCitations(chunks: HousingChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    id: chunk.id,
    topic: chunk.topic,
    scope: chunk.scope,
    source_url: chunk.source_url,
  }));
}

async function generateAnswer(question: string, context: string): Promise<string> {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenRouterKey()}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a UVA student housing assistant. Answer using the provided housing context when possible. Be concise, practical, and call out uncertainty when context is limited.",
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion:\n${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Chat request failed: ${details}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("No answer returned by OpenRouter chat model.");
  }

  return answer;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();
    const topK = Math.min(Math.max(Math.floor(body.top_k ?? 5), 1), 12);

    if (!message) {
      return NextResponse.json(
        { error: "`message` is required." },
        { status: 400 },
      );
    }

    const queryEmbedding = await getEmbedding(message);
    const chunks = await searchRelevantChunks(queryEmbedding, topK);

    if (!chunks.length) {
      return NextResponse.json({
        answer:
          "I couldn't find relevant housing context in the database yet. Try asking about pricing, neighborhoods, lease terms, or transportation around UVA.",
        citations: [],
      });
    }

    const context = buildContext(chunks);
    const answer = await generateAnswer(message, context);

    return NextResponse.json({
      answer,
      citations: buildCitations(chunks),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error during chat.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
