import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'screenshots') + '/';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4173/game.html';

const screens = [
  { name: '01-first-player', mock: 'first',    wait: 2000, desc: 'First Player — sees secret word AVALANCHE, writes 3 clues' },
  { name: '02-your-turn',    mock: 'yourturn', wait: 2000, desc: 'Your Turn — sees previous clues, guesses + writes new clues' },
  { name: '03-success',      mock: 'success',  wait: 3000, desc: 'Success — animated score counter, streak badge, global rank' },
  { name: '04-waiting',      mock: 'waiting',  wait: 2000, desc: 'Waiting — urgency bar, stats tab, leaderboard tab' },
  { name: '05-reveal',       mock: 'reveal',   wait: 5000, desc: 'Midnight Reveal — Phaser chain with semantic arc rings' },
];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=390,844'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2 },
});

for (const s of screens) {
  const page = await browser.newPage();
  await page.goto(`${BASE}?mock=${s.mock}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, s.wait));
  const path = `${OUT}${s.name}.png`;
  await page.screenshot({ path, fullPage: false });
  await page.close();
  console.log(`✓ ${s.name}.png  — ${s.desc}`);
}

await browser.close();
console.log('\nAll screenshots saved to /screenshots/');
