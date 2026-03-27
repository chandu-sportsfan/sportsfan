// app/api/team360/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

//  GET single post 
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await db.collection("players360Posts").doc(params.id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({ post: { id: doc.id, ...doc.data() } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

//  PUT update post 
// PUT update post
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const docRef = db.collection("players360Posts").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Only update fields that are actually sent
    const allowedFields = [
      "playerName", "title", "category", "image", "logo", "catlogo",
      "hasVideo"
    ];

    // Numeric fields (convert to numbers)
    const numericFields = ["likes", "comments", "live", "shares"];

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    // Handle regular fields
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    });

    // Handle numeric fields with conversion
    numericFields.forEach(field => {
      if (body[field] !== undefined) {
        updates[field] = Number(body[field]) || 0;
      }
    });

    // Handle arrays with default values
    if (body.category !== undefined) {
      updates.category = body.category ?? [];
    }

    if (body.catlogo !== undefined) {
      updates.catlogo = body.catlogo ?? [];
    }

    await docRef.update(updates);

    const updated = await docRef.get();

    return NextResponse.json({
      success: true,
      post: { id: updated.id, ...updated.data() },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

//  DELETE post 
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const docRef = db.collection("players360Posts").doc(params.id);
    const doc    = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: `Post ${params.id} deleted successfully`,
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}