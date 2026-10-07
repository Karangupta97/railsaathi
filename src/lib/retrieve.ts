import intentsData from "@/data/intents.json";
import type { LanguageCode } from "./languages";

/**
 * Lightweight TF-IDF-ish retrieval over the seed knowledge base.
 *
 * No external dependency: we tokenise the query and each topic's patterns +
 * title, score by term overlap weighted with inverse document frequency, and
 * add a bonus for phrase (pattern) containment. Good enough to route the ~8
 * seed topics; swap for a real vector store when the KB grows.
 *
 * Works for Latin and Devanagari because tokenisation splits on non-letter
 * characters using Unicode property escapes.
 */
export type Topic = {
  id: string;
  title: string;
  patterns: string[];
  answer: Record<LanguageCode, string>;
  source: string;
  followups: Record<LanguageCode, string[]>;
};

type IntentsFile = { topics: Topic[] };

export const TOPICS: readonly Topic[] = (intentsData as IntentsFile).topics;

export type RetrievalResult = { topic: Topic; score: number };

const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u;

/** English stop words only; Devanagari terms are content-bearing here. */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "am", "i", "my", "me", "you", "your", "to", "of",
  "on", "in", "at", "for", "and", "or", "do", "does", "how", "what", "can", "should",
  "it", "this", "that", "with", "was", "were", "be", "been", "if", "so", "please",
  "someone", "some", "there", "here", "get", "got",
]);

function tokenise(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .split(TOKEN_SPLIT)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Precompute each topic's token set and inverse document frequency table. */
type IndexedTopic = { topic: Topic; tokens: Set<string>; phrases: string[] };

const INDEX: IndexedTopic[] = TOPICS.map((topic) => {
  const text = [topic.title, ...topic.patterns].join(" ");
  return {
    topic,
    tokens: new Set(tokenise(text)),
    phrases: topic.patterns.map((p) => p.normalize("NFC").toLowerCase().trim()).filter(Boolean),
  };
});

const IDF: Map<string, number> = (() => {
  const df = new Map<string, number>();
  for (const { tokens } of INDEX) {
    for (const token of tokens) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const n = INDEX.length;
  const idf = new Map<string, number>();
  for (const [token, count] of df) idf.set(token, Math.log((n + 1) / (count + 0.5)) + 1);
  return idf;
})();

/**
 * Returns topics sorted by descending relevance. An empty array means the
 * query matched nothing in the KB.
 */
export function retrieveTopics(query: string, limit = 3): RetrievalResult[] {
  const normalisedQuery = query.normalize("NFC").toLowerCase().trim();
  const queryTokens = tokenise(query);
  if (queryTokens.length === 0) return [];

  const queryWeight = queryTokens.reduce((sum, token) => sum + (IDF.get(token) ?? 1), 0) || 1;

  const results: RetrievalResult[] = INDEX.map(({ topic, tokens, phrases }) => {
    let overlap = 0;
    for (const token of queryTokens) {
      if (tokens.has(token)) overlap += IDF.get(token) ?? 1;
    }
    let score = overlap / queryWeight;

    // Strong bonus when the query contains, or is contained by, a known phrase.
    for (const phrase of phrases) {
      if (normalisedQuery.includes(phrase) || phrase.includes(normalisedQuery)) {
        score += 0.5;
        break;
      }
    }
    return { topic, score };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
