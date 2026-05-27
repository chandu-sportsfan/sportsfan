// lib/models/womensWorldCup.ts

export interface WomensInningStats {
  runs: number;
  wickets: number;
  powerplay: number;
  deathRuns: number;
  fours: number;
  sixes: number;
  dotballs: number;
}

export interface WomensMatch {
  id: string;
  matchId: number;
  date: Date;
  team1: string;
  team2: string;
  venue: string;
  winner: string | null;
  tossWinner: string;
  tossDecision: "bat" | "field";
  playerOfMatch: string | null;
  innings1: WomensInningStats;
  innings2: WomensInningStats;
  isNoResult: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WomensProcessingLog {
  id: string;
  sourceFile: string;
  tournament: string;
  recordsProcessed: number;
  recordsFailed: number;
  status: "pending" | "processing" | "success" | "failed" | "partial";
  errors: WomensProcessingError[];
  startedAt: number;
  completedAt: number | null;
}

export interface WomensProcessingError {
  row: number;
  field: string;
  error: string;
  value: unknown;
}