/**
 * Burns subtitles into DRIFT-demo.mp4 → DRIFT-final.mp4
 * Run:  node tools/add-subtitles.mjs
 */

import { writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const SHOTS_DIR = join(process.cwd(), 'screenshots');
const INPUT     = join(SHOTS_DIR, 'DRIFT-demo.mp4');
const OUTPUT    = join(SHOTS_DIR, 'DRIFT-final.mp4');
const SRT_FILE  = join(SHOTS_DIR, 'subs.srt');

// Helper: seconds → SRT timestamp
const ts = s => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms  = Math.round((s % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
};

const subs = [
  // [start, end, lines...]
  // CUT 1 — Hook
  [0.0,  4.0,  'This is DRIFT.'],
  [4.0,  7.5,  'A daily word game on Reddit —', 'with one rule that changes everything.'],

  // CUT 2 — First player
  [7.5,  11.5, 'One player sees a secret word.', 'Today: AVALANCHE.'],
  [11.5, 16.5, 'They write 3 clue words and pass it on.', 'The next player never sees the original.'],

  // CUT 3 — Second player
  [16.5, 20.5, 'The next player only sees:', 'CRUSHING · FROZEN · DESCENT'],
  [20.5, 25.5, 'They guess GLACIER.', 'Write 3 new clues. Pass it forward.'],
  [25.5, 28.5, 'Claude scores the guess: 84%.', '"Close — the signal bends slightly."'],

  // CUT 4 — Waiting
  [28.5, 32.5, 'After you play, you wait.'],
  [32.5, 36.5, 'You can see the chain filling up.', 'But not what anyone guessed.'],

  // CUT 5 — Reveal (short 1-liners — chain takes full screen)
  [36.5, 39.5, 'Midnight. The chain reveals.'],
  [39.5, 43.0, 'Claude AI scores every guess 0–100.'],
  [43.0, 46.0, 'AVALANCHE → CHRISTMAS = 19%. Signal lost.'],

  // CUT 6 — End
  [46.0, 47.6, "DRIFT. Don't break your streak."],
];

// Build SRT content
const srtLines = subs.map(([start, end, ...lines], i) =>
  `${i + 1}\n${ts(start)} --> ${ts(end)}\n${lines.join('\n')}`
).join('\n\n');

writeFileSync(SRT_FILE, srtLines + '\n');
console.log(`Wrote ${subs.length} subtitle entries to subs.srt`);

// Burn subtitles with ffmpeg
// Style: white bold text, black outline, bottom-center, readable on dark background
const srtPathEscaped = SRT_FILE.replace(/\\/g, '/').replace('C:/', 'C\\:/');

const style = [
  'FontName=Arial',
  'FontSize=9',
  'Bold=1',
  'PrimaryColour=&H00FFFFFF',   // white text
  'OutlineColour=&H00000000',   // black outline
  'BorderStyle=1',              // outline style (no box)
  'Outline=2',
  'Shadow=1',
  'Alignment=2',                // bottom-center
  'MarginV=20',
].join(',');

console.log('Burning subtitles into video...');
execSync([
  'ffmpeg -y',
  `-i "${INPUT}"`,
  `-vf "subtitles='${srtPathEscaped}':force_style='${style}'"`,
  '-c:v libx264 -preset fast -crf 20',
  '-pix_fmt yuv420p',
  `"${OUTPUT}"`,
].join(' '), { stdio: 'pipe' });

const size = statSync(OUTPUT).size;
console.log(`\n✓ ${OUTPUT}`);
console.log(`  ${(size/1024).toFixed(0)} KB — ready to upload to YouTube`);
