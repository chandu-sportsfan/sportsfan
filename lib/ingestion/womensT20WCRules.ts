// lib/ingestion/womensT20WCRules.ts

export interface WomensInjectionRule {
  name: string;
  validate: (record: WomensMatchRecord) => boolean ;
  errorMessage: string;
  severity: "error" | "warning";
}

export interface WomensDQCheck {
  name: string;
  check: (collection: WomensMatchRecord[]) => WomensDQResult;
}

export interface WomensDQResult {
  passed: boolean;
  message: string;
  details?: unknown;
}

export type WomensMatchRecord = {
  [key: string]: unknown;
  matchId?: number;
  date?: string;
  team1?: string;
  team2?: string;
  venue?: string;
  winner?: string | null;
  tossWinner?: string;
  tossDecision?: string;
  playerOfMatch?: string | null;
  innings1?: Record<string, unknown>;
  innings2?: Record<string, unknown>;
  isNoResult?: boolean;
};

const getNumber = (value: unknown): number =>
  typeof value === "number" ? value : Number(value) || 0;

const getString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const getBoolean = (value: unknown): boolean =>
  typeof value === "boolean" ? value : value === "true" || value === "1";

const toWomensInning = (input: unknown): Record<string, number> => {
  if (typeof input !== "object" || input === null) return {} as Record<string, number>;
  const inning = input as Record<string, unknown>;
  return {
    runs: getNumber(inning.runs),
    wickets: getNumber(inning.wickets),
    powerplay: getNumber(inning.powerplay),
    deathRuns: getNumber(inning.deathRuns),
    fours: getNumber(inning.fours),
    sixes: getNumber(inning.sixes),
    dotballs: getNumber(inning.dotballs),
  };
};

// Data Quality Rules for Women's World Cup
export const womensDataQualityRules: WomensDQCheck[] = [
  {
    name: "No duplicate match_ids",
    check: (matches: WomensMatchRecord[]) => {
      const ids = matches.map((m) => getNumber(m.matchId));
      const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
      return {
        passed: duplicates.length === 0,
        message: duplicates.length > 0 ? `Duplicate match_ids: ${[...new Set(duplicates)]}` : "No duplicates found",
        details: { duplicates: [...new Set(duplicates)] }
      };
    }
  },
  {
    name: "Valid winner logic",
    check: (matches: WomensMatchRecord[]) => {
      const invalid = matches.filter((m) => {
        const isNoResult = getBoolean(m.isNoResult);
        const winner = getString(m.winner);
        
        if (isNoResult) {
          return winner !== "" && winner !== "No Result";
        }
        if (winner && winner !== "No Result") {
          // Winner must be either team1 or team2
          const team1 = getString(m.team1);
          const team2 = getString(m.team2);
          return winner !== team1 && winner !== team2;
        }
        return false;
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length > 0 ? `${invalid.length} matches have invalid winner logic` : "All winner logic valid",
        details: { invalidMatchIds: invalid.map(m => m.matchId) }
      };
    }
  },
  {
    name: "Valid wickets count",
    check: (matches: WomensMatchRecord[]) => {
      const invalid = matches.filter((m) => {
        const innings1 = toWomensInning(m.innings1);
        const innings2 = toWomensInning(m.innings2);
        return innings1.wickets > 10 || innings2.wickets > 10;
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length > 0 ? `${invalid.length} matches have invalid wicket counts` : "All wicket counts valid",
        details: { invalidMatchIds: invalid.map(m => m.matchId) }
      };
    }
  },
  {
    name: "Valid powerplay runs",
    check: (matches: WomensMatchRecord[]) => {
      const invalid = matches.filter((m) => {
        const innings1 = toWomensInning(m.innings1);
        const innings2 = toWomensInning(m.innings2);
        return innings1.powerplay > innings1.runs || innings2.powerplay > innings2.runs;
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length > 0 ? `${invalid.length} matches have powerplay > total runs` : "All powerplay runs valid",
        details: { invalidMatchIds: invalid.map(m => m.matchId) }
      };
    }
  },
  {
    name: "Valid death runs",
    check: (matches: WomensMatchRecord[]) => {
      const invalid = matches.filter((m) => {
        const innings1 = toWomensInning(m.innings1);
        const innings2 = toWomensInning(m.innings2);
        return innings1.deathRuns > innings1.runs || innings2.deathRuns > innings2.runs;
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length > 0 ? `${invalid.length} matches have death runs > total runs` : "All death runs valid",
        details: { invalidMatchIds: invalid.map(m => m.matchId) }
      };
    }
  },
  {
    name: "Date range validity",
    check: (matches: WomensMatchRecord[]) => {
      const minDate = new Date("2013-01-01");
      const maxDate = new Date("2025-12-31");
      const invalid = matches.filter((m) => {
        const dateValue = getString(m.date);
        const date = new Date(dateValue);
        return dateValue === "" || date < minDate || date > maxDate;
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length > 0 ? `${invalid.length} matches have invalid dates` : "All dates valid",
        details: { invalidDates: invalid.map(m => ({ matchId: m.matchId, date: m.date })) }
      };
    }
  },
  {
    name: "No Result handling",
    check: (matches: WomensMatchRecord[]) => {
      const invalid = matches.filter((m) => {
        const isNoResult = getBoolean(m.isNoResult);
        const winner = getString(m.winner);
        const playerOfMatch = getString(m.playerOfMatch);
        
        if (isNoResult) {
          // No Result matches should have no winner and no player of match
          return winner !== "" && winner !== "No Result" || (playerOfMatch !== "" && playerOfMatch !== "No Award");
        }
        return false;
      });
      return {
        passed: invalid.length === 0,
        message: invalid.length > 0 ? `${invalid.length} No Result matches have invalid data` : "All No Result matches valid",
        details: { invalidMatchIds: invalid.map(m => m.matchId) }
      };
    }
  }
];

// Injection Rules for Women's World Cup
export const womensInjectionRules: WomensInjectionRule[] = [
  {
    name: "Required fields present",
    validate: (record: WomensMatchRecord) => {
      const required = ["matchId", "date", "team1", "team2", "venue", "tossWinner", "tossDecision"];
      return required.every((field) => record[field] !== undefined && record[field] !== null);
    },
    errorMessage: "Missing required field",
    severity: "error"
  },
  {
    name: "Team names not empty",
    validate: (record: WomensMatchRecord) => {
      const team1 = getString(record.team1);
      const team2 = getString(record.team2);
      return team1.trim().length > 0 && team2.trim().length > 0;
    },
    errorMessage: "Team names cannot be empty",
    severity: "error"
  },
  {
    name: "Valid toss decision",
    validate: (record: WomensMatchRecord) => {
      return ["bat", "field"].includes(getString(record.tossDecision));
    },
    errorMessage: "Toss decision must be 'bat' or 'field'",
    severity: "error"
  },
  {
  name: "Innings stats present",
  validate: (record: WomensMatchRecord): boolean => {
    const hasInnings1 = Boolean(
      record.innings1 && typeof record.innings1 === "object"
    );

    const hasInnings2 = Boolean(
      record.innings2 && typeof record.innings2 === "object"
    );

    return hasInnings1 && hasInnings2;
  },
  errorMessage: "Both innings stats are required",
  severity: "error"
},
  {
    name: "Valid match result",
    validate: (record: WomensMatchRecord): boolean => {
      const isNoResult = getBoolean(record.isNoResult);
      const winner = getString(record.winner);
      
      // If it's a no result match, always valid
      if (isNoResult) {
        return true;
      }
      
      // If there's no winner, it's invalid
      if (!winner) {
        return false;
      }
      
      const innings1 = toWomensInning(record.innings1);
      const innings2 = toWomensInning(record.innings2);
      const team1 = getString(record.team1);
      const team2 = getString(record.team2);
      
      // Check if winner matches runs logic
      if (winner === team1) {
        return innings1.runs > innings2.runs;
      } else if (winner === team2) {
        return innings2.runs > innings1.runs;
      }
      
      // Winner doesn't match either team
      return false;
    },
    errorMessage: "Winner doesn't match runs logic",
    severity: "warning"
  }
];

// Run all DQ checks
export function runWomensDQChecks(matches: WomensMatchRecord[]): { passed: boolean; results: WomensDQResult[] } {
  const results = womensDataQualityRules.map((rule) => rule.check(matches));
  const passed = results.every(r => r.passed);
  return { passed, results };
}

// Validate record against all injection rules
export function validateWomensRecord(record: WomensMatchRecord): { valid: boolean; errors: WomensInjectionRule[] } {
  const failedRules = womensInjectionRules.filter((rule) => !rule.validate(record));
  return { valid: failedRules.length === 0, errors: failedRules };
}