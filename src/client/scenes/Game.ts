import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import type {
  DriftStateResponse,
  ChainLink,
  LeaderboardEntry,
  SubmitResponse,
} from '../../shared/api';

const C = {
  bg: 0x0d1117,
  border: 0x30363d,
  gold: 0xffd700,
  green: 0x3fb950,
  orange: 0xe3b341,
  red: 0xf85149,
  blue: 0x58a6ff,
};

function scoreToColor(score: number): number {
  return score >= 70 ? C.green : score >= 45 ? C.orange : C.red;
}
function scoreToHex(score: number): string {
  return score >= 70 ? '#3fb950' : score >= 45 ? '#e3b341' : '#f85149';
}
function flashClass(score: number): string {
  return score >= 70 ? 'strong' : score >= 45 ? 'medium' : 'weak';
}

export class Game extends Scene {
  private overlay!: HTMLElement;
  private serverState: DriftStateResponse | null = null;
  private submitResult: SubmitResponse | null = null;

  constructor() { super('Game'); }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    this.overlay = document.getElementById('drift-overlay')!;
    const mock = new URLSearchParams(window.location.search).get('mock');
    if (mock) { this.loadMock(mock); return; }
    this.showLoading('Reading the signal...');
    this.fetchState();
  }

  // ── Mock mode (local preview, no server needed) ────────────────────────────

  private loadMock(screen: string) {
    const base: DriftStateResponse = {
      type: 'state', dateKey: '2026-07-06',
      chainLength: 6, maxChain: 10, slotsLeft: 4,
      isFirstPlayer: false, isMyTurn: false,
      alreadyPlayed: true, isRevealed: false, isFull: false,
      playerStreak: 5, playerBestStreak: 12,
      playerScore: 423, playerRank: 7,
      topPlayers: [
        { username: 'WordMaster99', score: 891, streak: 14 },
        { username: 'SignalKeeper', score: 754, streak: 8 },
        { username: 'NightOwlDev',  score: 612, streak: 3 },
      ],
    };

    if (screen === 'first') {
      this.serverState = { ...base, isFirstPlayer: true, isMyTurn: true,
        alreadyPlayed: false, chainLength: 0, slotsLeft: 10, secretWord: 'AVALANCHE' };
      this.showFirstPlayer();

    } else if (screen === 'yourturn') {
      this.serverState = { ...base, isMyTurn: true, alreadyPlayed: false,
        prevClues: ['CRUSHING', 'FROZEN', 'DESCENT'] };
      this.showYourTurn();

    } else if (screen === 'success') {
      this.serverState = base;
      this.submitResult = {
        type: 'submit', success: true, position: 4,
        semanticScore: 87, pointsEarned: 87,
        message: 'Close — the signal bends slightly.',
        newStreak: 6, playerRank: 5,
      };
      this.showSuccess();

    } else if (screen === 'waiting') {
      this.serverState = base;
      this.showWaiting();

    } else if (screen === 'reveal') {
      const chain: ChainLink[] = [
        { position: 1, username: 'SnowRider42',  guess: 'AVALANCHE',   clues: ['CRUSHING','FROZEN','DESCENT'],   semanticScore: 100, scoreReason: 'chain started' },
        { position: 2, username: 'IcePeak_7',    guess: 'GLACIER',     clues: ['ANCIENT','SLOW','MELTING'],      semanticScore: 84,  scoreReason: 'closely related' },
        { position: 3, username: 'ArcticFox22',  guess: 'ARCTIC',      clues: ['POLAR','VAST','FROZEN'],         semanticScore: 71,  scoreReason: 'same domain' },
        { position: 4, username: 'Content-Tear', guess: 'POLAR',       clues: ['BEARS','COLD','REMOTE'],         semanticScore: 63,  scoreReason: 'overlapping' },
        { position: 5, username: 'NightOwlDev',  guess: 'COLD',        clues: ['WINTER','SHIVER','DARK'],        semanticScore: 48,  scoreReason: 'drifting' },
        { position: 6, username: 'WordMaster99', guess: 'WINTER',      clues: ['CHRISTMAS','COZY','FIREPLACE'],  semanticScore: 41,  scoreReason: 'seasonal link' },
        { position: 7, username: 'SignalKeeper', guess: 'CHRISTMAS',   clues: ['GIFTS','SHOPPING','LIGHTS'],     semanticScore: 19,  scoreReason: 'signal lost' },
        { position: 8, username: 'PixelDrifter', guess: 'SHOPPING',    clues: ['MALL','CROWDS','SALES'],         semanticScore: 11,  scoreReason: 'far drift' },
      ];
      this.showReveal(chain, 'AVALANCHE');

    } else {
      // Default: cycle all screens
      this.loadMock('waiting');
    }
  }

  // ── Data layer ─────────────────────────────────────────────────────────────

  private async fetchState() {
    try {
      const res = await fetch('/api/drift/state');
      const data = await res.json() as DriftStateResponse;
      this.serverState = data;
      this.routeState();
    } catch {
      this.showError('Cannot reach server. Reload to retry.');
    }
  }

  private routeState() {
    const s = this.serverState!;
    if (s.isRevealed && s.chain) {
      this.showReveal(s.chain, s.secretWord ?? '');
    } else if (s.alreadyPlayed || s.isFull) {
      this.showWaiting();
    } else if (s.isMyTurn && s.isFirstPlayer) {
      this.showFirstPlayer();
    } else if (s.isMyTurn) {
      this.showYourTurn();
    } else {
      this.showWaiting();
    }
  }

  // ── Overlay helpers ────────────────────────────────────────────────────────

  private showOverlay(html: string) {
    this.children.removeAll(true);
    this.overlay.innerHTML = html;
    this.overlay.classList.remove('hidden');
  }

  private hideOverlay() {
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
  }

  private el<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  // ── Loading & error ────────────────────────────────────────────────────────

  private showLoading(msg = 'Loading...') {
    this.showOverlay(`
      <div class="drift-card" style="text-align:center;">
        <div class="drift-logo">DRIFT</div>
        <div class="drift-subtitle">${msg}</div>
        <div style="margin-top:20px;color:#30363d;letter-spacing:4px;font-size:18px;">· · ·</div>
      </div>`);
  }

  private showError(msg: string) {
    this.showOverlay(`
      <div class="drift-card" style="text-align:center;">
        <div class="drift-logo">DRIFT</div>
        <div class="drift-error" style="font-size:15px;margin-top:16px;">${msg}</div>
      </div>`);
  }

  // ── First Player ───────────────────────────────────────────────────────────

  private showFirstPlayer() {
    const word = this.serverState?.secretWord ?? '???';
    this.showOverlay(`
      <div class="drift-card">
        <div class="drift-logo">DRIFT</div>
        <div class="drift-subtitle">YOU ARE LINK #1 — START THE CHAIN</div>

        <div class="drift-section-label">Today's Signal Word</div>
        <div class="drift-word-display">${word}</div>

        <div class="drift-section-label">Your 3 Clues</div>
        <p style="font-size:12px;color:#8b949e;margin:0 0 12px;line-height:1.6;">
          The next player sees only your clues — not the word. Make them precise but not obvious.
        </p>
        <div class="drift-input-row">
          <input id="clue1" class="drift-input" placeholder="Clue 1" maxlength="20" autocomplete="off" />
          <input id="clue2" class="drift-input" placeholder="Clue 2" maxlength="20" autocomplete="off" />
          <input id="clue3" class="drift-input" placeholder="Clue 3" maxlength="20" autocomplete="off" />
        </div>
        <div id="fp-err" class="drift-error"></div>
        <button id="fp-btn" class="drift-btn drift-btn-primary" style="margin-top:8px;">START THE CHAIN</button>
        <p class="drift-rule">Do not use "${word}" or any part of it in your clues.</p>
      </div>`);

    this.el<HTMLButtonElement>('fp-btn').addEventListener('click', () => this.doSubmitFirst(word));
    ['clue1','clue2','clue3'].forEach(id =>
      this.el<HTMLInputElement>(id).addEventListener('keydown', e => { if (e.key === 'Enter') this.el('fp-btn').click(); })
    );
  }

  private async doSubmitFirst(word: string) {
    const c1 = this.el<HTMLInputElement>('clue1').value.trim().toUpperCase();
    const c2 = this.el<HTMLInputElement>('clue2').value.trim().toUpperCase();
    const c3 = this.el<HTMLInputElement>('clue3').value.trim().toUpperCase();
    const err = this.el('fp-err');
    if (!c1 || !c2 || !c3) { err.textContent = 'All 3 clues are required.'; return; }
    if ([c1,c2,c3].some(c => c === word.toUpperCase())) { err.textContent = "Can't use the signal word as a clue!"; return; }

    const btn = this.el<HTMLButtonElement>('fp-btn');
    btn.disabled = true; btn.textContent = 'Transmitting...';

    await this.doSubmit({ guess: word, clues: [c1, c2, c3] },
      () => { btn.disabled = false; btn.textContent = 'START THE CHAIN'; });
  }

  // ── Your Turn ──────────────────────────────────────────────────────────────

  private showYourTurn() {
    const s = this.serverState!;
    const [c0, c1, c2] = s.prevClues ?? ['?', '?', '?'];
    const slotsLeft = s.slotsLeft;
    const urgencyHtml = slotsLeft <= 3
      ? `<div class="drift-urgency"><div class="drift-urgency-dot"></div>
         <span class="drift-urgency-text">Only ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left — signal fading fast</span></div>`
      : '';
    const streakHtml = s.playerStreak > 0
      ? `<div class="drift-streak" style="margin-bottom:12px;">
           <span class="drift-streak-fire">🔥</span>
           <span class="drift-streak-count">${s.playerStreak}</span>
           <div class="drift-streak-info">
             <div class="drift-streak-label">${s.playerStreak} Day Streak</div>
             <div class="drift-streak-sub">Best: ${s.playerBestStreak} days · Don't break it!</div>
           </div>
         </div>` : '';

    this.showOverlay(`
      <div class="drift-card">
        <div class="drift-logo">DRIFT</div>
        <div class="drift-subtitle">DECODE THE SIGNAL — PASS IT ON</div>

        ${streakHtml}
        ${urgencyHtml}

        <div class="drift-section-label">Clues from Link #${s.chainLength}</div>
        <div class="drift-clues-display">
          <span class="drift-clue-pill">${c0}</span>
          <span class="drift-clue-pill">${c1}</span>
          <span class="drift-clue-pill">${c2}</span>
        </div>

        <div class="drift-section-label">Your Guess — what word do these describe?</div>
        <input id="guess-input" class="drift-input" placeholder="TYPE YOUR GUESS" maxlength="30"
          autocomplete="off" style="text-align:center;margin-bottom:16px;" />

        <div class="drift-section-label">Your 3 Clues for the next player</div>
        <p style="font-size:12px;color:#8b949e;margin:0 0 10px;">
          Pass your guess forward — don't reveal it directly.
        </p>
        <div class="drift-input-row">
          <input id="clue1" class="drift-input" placeholder="Clue 1" maxlength="20" autocomplete="off" />
          <input id="clue2" class="drift-input" placeholder="Clue 2" maxlength="20" autocomplete="off" />
          <input id="clue3" class="drift-input" placeholder="Clue 3" maxlength="20" autocomplete="off" />
        </div>

        <div id="yt-err" class="drift-error"></div>
        <button id="yt-btn" class="drift-btn drift-btn-primary">TRANSMIT SIGNAL</button>
        <p class="drift-rule">Your score is based on how close your guess is to the original word — revealed at midnight.</p>
      </div>`);

    this.el<HTMLButtonElement>('yt-btn').addEventListener('click', () => this.doSubmitTurn());
  }

  private async doSubmitTurn() {
    const guess = this.el<HTMLInputElement>('guess-input').value.trim().toUpperCase();
    const c1 = this.el<HTMLInputElement>('clue1').value.trim().toUpperCase();
    const c2 = this.el<HTMLInputElement>('clue2').value.trim().toUpperCase();
    const c3 = this.el<HTMLInputElement>('clue3').value.trim().toUpperCase();
    const err = this.el('yt-err');

    if (!guess) { err.textContent = 'Enter your guess.'; return; }
    if (!c1 || !c2 || !c3) { err.textContent = 'All 3 clues are required.'; return; }
    if ([c1,c2,c3].some(c => c === guess)) { err.textContent = "Don't use your own guess as a clue!"; return; }
    if (new Set([c1,c2,c3]).size < 3) { err.textContent = 'Clues must be 3 different words.'; return; }

    const btn = this.el<HTMLButtonElement>('yt-btn');
    btn.disabled = true; btn.textContent = 'Transmitting...';

    await this.doSubmit({ guess, clues: [c1, c2, c3] },
      () => { btn.disabled = false; btn.textContent = 'TRANSMIT SIGNAL'; });
  }

  // ── Shared submit ──────────────────────────────────────────────────────────

  private async doSubmit(
    payload: { guess: string; clues: [string, string, string] },
    onError: () => void,
  ) {
    try {
      const res = await fetch('/api/drift/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.type === 'error') {
        const id = document.getElementById('fp-err') ?? document.getElementById('yt-err');
        if (id) id.textContent = data.message;
        onError();
        return;
      }
      this.submitResult = data as SubmitResponse;
      if (this.serverState) {
        this.serverState.alreadyPlayed = true;
        this.serverState.myPosition = data.position;
        this.serverState.chainLength += 1;
        this.serverState.slotsLeft = Math.max(0, this.serverState.slotsLeft - 1);
        this.serverState.playerStreak = data.newStreak;
        this.serverState.playerRank = data.playerRank;
      }
      this.showSuccess();
    } catch {
      const id = document.getElementById('fp-err') ?? document.getElementById('yt-err');
      if (id) id.textContent = 'Network error — please reload.';
      onError();
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────

  private showSuccess() {
    const sr = this.submitResult!;
    const s = this.serverState!;
    const cls = flashClass(sr.semanticScore);
    const rankText = sr.playerRank > 0 ? `#${sr.playerRank}` : '—';
    const streakSub = sr.newStreak >= 7 ? 'Legendary run!' : sr.newStreak >= 3 ? "You're on fire!" : 'Keep it up!';
    const posLabel = sr.position === 1 ? 'Chain Anchor' : `Link #${sr.position}`;
    const slotsLeft = s.slotsLeft;
    const urgencyHtml = slotsLeft > 0 && slotsLeft <= 4
      ? `<div class="drift-urgency">
           <div class="drift-urgency-dot"></div>
           <span class="drift-urgency-text">Only ${slotsLeft} slot${slotsLeft === 1 ? '' : 's'} left — share to fill the chain!</span>
         </div>`
      : '';

    this.showOverlay(`
      <div class="drift-card">
        <div class="drift-logo">DRIFT</div>
        <div class="drift-subtitle">SIGNAL TRANSMITTED · ${posLabel}</div>

        <div class="drift-score-flash ${cls}">
          <div class="drift-score-big" id="score-counter">0</div>
          <div class="drift-score-label">SEMANTIC SCORE</div>
        </div>

        <p style="text-align:center;color:#c9d1d9;font-size:15px;margin:0 0 16px;font-style:italic;">
          "${sr.message}"
        </p>

        <div class="drift-streak">
          <span class="drift-streak-fire">🔥</span>
          <span class="drift-streak-count">${sr.newStreak}</span>
          <div class="drift-streak-info">
            <div class="drift-streak-label">${sr.newStreak} Day Streak</div>
            <div class="drift-streak-sub">${streakSub}</div>
          </div>
        </div>

        <div class="drift-rank-badge">
          <div class="drift-rank-number">${rankText}</div>
          <div class="drift-rank-label">GLOBAL RANK</div>
        </div>

        ${urgencyHtml}

        <button id="success-continue" class="drift-btn drift-btn-primary">SEE YOUR POSITION</button>
      </div>`);

    this.el('success-continue').addEventListener('click', () => this.showWaiting());
    // Animate score counting up after card renders
    requestAnimationFrame(() => this.animateCounter('score-counter', sr.semanticScore, 900));
  }

  // ── Waiting ────────────────────────────────────────────────────────────────

  private showWaiting() {
    const s = this.serverState!;
    const pct = Math.round((s.chainLength / s.maxChain) * 100);
    const myPos = s.myPosition ?? '?';
    const rankText = s.playerRank > 0 ? `#${s.playerRank}` : '—';
    const slotsLeft = s.slotsLeft;

    const urgencyHtml = slotsLeft > 0
      ? `<div class="drift-urgency">
           <div class="drift-urgency-dot"></div>
           <span class="drift-urgency-text">${
             slotsLeft === 1 ? 'Final slot — chain closes soon!'
             : slotsLeft <= 3 ? `Only ${slotsLeft} slots left — signal fading fast`
             : `${slotsLeft} slots open · invite others to play`}</span>
         </div>`
      : `<div class="drift-urgency" style="border-color:#3fb950;">
           <div class="drift-urgency-dot" style="background:#3fb950;animation:none;"></div>
           <span class="drift-urgency-text" style="color:#3fb950;">Chain complete — reveal at midnight UTC!</span>
         </div>`;

    const streakHtml = s.playerStreak > 0
      ? `<div class="drift-streak">
           <span class="drift-streak-fire">🔥</span>
           <span class="drift-streak-count">${s.playerStreak}</span>
           <div class="drift-streak-info">
             <div class="drift-streak-label">${s.playerStreak} Day Streak</div>
             <div class="drift-streak-sub">Best: ${s.playerBestStreak} days</div>
           </div>
         </div>`
      : `<div class="drift-streak" style="border-color:#30363d;">
           <span class="drift-streak-fire" style="opacity:0.4;">🔥</span>
           <span class="drift-streak-count" style="color:#8b949e;font-size:24px;">Start</span>
           <div class="drift-streak-info">
             <div class="drift-streak-label" style="color:#8b949e;">No streak yet</div>
             <div class="drift-streak-sub">Come back tomorrow to build one!</div>
           </div>
         </div>`;

    const topHtml = this.buildLbRows(s.topPlayers ?? [], s.playerRank);

    this.showOverlay(`
      <div class="drift-card">
        <div class="drift-logo">DRIFT</div>
        <div class="drift-subtitle">YOU'VE PLAYED TODAY</div>

        ${streakHtml}
        ${urgencyHtml}

        <div class="drift-section-label">Chain Progress — ${s.chainLength} / ${s.maxChain} links</div>
        <div class="drift-progress"><div class="drift-progress-bar" style="width:${pct}%"></div></div>

        <div class="drift-tabs">
          <button class="drift-tab active" id="tab-stats-btn">Your Stats</button>
          <button class="drift-tab" id="tab-lb-btn">Leaderboard</button>
        </div>

        <div id="panel-stats">
          <div class="drift-stat-row">
            <div class="drift-stat">
              <div class="drift-stat-value">${s.playerScore}</div>
              <div class="drift-stat-label">Total Score</div>
            </div>
            <div class="drift-stat">
              <div class="drift-stat-value">${rankText}</div>
              <div class="drift-stat-label">Global Rank</div>
            </div>
            <div class="drift-stat">
              <div class="drift-stat-value">Link #${myPos}</div>
              <div class="drift-stat-label">Today</div>
            </div>
          </div>
          <p class="drift-rule">${
            s.playerStreak > 1
              ? `${s.playerStreak}-day streak — come back tomorrow to extend it!`
              : 'Play every day to build your streak. Chain reveals at midnight UTC.'
          }</p>
        </div>

        <div id="panel-lb" class="hidden">
          ${s.topPlayers?.length > 0
            ? `<div class="drift-leaderboard">${topHtml}</div>
               <p class="drift-rule" id="lb-footer">Top 3 by all-time score · <a id="lb-load-more" href="#" style="color:#58a6ff;">Load full board</a></p>`
            : `<p class="drift-rule" style="text-align:center;padding:16px 0;">No scores yet — you're an early signal!</p>`
          }
        </div>
      </div>`);

    this.wireWaitingTabs();
  }

  private buildLbRows(players: LeaderboardEntry[], myRank: number): string {
    const medals = ['🥇', '🥈', '🥉'];
    return players.map((p, i) => {
      const isMe = myRank > 0 && (i + 1) === myRank;
      return `<div class="drift-lb-row">
        <span class="drift-lb-rank ${['gold','silver','bronze'][i] ?? ''}">${medals[i] ?? i + 1}</span>
        <span class="drift-lb-user ${isMe ? 'you' : ''}">u/${p.username}${isMe ? ' · you' : ''}</span>
        <span class="drift-lb-streak">${p.streak > 1 ? `🔥${p.streak}` : ''}</span>
        <span class="drift-lb-score">${p.score}pts</span>
      </div>`;
    }).join('');
  }

  private wireWaitingTabs() {
    const statsBtn = this.el('tab-stats-btn');
    const lbBtn = this.el('tab-lb-btn');
    const statsPanel = this.el('panel-stats');
    const lbPanel = this.el('panel-lb');
    if (!statsBtn) return;

    statsBtn.addEventListener('click', () => {
      statsBtn.classList.add('active'); lbBtn.classList.remove('active');
      statsPanel.classList.remove('hidden'); lbPanel.classList.add('hidden');
    });

    lbBtn.addEventListener('click', async () => {
      lbBtn.classList.add('active'); statsBtn.classList.remove('active');
      lbPanel.classList.remove('hidden'); statsPanel.classList.add('hidden');
    });

    // Lazy-load full leaderboard when link clicked
    const s = this.serverState!;
    const loadMore = document.getElementById('lb-load-more');
    loadMore?.addEventListener('click', async (e) => {
      e.preventDefault();
      loadMore.textContent = 'Loading...';
      try {
        const res = await fetch('/api/drift/leaderboard');
        const data = await res.json();
        if (data.players?.length > 0) {
          const medals = ['🥇','🥈','🥉'];
          const rows = data.players.map((p: LeaderboardEntry, i: number) => {
            const isMe = data.playerRank > 0 && (i + 1) === data.playerRank;
            return `<div class="drift-lb-row">
              <span class="drift-lb-rank ${['gold','silver','bronze'][i] ?? ''}">${medals[i] ?? i + 1}</span>
              <span class="drift-lb-user ${isMe ? 'you' : ''}">u/${p.username}${isMe ? ' · you' : ''}</span>
              <span class="drift-lb-streak">${p.streak > 1 ? `🔥${p.streak}` : ''}</span>
              <span class="drift-lb-score">${p.score}pts</span>
            </div>`;
          }).join('');
          lbPanel.innerHTML = `<div class="drift-leaderboard">${rows}</div>
            <p class="drift-rule">Your rank: ${data.playerRank > 0 ? `#${data.playerRank}` : 'unranked'} &nbsp;·&nbsp; ${data.playerScore} pts total</p>`;
        }
      } catch { loadMore.textContent = 'Failed to load'; }
    });
  }

  // ── Reveal (Phaser canvas) ─────────────────────────────────────────────────

  private showReveal(chain: ChainLink[], secretWord: string) {
    this.hideOverlay();
    this.children.removeAll(true);
    const { width, height } = this.scale;
    const midX = width / 2;

    // Subtle floating gold particles in background
    this.spawnAmbientParticles();

    // Adaptive sizing based on actual canvas width
    const nodeR = width < 400 ? 14 : 18;
    const headerH = width < 400 ? 88 : 108;
    const textSm = width < 400 ? '9px' : '10px';
    const textMd = width < 400 ? '10px' : '11px';
    const textLg = width < 400 ? '11px' : '13px';
    const sideGap = nodeR + 10;

    // Header
    this.add.text(midX, 22, 'DRIFT — CHAIN REVEAL', {
      fontSize: width < 400 ? '10px' : '12px',
      fontFamily: 'Segoe UI, sans-serif', color: '#8b949e', letterSpacing: 2,
    }).setOrigin(0.5);

    this.add.text(midX, 44, secretWord, {
      fontSize: width < 400 ? '20px' : '26px',
      fontFamily: 'Segoe UI, sans-serif', color: '#ffd700', fontStyle: 'bold', letterSpacing: 5,
    }).setOrigin(0.5);

    this.add.text(midX, headerH - 16, 'THE ORIGINAL SIGNAL WORD', {
      fontSize: textSm, fontFamily: 'Segoe UI, sans-serif', color: '#30363d', letterSpacing: 2,
    }).setOrigin(0.5);

    // Each row gets at least 44px so we can scroll if needed
    const minStepY = 52;
    const fittedStepY = chain.length > 0 ? (height - headerH - 16) / chain.length : 60;
    const stepY = Math.max(fittedStepY, minStepY);
    const totalH = headerH + chain.length * stepY;

    // Gentle shake when the last link settles
    this.time.delayedCall(chain.length * 200 + 500, () => {
      this.cameras.main.shake(250, 0.003);
    });

    // Enable camera scroll if chain overflows canvas height
    if (totalH > height) {
      this.cameras.main.setBounds(0, 0, width, totalH);
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        if (p.isDown) this.cameras.main.scrollY -= p.velocity.y * 0.5;
      });
    }

    chain.forEach((link, i) => {
      const y = headerH + stepY * i + stepY / 2;
      const col = scoreToColor(link.semanticScore);
      const hexCol = scoreToHex(link.semanticScore);
      const delay = i * 200;

      // Connecting line from previous node
      if (i > 0) {
        const line = this.add.rectangle(midX, y - stepY / 2, 2, stepY * 0.38, C.border, 0).setOrigin(0.5);
        this.tweens.add({ targets: line, alpha: 0.7, duration: 180, delay: delay - 60 });
      }

      // Node fill + ring
      const nodeFill = this.add.circle(midX, y, nodeR, col, 0);
      this.tweens.add({ targets: nodeFill, alpha: 0.18, duration: 180, delay });

      const ring = this.add.arc(midX, y, nodeR, 270, 270 + link.semanticScore * 3.6, false);
      ring.setStrokeStyle(2, col, 0); ring.setFillStyle();
      this.tweens.add({ targets: ring, alpha: 0.9, duration: 250, delay: delay + 70 });

      // Ping burst when node appears
      this.spawnPingRing(midX, y, col, delay + 40);

      // Position number
      const pos = this.add.text(midX, y, String(link.position), {
        fontSize: width < 400 ? '10px' : '12px',
        fontFamily: 'Segoe UI, sans-serif', color: '#e6edf3', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5).setAlpha(0);
      this.tweens.add({ targets: pos, alpha: 1, duration: 180, delay: delay + 90 });

      // Left side — username + guess (right-aligned to node edge)
      const leftW = midX - sideGap - 4;
      const uText = this.add.text(midX - sideGap, y - 7, `u/${link.username}`, {
        fontSize: textMd, fontFamily: 'Segoe UI, sans-serif', color: '#8b949e',
        wordWrap: { width: leftW },
      }).setOrigin(1, 0.5).setAlpha(0);
      this.tweens.add({ targets: uText, alpha: 1, duration: 180, delay: delay + 110 });

      const gText = this.add.text(midX - sideGap, y + 8, link.guess, {
        fontSize: textLg, fontFamily: 'Segoe UI, sans-serif', color: hexCol, fontStyle: 'bold',
        wordWrap: { width: leftW },
      }).setOrigin(1, 0.5).setAlpha(0);
      this.tweens.add({ targets: gText, alpha: 1, duration: 180, delay: delay + 110 });

      // Right side — clues + score reason (left-aligned from node edge)
      const rightW = midX - sideGap - 4;
      const clueStr = link.clues.join(' · ');
      const cText = this.add.text(midX + sideGap, y - 7, clueStr, {
        fontSize: textSm, fontFamily: 'Segoe UI, sans-serif', color: '#58a6ff',
        wordWrap: { width: rightW },
      }).setOrigin(0, 0.5).setAlpha(0);
      this.tweens.add({ targets: cText, alpha: 0.85, duration: 180, delay: delay + 120 });

      const rText = this.add.text(midX + sideGap, y + 8, `${link.semanticScore}% · ${link.scoreReason}`, {
        fontSize: textSm, fontFamily: 'Segoe UI, sans-serif', color: hexCol,
        wordWrap: { width: rightW },
      }).setOrigin(0, 0.5).setAlpha(0);
      this.tweens.add({ targets: rText, alpha: 0.7, duration: 180, delay: delay + 140 });
    });
  }

  // ── Animated counter ──────────────────────────────────────────────────────

  private animateCounter(elementId: string, target: number, durationMs = 900) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(eased * target));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ── Phaser: ambient background particles ──────────────────────────────────

  private spawnAmbientParticles() {
    const { width, height } = this.scale;
    const count = Math.min(16, Math.floor(width / 24));
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, width);
      const startY = Phaser.Math.Between(20, height);
      const r = Phaser.Math.Between(1, 2);
      const dot = this.add.circle(x, startY, r, C.gold, 0);
      dot.setDepth(-1);
      const duration = Phaser.Math.Between(5000, 11000);
      const delay = Phaser.Math.Between(0, 5000);
      this.tweens.add({
        targets: dot,
        y: startY - Phaser.Math.Between(60, 140),
        alpha: { from: 0, to: 0.07 },
        duration,
        delay,
        ease: 'Sine.easeInOut',
        yoyo: false,
        repeat: -1,
        onRepeat: () => {
          dot.x = Phaser.Math.Between(0, width);
          dot.y = height + 8;
        },
      });
    }
  }

  // ── Phaser: ping ring burst on node ───────────────────────────────────────

  private spawnPingRing(x: number, y: number, color: number, delay: number) {
    const ring = this.add.arc(x, y, 16, 0, 360, false);
    ring.setStrokeStyle(1.5, color, 0); ring.setFillStyle();
    this.tweens.add({
      targets: ring,
      scaleX: 3.5, scaleY: 3.5,
      alpha: { from: 0.8, to: 0 },
      duration: 700,
      delay,
      ease: 'Power2',
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private setError(errId: string, msg: string) {
    const el = document.getElementById(errId);
    if (el) el.textContent = msg;
  }
}
