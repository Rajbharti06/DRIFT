/**
 * Produces DRIFT-demo.mp4 via keyframe slideshow:
 *  - take a screenshot at each visual moment
 *  - each screenshot plays for a specified duration
 *  - ffmpeg concat demuxer stitches them into smooth H.264
 *
 * Run:  node tools/record-video.mjs
 * Requires: local server running at http://localhost:4173
 */

import puppeteer from 'puppeteer';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const BASE   = 'http://localhost:4173/game.html';
const KDIR   = join(process.cwd(), 'screenshots', 'kframes');
const OUT    = join(process.cwd(), 'screenshots', 'DRIFT-demo.mp4');
const CONCAT = join(KDIR, 'concat.txt');

if (existsSync(KDIR)) rmSync(KDIR, { recursive: true });
mkdirSync(KDIR, { recursive: true });

const hold = ms => new Promise(r => setTimeout(r, ms));

let kIdx = 0;
const entries = [];  // { file, duration }

async function snap(page, durationSec) {
  const name = `kf${String(kIdx++).padStart(4,'0')}.png`;
  const path = join(KDIR, name);
  await page.screenshot({ path });
  entries.push({ file: name, duration: durationSec });
  process.stdout.write('.');
}

async function nav(page, mock) {
  await page.goto(`${BASE}?mock=${mock}`, { waitUntil: 'domcontentloaded' });
  await hold(400);
}

async function typeIn(page, sel, text) {
  const el = await page.$(sel);
  if (!el) return;
  for (const ch of text) {
    await el.type(ch, { delay: 0 });
    await hold(85);
  }
}

// ─────────────────────────────────────────────────────────────
console.log('Launching browser...');
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=390,844'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});
const page = await browser.newPage();

// ── CUT 1 — Hook (0:00–0:08) ─────────────────────────────────
console.log('\n▶ Cut 1 — Hook');
await nav(page, 'first');
await snap(page, 3.0);   // DRIFT logo on screen, blank clue boxes
await snap(page, 3.5);   // hold a bit longer

// ── CUT 2 — First Player types clues (0:08–0:22) ─────────────
console.log('\n▶ Cut 2 — First player');
// type CRUSHING into clue 1
const c1 = await page.$$('input[placeholder^="Clue"]');
if (c1[0]) await c1[0].type('CRUSHING', { delay: 85 });
await snap(page, 1.2);
if (c1[1]) await c1[1].type('FROZEN',  { delay: 85 });
await snap(page, 1.0);
if (c1[2]) await c1[2].type('DESCENT', { delay: 85 });
await snap(page, 1.5);   // all 3 clues filled

// Success — score animates to 100
await nav(page, 'success');
await snap(page, 0.3);
await snap(page, 0.5);
await snap(page, 0.8);
await snap(page, 1.0);
await snap(page, 1.5);
await snap(page, 2.0);   // score fully shown, streak, rank badge

// ── CUT 3 — Second player (0:22–0:34) ────────────────────────
console.log('\n▶ Cut 3 — Second player');
await nav(page, 'yourturn');
await snap(page, 1.0);   // sees CRUSHING · FROZEN · DESCENT
// type guess
const gInput = await page.$('input[placeholder="TYPE YOUR GUESS"]');
if (gInput) await gInput.type('GLACIER', { delay: 85 });
await snap(page, 1.0);
// type new clues
const c2 = await page.$$('input[placeholder^="Clue"]');
if (c2[0]) await c2[0].type('ANCIENT', { delay: 85 });
await snap(page, 0.8);
if (c2[1]) await c2[1].type('SLOW',    { delay: 85 });
await snap(page, 0.8);
if (c2[2]) await c2[2].type('MELTING', { delay: 85 });
await snap(page, 1.2);
// success at 84
await nav(page, 'success');
await snap(page, 0.5);
await snap(page, 1.0);
await snap(page, 2.0);

// ── CUT 4 — Waiting (0:34–0:44) ──────────────────────────────
console.log('\n▶ Cut 4 — Waiting');
await nav(page, 'waiting');
await snap(page, 1.5);   // stats tab, urgency bar pulsing
await snap(page, 1.5);
// click leaderboard tab
const lbBtn = await page.$('#tab-lb-btn');
if (lbBtn) await lbBtn.click();
await hold(200);
await snap(page, 1.5);   // leaderboard rows 🥇🥈🥉
await snap(page, 1.5);
await snap(page, 2.0);

// ── CUT 5 — Reveal (0:44–0:58) ───────────────────────────────
console.log('\n▶ Cut 5 — Reveal');
await nav(page, 'reveal');
// capture chain appearing node by node
for (let i = 0; i < 8; i++) {
  await hold(i < 3 ? 600 : 900);   // early nodes faster, later slower
  await snap(page, 1.0);
}
await snap(page, 2.0);   // hold on full chain

// ── CUT 6 — End card (0:58–1:00) ─────────────────────────────
console.log('\n▶ Cut 6 — End');
await nav(page, 'first');
await snap(page, 2.5);

await browser.close();

// ── Build ffmpeg concat list ──────────────────────────────────
const total = entries.reduce((s, e) => s + e.duration, 0);
console.log(`\n\nKeyframes: ${entries.length}  |  Total: ${total.toFixed(1)}s`);

const concatTxt = entries.map(e =>
  `file '${e.file}'\nduration ${e.duration.toFixed(3)}`
).join('\n') + `\nfile '${entries.at(-1).file}'`;  // ffmpeg needs a final file line
writeFileSync(CONCAT, concatTxt);

// ── Encode ────────────────────────────────────────────────────
console.log('Encoding...');
execSync([
  'ffmpeg -y',
  `-f concat -safe 0 -i "${CONCAT}"`,
  '-c:v libx264 -preset slow -crf 20',
  '-pix_fmt yuv420p',
  '-vf "scale=390:844,fps=30"',  // upsample to 30fps for smooth playback
  `"${OUT}"`,
].join(' '), { stdio: 'pipe' });

// Quick check
const size = (await import('fs')).statSync(OUT).size;
console.log(`\n✓  ${OUT}`);
console.log(`   ${(size/1024).toFixed(0)} KB  |  ${total.toFixed(1)}s`);
console.log('\n   → Upload to YouTube (unlisted)');
console.log('   → Paste YouTube URL into Devpost demo video field');
