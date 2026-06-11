// //api/roar/posts/[postId]/comments/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";

// export async function GET(
//   req: NextRequest,
//   { params }: { params: Promise<{ postId: string }> },
// ) {
//   try {
//     const { postId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const snapshot = await db
//       .collection("roarPosts")
//       .doc(postId)
//       .collection("comments")
//       .orderBy("createdAt", "asc")
//       .get();

//     const comments = snapshot.docs.map((doc) => ({
//       commentId: doc.id,
//       ...doc.data(),
//     }));

//     return NextResponse.json({ success: true, comments });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// export async function POST(
//   req: NextRequest,
//   { params }: { params: Promise<{ postId: string }> },
// ) {
//   try {
//     const { postId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await req.json();
//     const { text } = body;

//     if (!text?.trim()) {
//       return NextResponse.json({ error: "text is required" }, { status: 400 });
//     }

//     let userSnap = await db.collection("users").doc(user.email).get();
//     let resolvedUserId = user.email;
//     if (!userSnap.exists) {
//       userSnap = await db.collection("users").doc(user.userId).get();
//       if (userSnap.exists) {
//         resolvedUserId = user.userId;
//       }
//     }
//     if (!userSnap.exists) {
//       return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     }
//     const userData = userSnap.data() as { username: string; badge: string };

//     const postRef = db.collection("roarPosts").doc(postId);
//     const postSnap = await postRef.get();
//     if (!postSnap.exists) {
//       return NextResponse.json({ error: "Post not found" }, { status: 404 });
//     }

//     const commentRef = postRef
//       .collection("comments")
//       .doc();

//     const newComment = {
//       commentId: commentRef.id,
//       authorUid: resolvedUserId,
//       authorUsername: userData.username,
//       authorBadge: userData.badge,
//       text: text.trim(),
//       heartCount: 0,
//       createdAt: Date.now(),
//     };

//     const batch = db.batch();
//     batch.set(commentRef, newComment);
//     batch.update(postRef, {
//       replyCount: FieldValue.increment(1),
//       updatedAt: Date.now(),
//     });

//     await batch.commit();

//     return NextResponse.json({ success: true, comment: newComment });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }






// api/roar/posts/[postId]/comments/route.ts

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

    // ── Resolve commenter's user doc ──────────────────────────────────────────
    let userSnap = await db.collection("users").doc(user.email).get();
    let resolvedUserId = user.email;
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) resolvedUserId = user.userId;
    }
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const userData = userSnap.data() as { username: string; badge: string };

    // ── Fetch the post ────────────────────────────────────────────────────────
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
          await postRef.set({
            postId,
            type: "hot_take",
            text: "Mockup post",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            replyCount: 0,
          });
          postSnap = await postRef.get();
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
          await postRef.set({
            postId,
            type: "hot_take",
            text: "Mockup post",
            createdAt: Date.now(),
            updatedAt: Date.now(),
            replyCount: 0,
          });
          postSnap = await postRef.get();
        }
      }
    }
    const postData = postSnap.data() as {
      authorUid: string;
      text?: string;
    };

    // ── Save the comment ──────────────────────────────────────────────────────
    const commentRef = postRef.collection("comments").doc();
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

    // ── Send comment notification to post author (fire-and-forget) ────────────
    // Skip if the commenter IS the author
    if (postData.authorUid && postData.authorUid !== resolvedUserId) {
      (async () => {
        try {
          // Look up author's email so the notification page can query by email
          const authorSnap = await db
            .collection("users")
            .doc(postData.authorUid)
            .get();
          const authorEmail = (authorSnap.data() as { email?: string } | undefined)
            ?.email;

          if (authorEmail) {
            await db.collection("notifications").add({
              recipientEmail: authorEmail,
              recipientUid: postData.authorUid,
              type: "roar_post_comment",
              postId,                          // ← used for the redirect
              commenterUsername: userData.username,
              commenterUid: resolvedUserId,
              // Short snippet of the post so the card can preview it
              postPreview: (postData.text ?? "").slice(0, 80),
              message: `${userData.username} commented on your ROAR post`,
              isRead: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        } catch (notifErr) {
          // Notification failure must never break the comment response
          console.error("[roar/comments] Failed to send notification:", notifErr);
        }
      })();
    }

    return NextResponse.json({ success: true, comment: newComment });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
