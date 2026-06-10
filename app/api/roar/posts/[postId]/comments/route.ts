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
    const { text, roomId } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    let userSnap = await db.collection("users").doc(user.email).get();
    let resolvedUserId = user.email;
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const userData = userSnap.data() as { username: string; badge: string };

    const postRef = db.collection("roarPosts").doc(postId);
    let postSnap = await postRef.get();
    if (!postSnap.exists) {
      if (roomId) {
        const msgSnap = await db.collection("roarRooms").doc(roomId).collection("messages").doc(postId).get();
        if (msgSnap.exists) {
          const msgData = msgSnap.data() || {};
          await postRef.set({
            id: postId,
            authorUsername: msgData.authorUsername,
            authorBadge: msgData.authorBadge || "RISING_FAN",
            text: msgData.text,
            type: "room_message",
            createdAt: msgData.createdAt || Date.now(),
            replyCount: 0,
            likeCount: 0,
          });
          postSnap = await postRef.get();
        } else {
          return NextResponse.json({ error: "Message not found in room" }, { status: 404 });
        }
      } else {
        // Direct collectionGroup fallback (for compatibility)
        const msgQuery = await db.collectionGroup("messages").where("msgId", "==", postId).limit(1).get();
        if (!msgQuery.empty) {
          const msgDoc = msgQuery.docs[0];
          const msgData = msgDoc.data();
          await postRef.set({
            id: postId,
            authorUsername: msgData.authorUsername,
            authorBadge: msgData.authorBadge || "RISING_FAN",
            text: msgData.text,
            type: "room_message",
            createdAt: msgData.createdAt || Date.now(),
            replyCount: 0,
            likeCount: 0,
          });
          postSnap = await postRef.get();
        } else {
          return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }
      }
    }

    const commentRef = postRef
      .collection("comments")
      .doc();

    const newComment = {
      commentId: commentRef.id,
      authorUid: resolvedUserId,
      authorUsername: userData.username,
      authorBadge: userData.badge,
      text: text.trim(),
      heartCount: 0,
      createdAt: Date.now(),
    };

    const batch = db.batch();
    batch.set(commentRef, newComment);
    batch.update(postRef, {
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
