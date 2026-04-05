import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── GET: Single Insights Doc ─────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await db.collection("clubInsights").doc(params.id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: "Insights doc not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, insightsDoc: { id: doc.id, ...doc.data() } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Fetch failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// ─── PUT: Update Insights & Strengths ────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { insights, strengths } = body;

    const existing = await db.collection("clubInsights").doc(params.id).get();
    if (!existing.exists) {
      return NextResponse.json(
        { success: false, message: "Insights doc not found" },
        { status: 404 }
      );
    }

    const existingData = existing.data() as Record<string, unknown>;

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };

    if (insights !== undefined) {
      updateData.insights = insights.map(
        (item: { title: string; description: string }) => ({
          title: item.title || "",
          description: item.description || "",
        })
      );
    }

    if (strengths !== undefined) {
      updateData.strengths = strengths.filter(
        (s: unknown) => typeof s === "string" && (s as string).trim().length > 0
      );
    }

    await db.collection("clubInsights").doc(params.id).update(updateData);

    return NextResponse.json({
      success: true,
      insightsDoc: { id: params.id, ...existingData, ...updateData },
    });
  } catch (error) {
    console.error("Update insights error:", error);
    return NextResponse.json(
      { success: false, message: "Update failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove Insights Doc ─────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await db.collection("clubInsights").doc(params.id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: "Insights doc not found" },
        { status: 404 }
      );
    }
    await db.collection("clubInsights").doc(params.id).delete();
    return NextResponse.json({ success: true, message: "Insights doc deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Delete failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}