import { redis, reddit } from '@devvit/web/server';
import type { ChainLink } from '../../shared/api';

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getYesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

// Called at midnight UTC — reveals yesterday's chain and updates player streaks
export async function runMidnightReveal(): Promise<void> {
  const yesterdayKey = getYesterdayKey();
  const chainRaw = await redis.get(`drift:daily:${yesterdayKey}:chain`);
  const status = await redis.get(`drift:daily:${yesterdayKey}:status`);

  if (!chainRaw || status === 'revealed') return;

  const chain: ChainLink[] = JSON.parse(chainRaw);
  if (chain.length === 0) return;

  await redis.set(`drift:daily:${yesterdayKey}:status`, 'revealed');
  await updateStreaks(chain, yesterdayKey);

  console.log(`[DRIFT] Midnight reveal complete for ${yesterdayKey} — ${chain.length} links`);
}

// Posts the daily DRIFT post to the subreddit for the new day
export async function createDailyPost(): Promise<void> {
  try {
    const todayKey = getTodayKey();
    const alreadyPosted = await redis.get(`drift:daily:${todayKey}:postId`);
    if (alreadyPosted) return;

    const subredditName = (await reddit.getCurrentSubreddit()).name;
    const post = await reddit.submitPost({
      subredditName,
      title: `DRIFT — Daily Word Chain • ${todayKey}`,
      richtext: {
        ops: [
          {
            insert: 'A new chain begins. Be the first link — or decode the signal passed to you.\n\nHow far will today\'s word drift?',
          },
        ],
      },
    });

    await redis.set(`drift:daily:${todayKey}:postId`, post.id);
    console.log(`[DRIFT] Daily post created: ${post.id}`);
  } catch (err) {
    console.error('[DRIFT] Failed to create daily post:', err);
  }
}

// Updates streaks for everyone who participated in a revealed chain
async function updateStreaks(chain: ChainLink[], dateKey: string): Promise<void> {
  const yesterdayKey = getYesterdayKey();

  await Promise.all(
    chain.map(async (link) => {
      const u = link.username;
      const lastPlayed = await redis.get(`drift:player:${u}:last-played`);

      let newStreak = 1;
      if (lastPlayed === yesterdayKey) {
        const current = await redis.get(`drift:player:${u}:streak`);
        newStreak = (current ? parseInt(current) : 0) + 1;
      }

      const bestRaw = await redis.get(`drift:player:${u}:best-streak`);
      const best = bestRaw ? parseInt(bestRaw) : 0;

      await Promise.all([
        redis.set(`drift:player:${u}:streak`, String(newStreak)),
        redis.set(`drift:player:${u}:last-played`, dateKey),
        newStreak > best
          ? redis.set(`drift:player:${u}:best-streak`, String(newStreak))
          : Promise.resolve(null),
      ]);
    })
  );
}
