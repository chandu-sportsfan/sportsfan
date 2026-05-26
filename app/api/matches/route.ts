import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { MatchCreateSchema } from "@/lib/validations/cricket";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get("matchId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(Number(limitParam), 500)) : 100;

    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection("matches");

    if (matchId) {
      const numericMatchId = Number(matchId);
      if (!Number.isNaN(numericMatchId)) {
        query = query.where("matchId", "==", numericMatchId);
      }
    }

    const snapshot = await query.orderBy("matchId", "asc").limit(limit).get();
    const matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ success: true, matches });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching match list:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = MatchCreateSchema.safeParse(body);

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

    const payload = {
      ...validation.data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("matches").add(payload);
    return NextResponse.json({
      success: true,
      id: docRef.id,
      match: { id: docRef.id, ...payload },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error creating match:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
