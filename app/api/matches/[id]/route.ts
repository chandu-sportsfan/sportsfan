// api/matches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { MatchUpdateSchema } from "@/lib/validations/cricket";

//  Helper: extract ID from URL 
function getIdFromUrl(req: NextRequest): string {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  return parts[parts.length - 1];
}

// GET - Fetch single article by ID
export async function GET(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Matches ID is required" }, { status: 400 });
    }
    
    const docRef = db.collection("matches").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Match not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      match: { id: doc.id, ...doc.data() },
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching match:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// GET - Fetch single article by ID
export async function PUT(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Matches ID is required" }, { status: 400 });
    }
    const body = await req.json();
    
    const docRef = db.collection("matches").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Match not found" },
        { status: 404 }
      );
    }
    
    // Validate update data (partial)
    const validation = MatchUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.issues.map((issue) => ({
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
      match: { id: updated.id, ...updated.data() },
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error updating match:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// GET - Fetch single article by ID
export async function DELETE(req: NextRequest) {
  try {
    const id = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "Matches ID is required" }, { status: 400 });
    }
    
    const docRef = db.collection("matches").doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Match not found" },
        { status: 404 }
      );
    }
    
    await docRef.delete();
    
    return NextResponse.json({
      success: true,
      message: "Match deleted successfully",
    });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error deleting match:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}