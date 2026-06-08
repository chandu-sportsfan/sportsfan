import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Post } from "@/app/models/Post";

// GET  /api/roar/feed?filter=For+You&limit=20&lastDocId=xxx
export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") ?? "For You";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const lastDocId = searchParams.get("lastDocId");

    let query = db
      .collection("roarPosts")
      .where("status", "==", "active")
      .orderBy("createdAt", "desc");

    if (filter === "Cricket") query = query.where("sport", "==", "cricket");
    if (filter === "Football") query = query.where("sport", "==", "football");
    if (filter === "Live") query = query.where("isLive", "==", true);
    if (filter === "Predictions")
      query = query.where("type", "==", "prediction");

    query = query.limit(limit);

    if (lastDocId) {
      const lastDoc = await db.collection("roarPosts").doc(lastDocId).get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    const posts: Post[] = snapshot.docs.map((doc) => ({
      ...(doc.data() as Post),
      postId: doc.id,
    }));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore: posts.length === limit,
        nextCursor: posts.length === limit ? { lastDocId: lastDoc?.id } : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/feed error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
