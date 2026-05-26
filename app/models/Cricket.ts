// lib/models/cricket.ts

export interface InningStats {
  runs: number;
  wickets: number;
  powerplay: number;
  middle: number;
  death: number;
  dots: number;
  fours: number;
  sixes: number;
  extras: number;
  highestOver?: number;
}

export interface Match {
  id: string;
  matchId: number;
  date: Date;
  season: string;
  team1: string;
  team2: string;
  venue: string;
  city: string;
  winner: string | null;
  tossWinner: string;
  tossDecision: "bat" | "field";
  playerOfMatch: string | null;
  inning1: InningStats;
  inning2: InningStats;
  inning3?: InningStats;  // For super overs
  inning4?: InningStats;
  inning5?: InningStats;
  inning6?: InningStats;
  target: number;
  chaseSuccess: boolean;
  isNoResult: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  homeVenue: string;
  city: string;
  seasons: string[];
  totalMatches: number;
  wins: number;
  losses: number;
  noResults: number;
  createdAt: number;
  updatedAt: number;
}

export interface Season {
  id: string;
  year: string;
  tournament: "IPL" | "Mushtaq Ali" | "T20I";
  gender: "Men" | "Women";
  startDate: Date;
  endDate: Date;
  winner: string | null;
  runnerUp: string | null;
  totalMatches: number;
  playerOfTournament: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  capacity: number;
  matchesHosted: number;
  firstMatchDate: Date | null;
  lastMatchDate: Date | null;
  createdAt: number;
  updatedAt: number;
}

export interface PlayerStats {
  name: string;
  team: string;
  matches: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  wickets: number;
  ballsBowled: number;
  runsConceded: number;
  catches: number;
  stumpings?: number;
  playerOfMatchCount: number;
}

export interface ProcessingLog {
  id: string;
  sourceFile: string;
  tournament: string;
  recordsProcessed: number;
  recordsFailed: number;
  status: "pending" | "processing" | "success" | "failed" | "partial";
  errors: ProcessingError[];
  startedAt: number;
  completedAt: number | null;
}

export interface ProcessingError {
  row: number;
  field: string;
  error: string;
  value: unknown;
}