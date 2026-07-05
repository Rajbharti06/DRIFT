import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import { scoreSemanticSimilarity } from '../services/scorer';
import { getTodayKey, getYesterdayKey } from '../services/dailyJob';
import type {
  ChainLink,
  DriftStateResponse,
  SubmitPayload,
  SubmitResponse,
  LeaderboardEntry,
  LeaderboardResponse,
  ErrorResponse,
} from '../../shared/api';

const MAX_CHAIN = 10;

const WORDS = [
  'AVALANCHE', 'TELESCOPE', 'CATHEDRAL', 'LABYRINTH', 'MONSOON',
  'SYMPHONY', 'ARCHIPELAGO', 'THUNDERSTORM', 'CAROUSEL', 'VOLCANO',
  'MIRAGE', 'KALEIDOSCOPE', 'NOCTURNAL', 'EXPEDITION', 'PHANTOM',
  'CRYSTALLINE', 'TURBULENCE', 'SOLSTICE', 'QUICKSAND', 'BIOLUMINESCENCE',
  'SANDSTORM', 'HURRICANE', 'CONSTELLATION', 'SHIPWRECK', 'GLACIER',
  'VORTEX', 'WILDFIRE', 'UNDERGROUND', 'PRISM', 'FORTRESS',
];

function getWordForDate(dateKey: string): string {
  const start = new Date(new Date(dateKey).getFullYear(), 0, 0).getTime();
  const now = new Date(dateKey).getTime();
  const dayOfYear = Math.floor((now - start) / 86400000);
  return WORDS[dayOfYear % WORDS.length];
}

function cluesAreClean(clues: string[], targetWord: string): boolean {
  const t = targetWord.toLowerCase();
  return clues.every(c => !c.toLowerCase().includes(t));
}

async function getPlayerRank(username: string): Promise<number> {
  try {
    const total = await redis.zCard('drift:leaderboard');
    if (total === 0) return 0;
    const rank = await redis.zRank('drift:leaderboard', username);
    if (rank === null || rank === undefined) return 0;
    return total - rank; // convert ascending rank to descending (1 = best)
  } catch {
    return 0;
  }
}

async function getTopPlayers(limit = 3): Promise<LeaderboardEntry[]> {
  try {
    const members = await redis.zRange('drift:leaderboard', 0, limit - 1, {
      by: 'rank',
      reverse: true,
    });
    return await Promise.all(
      members.map(async (m) => {
        const [score, streak] = await Promise.all([
          redis.get(`drift:player:${m}:score`),
          redis.get(`drift:player:${m}:streak`),
        ]);
        return { username: m, score: score ? parseInt(score) : 0, streak: streak ? parseInt(streak) : 0 };
      })
    );
  } catch {
    return [];
  }
}

export const api = new Hono();

// ── GET /drift/state ───────────────────────────────────────────────────────
api.get('/drift/state', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ type: 'error', message: 'No post context' }, 400);

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const dateKey = getTodayKey();
  const secretWord = getWordForDate(dateKey);

  const [chainRaw, statusRaw, streakRaw, bestStreakRaw, scoreRaw] = await Promise.all([
    redis.get(`drift:daily:${dateKey}:chain`),
    redis.get(`drift:daily:${dateKey}:status`),
    redis.get(`drift:player:${username}:streak`),
    redis.get(`drift:player:${username}:best-streak`),
    redis.get(`drift:player:${username}:score`),
  ]);

  const chain: ChainLink[] = chainRaw ? JSON.parse(chainRaw) : [];
  const isRevealed = statusRaw === 'revealed';
  const isFull = chain.length >= MAX_CHAIN;
  const alreadyPlayed = chain.some(l => l.username === username);
  const isFirstPlayer = chain.length === 0;
  const isMyTurn = !alreadyPlayed && !isFull && !isRevealed;
  const myLink = chain.find(l => l.username === username);
  const prevClues = chain.length > 0 ? chain[chain.length - 1].clues : undefined;
  const playerStreak = streakRaw ? parseInt(streakRaw) : 0;
  const playerBestStreak = bestStreakRaw ? parseInt(bestStreakRaw) : 0;

  const [playerRank, topPlayers] = await Promise.all([
    getPlayerRank(username),
    getTopPlayers(3),
  ]);

  return c.json<DriftStateResponse>({
    type: 'state',
    dateKey,
    chainLength: chain.length,
    maxChain: MAX_CHAIN,
    slotsLeft: Math.max(0, MAX_CHAIN - chain.length),
    isFirstPlayer,
    isMyTurn,
    alreadyPlayed,
    isRevealed,
    isFull,
    prevClues,
    myPosition: myLink?.position,
    chain: isRevealed ? chain : undefined,
    secretWord: (isFirstPlayer && isMyTurn) || isRevealed ? secretWord : undefined,
    playerStreak,
    playerBestStreak,
    playerScore: scoreRaw ? parseInt(scoreRaw) : 0,
    playerRank,
    topPlayers,
  });
});

// ── POST /drift/submit ─────────────────────────────────────────────────────
api.post('/drift/submit', async (c) => {
  const { postId } = context;
  if (!postId) return c.json<ErrorResponse>({ type: 'error', message: 'No post context' }, 400);

  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
  const dateKey = getTodayKey();
  const secretWord = getWordForDate(dateKey);

  const { guess, clues } = await c.req.json<SubmitPayload>();

  if (!clues || clues.length !== 3 || clues.some(cl => !cl.trim())) {
    return c.json<ErrorResponse>({ type: 'error', message: 'All 3 clues are required' }, 400);
  }

  const chainRaw = await redis.get(`drift:daily:${dateKey}:chain`);
  const chain: ChainLink[] = chainRaw ? JSON.parse(chainRaw) : [];

  if (chain.some(l => l.username === username))
    return c.json<ErrorResponse>({ type: 'error', message: 'Already played today' }, 400);
  if (chain.length >= MAX_CHAIN)
    return c.json<ErrorResponse>({ type: 'error', message: 'Chain is full' }, 400);
  if (!cluesAreClean(clues, secretWord))
    return c.json<ErrorResponse>({ type: 'error', message: 'A clue contains the secret word!' }, 400);

  const isFirstPlayer = chain.length === 0;
  const actualGuess = isFirstPlayer ? secretWord : (guess ?? '');

  const { score: semanticScore, reason: scoreReason } = isFirstPlayer
    ? { score: 100, reason: 'chain started' }
    : await scoreSemanticSimilarity(actualGuess, secretWord);

  const newLink: ChainLink = {
    position: chain.length + 1,
    username,
    guess: actualGuess,
    clues: clues as [string, string, string],
    semanticScore,
    scoreReason,
  };

  chain.push(newLink);
  const isNowFull = chain.length >= MAX_CHAIN;

  // Streak calculation
  const yesterdayKey = getYesterdayKey();
  const [lastPlayed, streakRaw, bestRaw] = await Promise.all([
    redis.get(`drift:player:${username}:last-played`),
    redis.get(`drift:player:${username}:streak`),
    redis.get(`drift:player:${username}:best-streak`),
  ]);
  const currentStreak = streakRaw ? parseInt(streakRaw) : 0;
  const newStreak = lastPlayed === yesterdayKey ? currentStreak + 1 : 1;
  const best = bestRaw ? parseInt(bestRaw) : 0;

  await Promise.all([
    redis.set(`drift:daily:${dateKey}:chain`, JSON.stringify(chain)),
    redis.incrBy(`drift:player:${username}:score`, semanticScore),
    redis.zAdd('drift:leaderboard', { member: username, score: semanticScore }),
    redis.set(`drift:player:${username}:streak`, String(newStreak)),
    redis.set(`drift:player:${username}:last-played`, dateKey),
    newStreak > best
      ? redis.set(`drift:player:${username}:best-streak`, String(newStreak))
      : Promise.resolve(null),
    isNowFull
      ? redis.set(`drift:daily:${dateKey}:status`, 'revealed')
      : Promise.resolve(null),
  ]);

  const playerRank = await getPlayerRank(username);

  const message = isFirstPlayer
    ? 'You started the chain!'
    : semanticScore === 100 ? 'Perfect — the signal is strong.'
    : semanticScore >= 70 ? 'Close — the signal bends slightly.'
    : semanticScore >= 50 ? 'Drifting — you caught the concept.'
    : 'The signal is lost in the noise...';

  return c.json<SubmitResponse>({
    type: 'submit',
    success: true,
    position: newLink.position,
    semanticScore,
    pointsEarned: semanticScore,
    message,
    newStreak,
    playerRank,
  });
});

// ── GET /drift/leaderboard ─────────────────────────────────────────────────
api.get('/drift/leaderboard', async (c) => {
  const username = (await reddit.getCurrentUsername()) ?? 'anonymous';

  try {
    const members = await redis.zRange('drift:leaderboard', 0, 9, {
      by: 'rank',
      reverse: true,
    });

    const players = await Promise.all(
      members.map(async (m) => {
        const [score, streak] = await Promise.all([
          redis.get(`drift:player:${m}:score`),
          redis.get(`drift:player:${m}:streak`),
        ]);
        return { username: m, score: score ? parseInt(score) : 0, streak: streak ? parseInt(streak) : 0 };
      })
    );

    const [playerRank, scoreRaw] = await Promise.all([
      getPlayerRank(username),
      redis.get(`drift:player:${username}:score`),
    ]);

    return c.json<LeaderboardResponse>({
      type: 'leaderboard',
      players,
      playerRank,
      playerScore: scoreRaw ? parseInt(scoreRaw) : 0,
    });
  } catch {
    return c.json<LeaderboardResponse>({ type: 'leaderboard', players: [], playerRank: 0, playerScore: 0 });
  }
});
