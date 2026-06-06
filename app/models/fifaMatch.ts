// models/fifaMatch.ts
// Firestore collection: fifaMatches
// Document ID = match_id (string)

export type FifaTournament = "mens_fifa_wc_2022" | "womens_fifa_wc_2023" | "mens_fifa_wc_2026";
export type Gender = "male" | "female";
export type FifaFormat = "international";
export type FifaMatchResult = "normal" | "extra_time" | "penalties" | "no_result" | "abandoned";
export type FifaStage =
  | "Group Stage"
  | "Round of 16"
  | "Quarter-Final"
  | "Semi-Final"
  | "Third Place"
  | "Final";

export interface FifaMatch {
  match_id: string;                    // document ID — also stored as field
  date: string;                        // YYYY-MM-DD
  season: number;                      // e.g. 2022

  // stage
  stage: FifaStage;
  group: string | null;                // "Group A"–"Group H", null for knockouts
  match_day: number | null;            // 1/2/3 for group stage, null for knockouts

  // teams
  team1: string;
  team2: string;
  team1_code: string;                  // FIFA 3-letter e.g. "ARG"
  team2_code: string;

  // venue
  venue: string;
  city: string | null;

  // result
  winner: string | null;               // null on no_result / abandoned
  winner_code: string | null;
  goals_team1: number;                 // full time incl. ET, excl. pens
  goals_team2: number;
  goals_team1_pens: number | null;     // null if no shootout
  goals_team2_pens: number | null;
  match_result: FifaMatchResult;

  // key players
  player_of_match: string | null;
  player_of_match_id: string | null;   // fill after master player registry

  // officials
  referee: string | null;

  // classification
  tournament: FifaTournament;
  gender: Gender;
  format: FifaFormat;

  // audit
  created_at: FirebaseFirestore.Timestamp | null;
  updated_at: FirebaseFirestore.Timestamp | null;
  source_file: string | null;
}

export type FifaMatchCreate = Omit<FifaMatch, "created_at" | "updated_at">;
export type FifaMatchUpdate = Partial<Omit<FifaMatch, "match_id" | "created_at">>;