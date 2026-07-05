export type ChainLink = {
  position: number;
  username: string;
  guess: string;
  clues: [string, string, string];
  semanticScore: number;
  scoreReason: string;
};

export type DriftStateResponse = {
  type: 'state';
  dateKey: string;
  chainLength: number;
  maxChain: number;
  slotsLeft: number;
  isFirstPlayer: boolean;
  isMyTurn: boolean;
  alreadyPlayed: boolean;
  isRevealed: boolean;
  isFull: boolean;
  secretWord?: string;
  prevClues?: [string, string, string];
  myPosition?: number;
  chain?: ChainLink[];
  // Player stats
  playerStreak: number;
  playerBestStreak: number;
  playerScore: number;
  playerRank: number;        // 1-based global rank, 0 = unranked
  topPlayers: LeaderboardEntry[];  // top 3 for waiting screen
};

export type SubmitPayload = {
  guess: string;
  clues: [string, string, string];
};

export type SubmitResponse = {
  type: 'submit';
  success: boolean;
  position: number;
  semanticScore: number;
  pointsEarned: number;
  message: string;
  newStreak: number;
  playerRank: number;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
  streak: number;
};

export type LeaderboardResponse = {
  type: 'leaderboard';
  players: LeaderboardEntry[];
  playerRank: number;
  playerScore: number;
};

export type ErrorResponse = {
  type: 'error';
  message: string;
};
