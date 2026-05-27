// lib/validations/womensCricket.ts

import { z } from "zod";

// Women's Inning Stats Schema (simplified for this dataset)
export const WomensInningStatsSchema = z.object({
  runs: z.number().int().min(0).max(300),
  wickets: z.number().int().min(0).max(10),
  powerplay: z.number().int().min(0).max(100),
  deathRuns: z.number().int().min(0).max(100),
  fours: z.number().int().min(0).max(40),
  sixes: z.number().int().min(0).max(20),
  dotballs: z.number().int().min(0).max(120),
}).refine(
  (data) => {
    // Death runs should be less than total runs (basic sanity)
    return data.deathRuns <= data.runs;
  },
  { message: "Death runs cannot exceed total runs" }
);

// Main Women's Match Schema
export const WomensMatchSchema = z.object({
  matchId: z.number().int().positive(),
  date: z.coerce.date(),
  team1: z.string().min(1),
  team2: z.string().min(1),
  venue: z.string().min(1),
  winner: z.string().nullable(),
  tossWinner: z.string().min(1),
  tossDecision: z.enum(["bat", "field"]),
  playerOfMatch: z.string().nullable(),
  innings1: WomensInningStatsSchema,
  innings2: WomensInningStatsSchema,
  isNoResult: z.boolean().default(false),
});

// Create Schema (without id and timestamps)
export const WomensMatchCreateSchema = WomensMatchSchema.omit({}).extend({
  isNoResult: z.boolean().default(false),
});

// Update Schema (partial)
export const WomensMatchUpdateSchema = WomensMatchCreateSchema.partial();

// Validation Result Type
export type WomensValidationResult<T> = {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string }>;
};

// Validation Functions
export function validateWomensMatch(data: unknown): WomensValidationResult<z.infer<typeof WomensMatchSchema>> {
  const result = WomensMatchSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    })),
  };
}

export function validateWomensMatchCreate(data: unknown): WomensValidationResult<z.infer<typeof WomensMatchCreateSchema>> {
  const result = WomensMatchCreateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    })),
  };
}