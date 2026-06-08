import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await db
      .collection("roarPosts")
      .doc(postId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .get();

    const comments = snapshot.docs.map((doc) => ({
      commentId: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ success: true, comments });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { text } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const userSnap = await db.collection("users").doc(user.email).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const userData = userSnap.data() as { username: string; badge: string };

    const commentRef = db
      .collection("roarPosts")
      .doc(postId)
      .collection("comments")
      .doc();

    const newComment = {
      commentId: commentRef.id,
      authorUid: user.userId,
      authorUsername: userData.username,
      authorBadge: userData.badge,
      text: text.trim(),
      heartCount: 0,
      createdAt: Date.now(),
    };

    const batch = db.batch();
    batch.set(commentRef, newComment);
    batch.update(db.collection("roarPosts").doc(postId), {
      replyCount: FieldValue.increment(1),
      updatedAt: Date.now(),
    });

    await batch.commit();

    return NextResponse.json({ success: true, comment: newComment });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
