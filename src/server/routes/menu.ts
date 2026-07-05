import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis, reddit } from '@devvit/web/server';
import { createPost } from '../core/post';

export const menu = new Hono();

// Called once by the mod to activate Claude scoring:
// POST /internal/menu/set-api-key  body: { key: "sk-ant-..." }
menu.post('/set-api-key', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) return c.json<UiResponse>({ showToast: 'Not authenticated' }, 401);

    const sub = await reddit.getSubredditById(context.subredditId!);
    const isMod = sub.modPermissions?.get(username)?.length ?? 0;
    if (!isMod) return c.json<UiResponse>({ showToast: 'Moderators only' }, 403);

    const { key } = await c.req.json<{ key: string }>();
    if (!key?.startsWith('sk-ant-')) {
      return c.json<UiResponse>({ showToast: 'Invalid API key format' }, 400);
    }

    await redis.set('drift:config:api-key', key);
    return c.json<UiResponse>({ showToast: 'Claude API key saved! AI scoring is active.' }, 200);
  } catch (err) {
    console.error('[DRIFT] set-api-key error:', err);
    return c.json<UiResponse>({ showToast: 'Failed to save key' }, 500);
  }
});

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});
