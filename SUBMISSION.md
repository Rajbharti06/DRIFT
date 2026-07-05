# DRIFT — Devpost Submission Materials

## Project Name
DRIFT

## Tagline
A daily word telephone game. 10 strangers. One signal. Watch it drift.

---

## Short Description (shown in card view)
DRIFT is a daily cooperative word game built on Reddit. One secret word. Ten players pass it forward using only 3-word clues — each player guessing from the last player's clues, never seeing the original. At midnight, the full chain reveals: did the signal survive, or did it drift into something unrecognizable?

---

## Full Description (paste into Devpost rich text editor)

### What is DRIFT?

Every day at midnight, DRIFT chooses a secret word — something evocative like **AVALANCHE** or **NOCTURNAL**. The first player sees it and writes 3 clue words. The second player sees only those 3 clues, guesses the original word, and writes 3 new clues based on their guess. The chain passes through up to 10 community players.

No player after Link #1 ever sees the original word.

At midnight, everything reveals: every guess, every clue trio, every AI-scored semantic distance from the signal. You find out if your link held — or if you were the one who broke the chain.

---

### The Hook

**You don't know if you won until midnight.**

That's it. That's the hook. You submit your guess and clues, see "Signal transmitted. Link #4," and wait. All day. The chain is filling up around you. You can see it progressing — 6 links, 7, 8 — but you can't see anyone else's guesses. Just your own uncertainty, a streak counter you're scared to break, and the slow approach of midnight.

When the reveal hits, it's either euphoric ("AVALANCHE → glacier → ice → cold → winter — the signal barely drifted!") or humbling ("AVALANCHE → sandstorm → desert → heat — yeah, that's on me").

---

### The AI Scoring Engine

Each guess is semantically scored against the original word in real time using **Claude (claude-haiku-4-5-20251001)**. The score isn't just string matching — it's genuine semantic proximity:

- AVALANCHE → GLACIER: 91% (closely related)
- AVALANCHE → SNOWFALL: 78% (same domain)
- AVALANCHE → DESERT: 12% (signal lost)

Scores are cached in Redis and visualized at reveal using color-coded Phaser arcs — green for strong, amber for drifting, red for lost. The AI also validates clues in real time, rejecting any that contain the secret word or its derivatives.

---

### Phaser Innovation

The chain reveal is built entirely in Phaser 4:

- **Staggered tween animation** — 10 nodes appear one by one at 220ms intervals
- **Semantic arc rings** — each node has a partial arc (270° + score × 3.6°) showing how close the guess was
- **Ping burst particles** — expanding ring explosion as each link appears
- **Adaptive canvas** — node size, font, and layout reflow for any iframe width
- **Camera drag scroll** — if the chain is long, the canvas becomes scrollable via pointer drag
- **Completion shake** — gentle camera shake when the final node lands

---

### Retention Mechanics

Five interlocking systems pull players back every day:

1. **Daily streak** — displayed prominently with fire count. Miss a day and it resets to zero. The fear of breaking a streak is real.
2. **Urgency bar** — live slot counter ("Only 3 slots left — signal fading fast") with an animated pulse dot. Creates FOMO as the chain fills.
3. **Global leaderboard** — Redis sorted sets rank all players by cumulative semantic score. Your rank is shown on the success and waiting screens.
4. **Midnight reveal appointment** — the chain only reveals at midnight UTC. This creates a daily return anchor, not just a reason to play once.
5. **Position stakes** — knowing you're Link #4 in a 10-person chain means you feel responsible. If the word drifts, everyone sees it was your link that shifted it.

---

### User Contributions

Every clue trio is player-created content. The game has no static puzzles — every chain is built entirely by the community in real time. When you play DRIFT, you're not consuming content; you're creating the puzzle for the next player. The daily reveal shows all 10 players' contributions side-by-side, crediting each one.

---

### Technical Stack

| Layer | Technology |
|-------|-----------|
| Platform | Devvit Web (Reddit Developer Platform) |
| Visualization | Phaser 4.2.0 |
| Server | Hono on Devvit serverless Node.js |
| AI Scoring | Claude (claude-haiku-4-5-20251001) via Anthropic API |
| Persistence | Devvit Redis (sorted sets for leaderboard, date-keyed chains) |
| Scheduling | Devvit Scheduler (midnight reveal, daily post creation) |
| API Key Storage | Devvit Settings (isSecret: true) |

---

## Video Script (strictly under 60 seconds)

**Record as one continuous screen capture. No voiceover needed — the UI tells the story.**

### Cut 1 — Hook (0:00–0:08)
Show the DRIFT card loading in a Reddit post. Let the logo glow animation play.
Optional text overlay: *"What if you played telephone — but the message was a word?"*

### Cut 2 — First Player (0:08–0:22)
Show the secret word **AVALANCHE** on screen.
Type 3 clues fast: CRUSHING · FROZEN · DESCENT.
Hit TRANSMIT SIGNAL. Show the score counter animating up: 🔥 1 Day Streak · #12 Global.

### Cut 3 — Second Player (0:22–0:34)
New player view — only sees CRUSHING · FROZEN · DESCENT (no AVALANCHE).
Type guess: GLACIER. New clues: ANCIENT · SLOW · MELTING.
Score flash: **84** counting up. Green. "Close — the signal bends slightly."

### Cut 4 — Waiting Screen (0:34–0:44)
Show urgency bar pulsing: *"Only 4 slots left — signal fading fast"*
Chain progress bar at 60%. Stats tab: Score · Rank · Position.
Leaderboard tab: 🥇🥈🥉 with streak fires.

### Cut 5 — Midnight Reveal (0:44–0:58)
Phaser canvas — chain nodes appearing one by one with ping bursts.
Full chain: AVALANCHE → GLACIER → ARCTIC → POLAR → COLD → WINTER → MALL
One node glows red: *"23% · signal lost"*. Camera shake on final node.

### Cut 6 — End card (0:58–1:00)
DRIFT logo. Text: *"Play daily. Don't break your streak."*

---

**Recording tip:** Use screen capture at 1280×720. The game runs locally via `npm run dev` with mock API responses if the subreddit isn't available. Total runtime: 58–60 seconds.

---

## Pre-Submission Checklist

### Technical (do in order)
- [ ] **Resolve subreddit access** — Contact Devvit Discord (`discord.gg/reddditdev`) about bot `t2_2hxk1xnp06` being banned from new subreddits. Explain you're a hackathon participant.
- [ ] `npx devvit upload` — upload latest build
- [ ] `npx devvit settings set ANTHROPIC_API_KEY` — enter your `sk-ant-api03-...` key when prompted
- [ ] Add domain exception in Devvit developer portal:
      **Developer Settings → Domain Exceptions → Add:** `api.anthropic.com`
- [ ] `npx devvit install <your-subreddit>` — install app on working subreddit
- [ ] Visit the Reddit post, play through as both Player 1 and Player 2 to verify the full flow
- [ ] Verify the leaderboard populates after submission
- [ ] Check streak is tracking across days (wait until next day or temporarily modify date logic for testing)

### Submission Form (Devpost)
- [ ] Project name: DRIFT
- [ ] Tagline: (use tagline above)
- [ ] Description: (paste Full Description above)
- [ ] Demo video: (upload recorded video)
- [ ] Demo URL: link to the Reddit post where the game is running
- [ ] App listing URL: `https://developers.reddit.com/apps/drift-game`
- [ ] Built with: Devvit Web, Phaser 4, Hono, Claude API, Redis, Devvit Scheduler
- [ ] Prize categories: ✓ Best Hook ✓ Best Phaser ✓ Best Retention ✓ Best User Contributions
- [ ] Team: solo (aytraj05@gmail.com)

### Optional (improves chances)
- [ ] Fill out the developer satisfaction survey (unlocks $200 Feedback prize eligibility)
- [ ] Post in r/GameOnReddit showcasing DRIFT
- [ ] Share in Devvit Discord #showcase channel

---

## Commands

```bash
# 1. Upload latest build (already done — v0.0.3 live)
npx devvit upload

# 2. Install on your subreddit (once bot ban is resolved)
npx devvit install <subreddit-name>

# 3. Set the AI API key via the mod admin endpoint (one-time, after install)
#    Make this HTTP call from a browser tab while logged in as the mod:
curl -X POST https://<your-devvit-server>/internal/menu/set-api-key \
  -H "Content-Type: application/json" \
  -d '{"key":"sk-ant-api03-YOUR_KEY_HERE"}'
#    Or open the Reddit post as a moderator and call the endpoint via browser devtools.

# 4. Open the developer portal to add domain exception
#    Go to: https://developers.reddit.com/apps/drift-game
#    → Settings → Domain Exceptions → Add "api.anthropic.com"
```

---

## Bot Ban Resolution (Critical Blocker)

The Devvit bot account (`t2_2hxk1xnp06`) is banned from all subreddits on the `Content-Tear-1670` Reddit account. This blocks live playtesting.

**Options (try in this order):**

1. **Devvit Discord** — Join `discord.gg/redditdev`, go to `#hackathon` or `#help`, explain you're a hackathon participant and your bot is getting banned from new subreddits. They have office hours and can likely manually whitelist or advise.

2. **Use an older Reddit account** — If you have a secondary account older than ~6 months with some karma, create the subreddit there and install the app.

3. **Ask the Devvit team directly** — Reply in your Devpost project comments asking for a test subreddit. Hackathon organizers sometimes provide test environments.

4. **Video workaround** — If no live subreddit is available before the deadline, record the demo by running the Vite dev server locally (`npm run dev`) and mocking the API responses. Judges primarily evaluate the video for the Phaser and Hook prizes.

---

## Prize Strategy (Rules Clarification)

**A project can only win ONE prize.** We are entering all four sub-categories, but the primary target is:

**$15,000 — Best App with a Hook** ← optimize everything for this

The judging criteria are identical across all categories (Delightful UX · Polish · Reddity · Hook). Entering all sub-categories maximizes the chance that judges assign us to whichever category DRIFT fits best.

Additionally — individual prizes separate from the project:
- Fill out the developer feedback survey → eligible for $200 Feedback Award
- Participate in Devvit Discord → eligible for $500 Devvit Helpers

---

## What Makes DRIFT Different (For Judges)

> "The signal is lost in translation — but you don't know that until midnight."

Most word games give you instant feedback. DRIFT weaponizes the *delay*. The gap between submission and reveal is where the game lives. This is a new mechanic — not Wordle, not Codenames, not telephone-as-trivia. It's anticipation as a game mechanic, with AI scoring the drift in real time and Phaser visualizing how far the signal traveled before it broke.
