

// // api/roar/posts/[postId]/likesection/route.ts


// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { getUserInfo } from "@/lib/userPoints";
// import { FieldValue } from "firebase-admin/firestore";

// type ReactionType = "heart" | "fire" | "laugh" | "sad" | "thumb";
// const VALID_REACTIONS = new Set<ReactionType>(["heart", "fire", "laugh", "sad", "thumb"]);

// // Resolve the parent doc ref (post or room message) and the counter field
// // name to use on it, based on whether roomId was supplied.
// function resolveTargetRef(postId: string, roomId?: string) {
//   if (roomId) {
//     return {
//       targetRef: db
//         .collection("roarRooms")
//         .doc(roomId)
//         .collection("messages")
//         .doc(postId),
//       countField: "heartCount" as const,
//     };
//   }
//   return {
//     targetRef: db.collection("roarPosts").doc(postId),
//     countField: "likeCount" as const,
//   };
// }

// // ── POST: add or change reaction ─────────────────────────────────────────────
// export async function POST(
//   req: NextRequest,
//   { params }: { params: { postId: string } }
// ) {
//   try {
//     const user = await getUser(req);
//     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { postId } = params;
//     if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });

//     const body = await req.json().catch(() => ({}));
//     const reaction: ReactionType = VALID_REACTIONS.has(body.reaction) ? body.reaction : "heart";
//     const roomId: string | undefined = typeof body.roomId === "string" && body.roomId ? body.roomId : undefined;

//     const info = await getUserInfo(user.userId, undefined, user.email);
//     if (!info.exists) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     const resolvedUserId = info.actualUserId;

//     const { targetRef, countField } = resolveTargetRef(postId, roomId);
//     const likeRef = targetRef.collection("likes").doc(resolvedUserId);

//     // Transactionally read + write so concurrent reactions can't double-count
//     const result = await db.runTransaction(async (tx) => {
//       const [likeSnap, targetSnap] = await Promise.all([tx.get(likeRef), tx.get(targetRef)]);

//       if (!targetSnap.exists) {
//         throw new Error(roomId ? "Message not found" : "Post not found");
//       }

//       if (!likeSnap.exists) {
//         // No existing reaction → add it
//         tx.set(likeRef, { reaction, userId: resolvedUserId, reactedAt: Date.now() });
//         tx.update(targetRef, { [countField]: FieldValue.increment(1) });
//         return {
//           action: "added",
//           reaction,
//           likeCount: ((targetSnap.data() as any)[countField] ?? 0) + 1,
//         };
//       }

//       const existing = likeSnap.data() as { reaction?: string };

//       if (existing.reaction === reaction) {
//         // Same reaction → toggle off
//         tx.delete(likeRef);
//         tx.update(targetRef, { [countField]: FieldValue.increment(-1) });
//         return {
//           action: "removed",
//           reaction: null,
//           likeCount: Math.max(0, ((targetSnap.data() as any)[countField] ?? 1) - 1),
//         };
//       }

//       // Different reaction → swap type only, count unchanged
//       tx.update(likeRef, { reaction, reactedAt: Date.now() });
//       return {
//         action: "updated",
//         reaction,
//         likeCount: (targetSnap.data() as any)[countField] ?? 0,
//       };
//     });

//     return NextResponse.json({ success: true, ...result });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     if (msg === "Post not found" || msg === "Message not found") {
//       return NextResponse.json({ error: msg }, { status: 404 });
//     }
//     console.error(`POST /api/roar/posts/${params.postId}/likesection error:`, error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ── DELETE: remove reaction entirely ─────────────────────────────────────────
// export async function DELETE(
//   req: NextRequest,
//   { params }: { params: { postId: string } }
// ) {
//   try {
//     const user = await getUser(req);
//     if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { postId } = params;
//     if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });

//     // DELETE has no body convention in the rest of this codebase's fetch
//     // wrapper, so roomId is read from a query param here instead of a body.
//     const { searchParams } = new URL(req.url);
//     const roomId = searchParams.get("roomId") || undefined;

//     const info = await getUserInfo(user.userId, undefined, user.email);
//     if (!info.exists) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
//     const resolvedUserId = info.actualUserId;

//     const { targetRef, countField } = resolveTargetRef(postId, roomId);
//     const likeRef = targetRef.collection("likes").doc(resolvedUserId);

//     const likeCount = await db.runTransaction(async (tx) => {
//       const [snap, targetSnap] = await Promise.all([tx.get(likeRef), tx.get(targetRef)]);
//       if (snap.exists) {
//         tx.delete(likeRef);
//         tx.update(targetRef, { [countField]: FieldValue.increment(-1) });
//         return Math.max(0, ((targetSnap.data() as any)[countField] ?? 1) - 1);
//       }
//       return (targetSnap.data() as any)?.[countField] ?? 0;
//     });

//     return NextResponse.json({ success: true, action: "removed", reaction: null, likeCount });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error(`DELETE /api/roar/posts/${params.postId}/likesection error:`, error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }



// app/api/roar/posts/[postId]/likesection/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getUser } from "@/lib/getUser";
import { notifyPostReaction } from "@/lib/roarNotifyHelpers";

type ReactionType = "heart" | "fire" | "mindblown" | "goat" | "clap" | "nochance" | string;

function getTargetRef(postId: string, roomId?: string) {
  if (roomId) {
    return db.collection("roarRooms").doc(roomId).collection("messages").doc(postId);
  }
  return db.collection("roarPosts").doc(postId);
}

function reactionCountField(reaction: string): string {
  const map: Record<string, string> = {
    heart: "heartCount", fire: "fireCount", mindblown: "mindblownCount",
    goat: "goatCount", clap: "clapCount", nochance: "nochanceCount",
    laugh: "laughCount", sad: "sadCount", thumb: "thumbCount",
  };
  return map[reaction] ?? `${reaction}Count`;
}

// ─── POST — add or switch reaction ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const reaction: ReactionType = body.reaction;
    const roomId: string | undefined = body.roomId;

    if (!reaction) return NextResponse.json({ error: "reaction is required" }, { status: 400 });

    const { postId } = params;
    // userId here is your app's userId (may be email-derived or Firebase UID
    // depending on how your JWT was minted — used as the reactions map key)
    const userId = user.userId;
    const targetRef = getTargetRef(postId, roomId);

    const snap = await targetRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const data = snap.data()!;
    const reactions: Record<string, string> = data.reactions ?? {};
    const previousReaction = reactions[userId] ?? null;
    const isSameReaction = previousReaction === reaction;

    if (isSameReaction) {
      const newLikeCount = Math.max(0, (data.likeCount ?? 0) - 1);
      await targetRef.update({
        [`reactions.${userId}`]: FieldValue.delete(),
        likeCount: newLikeCount,
        [reactionCountField(previousReaction)]: Math.max(0, (data[reactionCountField(previousReaction)] ?? 0) - 1),
      });
      return NextResponse.json({ success: true, action: "removed", reaction: null, likeCount: newLikeCount });
    }

    const update: Record<string, any> = {
      [`reactions.${userId}`]: reaction,
      [reactionCountField(reaction)]: (data[reactionCountField(reaction)] ?? 0) + 1,
    };

    if (previousReaction) {
      update[reactionCountField(previousReaction)] = Math.max(0, (data[reactionCountField(previousReaction)] ?? 0) - 1);
    }

    const newLikeCount = (data.likeCount ?? 0) + (previousReaction ? 0 : 1);
    update.likeCount = newLikeCount;

    await targetRef.update(update);

    // Fire notification non-blocking (posts only, not room messages)
    if (!roomId) {
      notifyPostReaction(postId, userId, reaction).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      action: previousReaction ? "switched" : "added",
      reaction,
      likeCount: newLikeCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[likesection POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE — remove reaction ─────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId") ?? undefined;
    const { postId } = params;
    const userId = user.userId;
    const targetRef = getTargetRef(postId, roomId);

    const snap = await targetRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const data = snap.data()!;
    const reactions: Record<string, string> = data.reactions ?? {};
    const previousReaction = reactions[userId] ?? null;

    if (!previousReaction) {
      return NextResponse.json({ success: true, action: "removed", reaction: null, likeCount: data.likeCount ?? 0 });
    }

    const newLikeCount = Math.max(0, (data.likeCount ?? 0) - 1);
    await targetRef.update({
      [`reactions.${userId}`]: FieldValue.delete(),
      likeCount: newLikeCount,
      [reactionCountField(previousReaction)]: Math.max(0, (data[reactionCountField(previousReaction)] ?? 0) - 1),
    });

    return NextResponse.json({ success: true, action: "removed", reaction: null, likeCount: newLikeCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[likesection DELETE]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}