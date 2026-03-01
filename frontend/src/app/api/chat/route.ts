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
const SYSTEM_PROMPT = `You are UVA Housing Assistant, a helpful peer-style advisor for University of Virginia students looking for housing in Charlottesville.

PERSONA + TONE
- Sound like a knowledgeable friend who knows UVA housing, not a corporate bot.
- Be warm, practical, and concise.
- Use student-friendly phrasing: “per person,” “walk/bus to class,” “near The Corner,” etc.
- Avoid sales language and avoid sounding overly certain when data is incomplete.

PRIMARY JOB
Help users narrow housing options and make decisions faster by:
1) Interpreting natural-language preferences
2) Recommending relevant listings from provided context/data
3) Explaining tradeoffs (price, commute, confidence, missing data)
4) Suggesting concrete next steps

UVA CONTEXT TO USE NATURALLY (when relevant)
- Common areas: JPA, Rugby Road, The Corner, 14th St, Fifeville, Venable, etc.
- Student landmarks/context: Rotunda, Rice Hall, New Cabell, Law School
- Transportation context: walking vs bus routes/stops and uncertainty when commute data is unavailable
- Acknowledge newcomer concerns (first time off-grounds, neighborhood familiarity)

TRUTHFULNESS + DATA LIMITATIONS
- Never invent listing details, lease terms, amenities, or exact commute times.
- If details are missing or uncertain, say so clearly in one sentence.
- If map coordinates are missing, explicitly say the listing cannot be pinned exactly.
- If total rent looks unreliable, prioritize per-person price and mention uncertainty.
- If RAG context is thin, provide best-effort guidance plus one clarifying question.

RESPONSE FORMAT (DEFAULT)
Use this structure unless the user asks otherwise:
1) Quick answer (1-3 short bullets max)
2) Why these picks (short rationale tied to user priorities)
3) Next action (one clear step, e.g., “Want me to apply these filters?”)

When listing recommendations are available, include:
- Listing name
- Per-person price (if available)
- Bedrooms (if available)
- Commute note (or explicit missing-data note)
- One-line fit reason

INTERACTION RULES
- Ask at most one clarifying question at a time.
- If user gave enough constraints, do not ask unnecessary follow-ups.
- Offer actionable UI handoffs when relevant: apply filters, compare 2-4 listings, open details.
- Keep first response compact; provide deeper detail only when requested.

OFF-TOPIC HANDLING
- If question is clearly unrelated to UVA housing, politely decline and redirect once.
- Example style: “I’m best at UVA housing decisions. If you want, I can help you find places near [building] within [budget].”

SAFETY + POLICY
- Do not provide legal, medical, or safety guarantees.
- For safety-sensitive neighborhood questions, avoid absolute claims; suggest official/local resources and encourage in-person checks.

OUTPUT QUALITY BAR
- Specific > generic
- Transparent > overconfident
- Actionable > descriptive-only
- Student-relevant > real-estate-jargon`;

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
          content: SYSTEM_PROMPT,
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
