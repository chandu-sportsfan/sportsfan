// app/api/communities/route.ts
// Powers the "Communities" tab

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

const CURRENT_USER_ID = "u3";


// GET /api/communities
//   ?limit=20
//   ?lastDocId=<id>
//   ?lastDocMemberCount=<n>

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId = searchParams.get("lastDocId");
    const lastDocMemberCount = searchParams.get("lastDocMemberCount");

    let query = db
      .collection("communities")
      .orderBy("memberCount", "desc")
      .limit(limit);

    if (lastDocId && lastDocMemberCount) {
      const lastRef = db.collection("communities").doc(lastDocId);
      const lastDoc = await lastRef.get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const communities = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      communities,
      pagination: {
        limit,
        hasMore: communities.length === limit,
        nextCursor:
          communities.length === limit
            ? {
                lastDocId: lastDoc?.id,
                lastDocMemberCount: lastDoc?.data()?.memberCount,
              }
            : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/communities error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


// POST /api/communities
// Body: { name: string, description?: string, avatarUrl?: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, avatarUrl } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const now = Date.now();
    const newCommunity = {
      name: name.trim(),
      description: description?.trim() ?? "",
      avatarUrl: avatarUrl ?? "",
      memberCount: 1,
      memberIds: [CURRENT_USER_ID],
      groupCount: 0,
      isVerified: false,
      createdBy: CURRENT_USER_ID,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("communities").add(newCommunity);

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        community: { id: docRef.id, ...newCommunity },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/communities error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}