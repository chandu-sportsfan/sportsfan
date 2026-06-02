// api/fifa-player-stats/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FifaPlayerStatsUpdateSchema } from "@/lib/validations/fifaPlayerStats";

function getIdFromUrl(req: NextRequest): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return parts[parts.length - 1];
}

// GET - Fetch single player stats by ID
export async function GET(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Player stats ID is required" }, { status: 400 });
    }
    
    const docRef = db.collection("fifaPlayerStats").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Player stats not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      stats: { id: doc.id, ...doc.data() },
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching player stats:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// PUT - Update player stats
export async function PUT(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Player stats ID is required" }, { status: 400 });
    }
    
    const body = await req.json();
    
    const docRef = db.collection("fifaPlayerStats").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Player stats not found" },
        { status: 404 }
      );
    }
    
    const validation = FifaPlayerStatsUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.errors.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    
    const updateData = {
      ...validation.data,
      updatedAt: Date.now(),
    };
    
    await docRef.update(updateData);
    
    const updated = await docRef.get();
    
    return NextResponse.json({
      success: true,
      stats: { id: updated.id, ...updated.data() },
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error updating player stats:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE - Delete player stats
export async function DELETE(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Player stats ID is required" }, { status: 400 });
    }
    
    const docRef = db.collection("fifaPlayerStats").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Player stats not found" },
        { status: 404 }
      );
    }
    
    await docRef.delete();
    
    return NextResponse.json({
      success: true,
      message: "Player stats deleted successfully",
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error deleting player stats:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}