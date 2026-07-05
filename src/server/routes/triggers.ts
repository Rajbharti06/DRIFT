import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import type { TaskRequest, TaskResponse } from '@devvit/scheduler';
import { context, scheduler } from '@devvit/web/server';
import { createPost } from '../core/post';
import { runMidnightReveal, createDailyPost } from '../services/dailyJob';

export const triggers = new Hono();

// ── App install: create first post + schedule daily jobs ───────────────────
triggers.post('/on-app-install', async (c) => {
  try {
    await createPost();
    const input = await c.req.json<OnAppInstallRequest>();

    // Schedule midnight reveal — runs daily at 00:00 UTC
    await scheduler.runJob({
      name: 'midnight-reveal',
      cron: '0 0 * * *',
    });

    // Schedule daily post creation — runs at 00:01 UTC (after reveal)
    await scheduler.runJob({
      name: 'daily-post',
      cron: '1 0 * * *',
    });

    console.log('[DRIFT] Scheduled daily jobs on install');

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: `DRIFT installed in r/${context.subredditName} (trigger: ${input.type})`,
      },
      200
    );
  } catch (error) {
    console.error(`[DRIFT] Install error: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Install failed' }, 400);
  }
});

// ── Scheduler: handle all cron jobs ────────────────────────────────────────
triggers.post('/scheduler', async (c) => {
  try {
    const { name } = await c.req.json<TaskRequest>();
    console.log(`[DRIFT] Scheduler job fired: ${name}`);

    if (name === 'midnight-reveal') {
      await runMidnightReveal();
    } else if (name === 'daily-post') {
      await createDailyPost();
    }

    return c.json<TaskResponse>({}, 200);
  } catch (error) {
    console.error(`[DRIFT] Scheduler error: ${error}`);
    return c.json({}, 200); // Always 200 — Devvit retries on non-200
  }
});
