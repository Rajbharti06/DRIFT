import Anthropic from '@anthropic-ai/sdk';
import { redis } from '@devvit/web/server';

// API key stored in Redis at drift:config:api-key (set via /internal/admin/set-key)

export type ScoreResult = {
  score: number;   // 0–100
  reason: string;  // ≤3 words, shown on reveal screen
};

const CACHE_TTL_DAYS = 7;

// Prompt calibrated for consistent 0-100 semantic distance scores
const buildPrompt = (target: string, guess: string) => `
You are scoring semantic drift in a word telephone game called DRIFT.

Original secret word: ${target}
Player's interpretation: ${guess}

Score 0–100 measuring semantic closeness:
100 = identical/synonym | 70 = closely related | 50 = same domain | 30 = loose link | 0 = unrelated

Calibration examples:
OCEAN → SEA = 95 (near-synonyms)
AVALANCHE → SNOWSTORM = 72 (closely related phenomena)
AVALANCHE → MOUNTAIN = 50 (same domain, different concept)
AVALANCHE → COLD = 28 (loose sensory connection)
AVALANCHE → PIZZA = 4 (unrelated)
TELESCOPE → STARS = 55 (telescope used to view stars)
SYMPHONY → MUSIC = 70 (core relationship)

Return ONLY valid JSON, no markdown:
{"score":<integer 0-100>,"reason":"<3 words max>"}
`.trim();

async function getApiKey(): Promise<string | null> {
  try {
    return (await redis.get('drift:config:api-key')) ?? null;
  } catch {
    return null;
  }
}

async function callClaude(apiKey: string, target: string, guess: string): Promise<ScoreResult> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 80,
    messages: [{ role: 'user', content: buildPrompt(target, guess) }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const parsed = JSON.parse(text) as { score: number; reason: string };
  return {
    score: Math.min(100, Math.max(0, Math.round(parsed.score))),
    reason: (parsed.reason ?? 'scored').slice(0, 30),
  };
}

function basicScore(guess: string, target: string): ScoreResult {
  const g = guess.toUpperCase().trim();
  const t = target.toUpperCase().trim();
  if (g === t) return { score: 100, reason: 'exact match' };
  if (g.includes(t) || t.includes(g)) return { score: 70, reason: 'contains word' };
  let shared = 0;
  for (let i = 0; i < Math.min(g.length, t.length); i++) {
    if (g[i] !== t[i]) break;
    shared++;
  }
  if (shared >= 4) return { score: 55, reason: 'similar root' };
  return { score: 20, reason: 'signal lost' };
}

export async function scoreSemanticSimilarity(
  guess: string,
  target: string
): Promise<ScoreResult> {
  const cacheKey = `drift:score:${target.toUpperCase()}:${guess.toUpperCase()}`;

  // Return cached result to avoid duplicate API calls
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as ScoreResult;

  const apiKey = await getApiKey();

  let result: ScoreResult;
  if (apiKey) {
    try {
      result = await callClaude(apiKey, target.toUpperCase(), guess.toUpperCase());
    } catch (err) {
      console.error('Claude scoring failed, using basic scorer:', err);
      result = basicScore(guess, target);
    }
  } else {
    result = basicScore(guess, target);
  }

  // Cache with 7-day expiry — same pairs recur across game days
  const expiration = new Date(Date.now() + CACHE_TTL_DAYS * 86400 * 1000);
  await redis.set(cacheKey, JSON.stringify(result), { expiration });

  return result;
}
