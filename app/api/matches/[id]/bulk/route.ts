// api/matches/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { MatchCreateSchema } from "@/lib/validations/cricket";
import { validateRecord, runDQChecks } from "@/lib/ingestion/rules";

// POST - Bulk import matches
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matches, sourceFile, tournament } = body;
    
    if (!matches || !Array.isArray(matches)) {
      return NextResponse.json(
        { success: false, error: "matches array is required" },
        { status: 400 }
      );
    }
    
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    const errors: Array<{ row: number; errors: Array<{ field: string; message: string }> }> = [];
    const successfulMatches: Array<Record<string, unknown>> = [];
    
    // Track processing log
    const logRef = db.collection("processingLogs").doc();
    await logRef.set({
      sourceFile: sourceFile || "bulk_upload",
      tournament: tournament || "IPL",
      recordsProcessed: 0,
      recordsFailed: 0,
      status: "processing",
      startedAt: startTime,
      completedAt: null,
      errors: [],
    });
    
    // Process each match
    for (let i = 0; i < matches.length; i++) {
      const record = matches[i];
      const rowNum = i + 1;
      
      // Validate record
      const ruleValidation = validateRecord(record);
      if (!ruleValidation.valid) {
        failed++;
        errors.push({
          row: rowNum,
          errors: ruleValidation.errors.map((e) => ({ field: e.name, message: e.errorMessage })),
        });
        continue;
      }
      
      // Validate schema
      const schemaValidation = MatchCreateSchema.safeParse(record);
      if (!schemaValidation.success) {
        failed++;
        errors.push({
          row: rowNum,
          errors: schemaValidation.error.issues.map((e) => ({ field: e.path.join("."), message: e.message })),
        });
        continue;
      }
      
      const matchData = schemaValidation.data;
      
      // Check for duplicate
      const existing = await db.collection("matches")
        .where("matchId", "==", matchData.matchId)
        .limit(1)
        .get();
      
      if (!existing.empty) {
        failed++;
        errors.push({
          row: rowNum,
          errors: [{ field: "matchId", message: `Duplicate match_id: ${matchData.matchId}` }],
        });
        continue;
      }
      
      // Create match
      const newMatch = {
        ...matchData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await db.collection("matches").add(newMatch);
      successfulMatches.push(matchData);
      processed++;
    }
    
    // Run DQ checks on successfully imported matches
    const dqResults = runDQChecks(successfulMatches);
    if (!dqResults.passed) {
      console.warn("DQ Check Warnings:", dqResults.results.filter(r => !r.passed));
    }
    
    // Update processing log
    await logRef.update({
      recordsProcessed: processed,
      recordsFailed: failed,
      status: failed === 0 ? "success" : "partial",
      completedAt: Date.now(),
      errors: errors,
      dqWarnings: dqResults.results.filter(r => !r.passed),
    });
    
    return NextResponse.json({
      success: true,
      summary: {
        total: matches.length,
        processed,
        failed,
        duration: Date.now() - startTime,
      },
      errors: errors.length > 0 ? errors : undefined,
      dqWarnings: dqResults.results.filter(r => !r.passed),
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error in bulk import:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}