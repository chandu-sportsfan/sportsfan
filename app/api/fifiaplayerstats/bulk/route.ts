// api/fifa-player-stats/bulk/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FifaPlayerStatsCreateSchema } from "@/lib/validations/fifaPlayerStats";
import { validateFifaPlayerStatsRecord, runFifaPlayerStatsDQChecks } from "@/lib/ingestion/fifaPlayerStatsRules";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stats, sourceFile, tournament } = body;
    
    if (!stats || !Array.isArray(stats)) {
      return NextResponse.json(
        { success: false, error: "stats array is required" },
        { status: 400 }
      );
    }
    
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    const errors: Array<{ row: number; errors: Array<{ field: string; message: string }> }> = [];
    const successfulStats: Array<Record<string, unknown>> = [];
    
    const logRef = db.collection("fifaPlayerStatsProcessingLogs").doc();
    await logRef.set({
      sourceFile: sourceFile || "bulk_upload",
      tournament: tournament || "FIFA World Cup",
      recordsProcessed: 0,
      recordsFailed: 0,
      status: "processing",
      startedAt: startTime,
      completedAt: null,
      errors: [],
    });
    
    for (let i = 0; i < stats.length; i++) {
      const record = stats[i];
      const rowNum = i + 1;
      
      const ruleValidation = validateFifaPlayerStatsRecord(record);
      if (!ruleValidation.valid) {
        failed++;
        errors.push({
          row: rowNum,
          errors: ruleValidation.errors.map((e) => ({ field: e.name, message: e.errorMessage })),
        });
        continue;
      }
      
      const schemaValidation = FifaPlayerStatsCreateSchema.safeParse(record);
      if (!schemaValidation.success) {
        failed++;
        errors.push({
          row: rowNum,
          errors: schemaValidation.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
        });
        continue;
      }
      
      const statsData = schemaValidation.data;
      
      // Check for duplicate player-team combination
      const existing = await db.collection("fifaPlayerStats")
        .where("player", "==", statsData.player)
        .where("team", "==", statsData.team)
        .limit(1)
        .get();
      
      if (!existing.empty) {
        failed++;
        errors.push({
          row: rowNum,
          errors: [{ field: "player", message: `Duplicate player-team: ${statsData.player} (${statsData.team})` }],
        });
        continue;
      }
      
      const newStats = {
        ...statsData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      await db.collection("fifaPlayerStats").add(newStats);
      successfulStats.push(statsData);
      processed++;
    }
    
    const dqResults = runFifaPlayerStatsDQChecks(successfulStats);
    if (!dqResults.passed) {
      console.warn("DQ Check Warnings:", dqResults.results.filter(r => !r.passed));
    }
    
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
        total: stats.length,
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