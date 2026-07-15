export type FaqSearchRow = {
  id: string;
  question: string;
  answer: string;
  keywords?: string[] | null;
  question_embedding?: number[] | null;
};

const embeddingCache = new Map<string, number[]>();

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\W+/)
    .filter((t) => t.length > 2);
}

function scoreOverlap(queryTokens: string[], target: string): number {
  const targetTokens = new Set(tokenize(target));
  if (!queryTokens.length) return 0;
  let hits = 0;
  for (const t of queryTokens) {
    if (targetTokens.has(t)) hits += 1;
  }
  return hits / queryTokens.length;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const vector = data.data?.[0]?.embedding;
    if (!vector?.length) return null;
    embeddingCache.set(text, vector);
    return vector;
  } catch {
    return null;
  }
}

export function semanticFaqSearch(
  query: string,
  faqs: FaqSearchRow[]
): { id: string; question: string; answer: string } | null {
  const lower = query.toLowerCase();
  const direct = faqs.find(
    (f) =>
      f.question.toLowerCase().includes(lower) || f.answer.toLowerCase().includes(lower)
  );
  if (direct) return direct;

  const tokens = tokenize(query);
  let best: FaqSearchRow | null = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const keywordBlob = (faq.keywords ?? []).join(" ");
    const score = Math.max(
      scoreOverlap(tokens, faq.question),
      scoreOverlap(tokens, faq.answer) * 0.9,
      keywordBlob ? scoreOverlap(tokens, keywordBlob) * 1.15 : 0
    );
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  return bestScore >= 0.25 ? best : null;
}

export async function semanticFaqSearchWithEmbeddings(
  query: string,
  faqs: FaqSearchRow[]
): Promise<{ id: string; question: string; answer: string } | null> {
  const queryVector = await embedText(query);
  if (!queryVector) return semanticFaqSearch(query, faqs);

  let best: FaqSearchRow | null = null;
  let bestScore = 0;

  for (const faq of faqs) {
    let faqVector = faq.question_embedding;
    if (!faqVector?.length) {
      faqVector = await embedText(faq.question);
    }
    if (!faqVector?.length) continue;
    const score = cosineSimilarity(queryVector, faqVector);
    if (score > bestScore) {
      bestScore = score;
      best = faq;
    }
  }

  return bestScore >= 0.72 ? best : semanticFaqSearch(query, faqs);
}
