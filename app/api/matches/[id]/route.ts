// api/matches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { MatchUpdateSchema } from "@/lib/validations/cricket";

// GET - Get single match by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
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

// PUT - Update match
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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

// DELETE - Delete match
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
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