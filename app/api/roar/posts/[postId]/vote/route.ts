// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import type { VoteType, Vote } from "@/app/models/Vote";

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
//     const vote: VoteType | null = body.vote; // null = toggle off

//     if (vote !== null && vote !== "agree" && vote !== "disagree") {
//       return NextResponse.json(
//         { error: "vote must be 'agree', 'disagree', or null" },
//         { status: 400 },
//       );
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

//     const postRef = db.collection("roarPosts").doc(postId);
//     const voteRef = postRef.collection("votes").doc(resolvedUserId);
//     const now = Date.now();

//     await db.runTransaction(async (tx) => {
//       const [postSnap, voteSnap] = await Promise.all([
//         tx.get(postRef),
//         tx.get(voteRef),
//       ]);

//       if (!postSnap.exists) throw new Error("Post not found");

//       const postData = postSnap.data() as any;
//       let agreeCount: number = postData.agreeCount ?? 0;
//       let disagreeCount: number = postData.disagreeCount ?? 0;

//       // Step 1: Undo previous vote
//       if (voteSnap.exists) {
//         const prev = (voteSnap.data() as Vote).vote;
//         if (prev === "agree") {
//           agreeCount = Math.max(agreeCount - 1, 0);
//         } else if (prev === "disagree") {
//           disagreeCount = Math.max(disagreeCount - 1, 0);
//         }
//         tx.delete(voteRef);
//       }

//       // Step 2: Apply new vote
//       if (vote) {
//         if (vote === "agree") {
//           agreeCount += 1;
//         } else {
//           disagreeCount += 1;
//         }
//         tx.set(voteRef, {
//           uid: resolvedUserId,
//           postId,
//           vote,
//           createdAt: now,
//         } satisfies Vote);
//       }

//       // Single atomic write to the post doc (avoids double-write issue in Firestore)
//       tx.update(postRef, {
//         agreeCount,
//         disagreeCount,
//         updatedAt: now,
//       });
//     });

//     return NextResponse.json({ success: true, vote });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/roar/posts/[postId]/vote error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }







// api/roar/posts/[postId]/vote/route.ts
//
// Handles agree / disagree votes on ROAR posts.
// After recording the vote it upserts a single grouped "like" notification
// document per post so the author sees "X and N others liked your post"
// instead of one document per voter.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import { getUserInfo } from "@/lib/userPoints";
import { FieldValue } from "firebase-admin/firestore";

// ─── Helper: build the grouped like message ──────────────────────────────────

function buildLikeMessage(likerNames: string[], likerCount: number): string {
  if (likerCount === 1) {
    return `${likerNames[0]} liked your ROAR post`;
  }
  const othersCount = likerCount - 1;
  return `${likerNames[0]} and ${othersCount} other${othersCount > 1 ? "s" : ""} liked your ROAR post`;
}

// ─── Helper: upsert the grouped notification ─────────────────────────────────
// Uses a stable doc ID derived from the postId so all likes on the same post
// accumulate in one document rather than creating a new document per vote.

async function upsertLikeNotification({
  postId,
  postAuthorUid,
  postAuthorEmail,
  postPreview,
  likerUsername,
  likerUid,
}: {
  postId: string;
  postAuthorUid: string;
  postAuthorEmail: string;
  postPreview: string;
  likerUsername: string;
  likerUid: string;
}) {
  // Don't notify if the author is voting on their own post
  if (likerUid === postAuthorUid) return;

  // One stable document per post — all likes merge here
  const notifId = `roar_like_${postId}`;
  const notifRef = db.collection("notifications").doc(notifId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(notifRef);

    if (!snap.exists) {
      // ── First like on this post ──────────────────────────────────────────
      tx.set(notifRef, {
        recipientEmail: postAuthorEmail,
        recipientUid: postAuthorUid,
        type: "roar_post_like",
        postId,
        postPreview,
        likerNames: [likerUsername],   // latest liker first
        likerCount: 1,
        message: buildLikeMessage([likerUsername], 1),
        isRead: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      // ── Subsequent like ──────────────────────────────────────────────────
      const data = snap.data()!;
      const existing: string[] = data.likerNames ?? [];

      // Skip if this user already appears (e.g. they un-voted then re-voted)
      if (existing.includes(likerUsername)) return;

      // Keep at most 3 names for the display; always show the newest first
      const updatedNames = [likerUsername, ...existing].slice(0, 3);
      const newCount = (data.likerCount ?? 1) + 1;

      tx.update(notifRef, {
        likerNames: updatedNames,
        likerCount: newCount,
        message: buildLikeMessage(updatedNames, newCount),
        isRead: false,        // re-surface as unread on every new like
        updatedAt: Date.now(),
      });
    }
  });
}

// ─── POST /api/roar/posts/[postId]/vote ──────────────────────────────────────

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
    // vote: "agree" | "disagree" | null  (null = remove vote)
    const { vote }: { vote: "agree" | "disagree" | null } = body;

    if (vote !== "agree" && vote !== "disagree" && vote !== null) {
      return NextResponse.json(
        { error: "vote must be 'agree', 'disagree', or null" },
        { status: 400 },
      );
    }

    // ── Resolve the voter ─────────────────────────────────────────────────────
    const { actualUserId, userName: resolvedName } = await getUserInfo(
      user.userId,
      user.name,
      user.email,
    );

    const postRef = db.collection("roarPosts").doc(postId);
    const voteRef = postRef.collection("roarVotes").doc(actualUserId);

    // ── Read current state ────────────────────────────────────────────────────
    const [postSnap, voteSnap] = await Promise.all([
      postRef.get(),
      voteRef.get(),
    ]);

    if (!postSnap.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const postData = postSnap.data() as {
      authorUid: string;
      agreeCount: number;
      disagreeCount: number;
      text?: string;
    };

    const previousVote = voteSnap.exists
      ? (voteSnap.data() as { vote: "agree" | "disagree" }).vote
      : null;

    // ── Build Firestore counter deltas ────────────────────────────────────────
    const agreeData =
      (vote === "agree" ? 1 : 0) - (previousVote === "agree" ? 1 : 0);
    const disagreeData =
      (vote === "disagree" ? 1 : 0) - (previousVote === "disagree" ? 1 : 0);

    // ── Persist vote + post counters atomically ───────────────────────────────
    const batch = db.batch();

    if (vote === null) {
      batch.delete(voteRef);
    } else {
      batch.set(voteRef, { vote, votedAt: Date.now() }, { merge: true });
    }

    batch.update(postRef, {
      agreeCount: FieldValue.increment(agreeData),
      disagreeCount: FieldValue.increment(disagreeData),
      updatedAt: Date.now(),
    });

    await batch.commit();

    // ── Grouped like notification (fire-and-forget, only on "agree") ──────────
    if (vote === "agree" && previousVote !== "agree") {
      (async () => {
        try {
          // Fetch author email for the notification query key
          const authorSnap = await db
            .collection("users")
            .doc(postData.authorUid)
            .get();
          const authorEmail = (
            authorSnap.data() as { email?: string } | undefined
          )?.email;

          if (authorEmail) {
            await upsertLikeNotification({
              postId,
              postAuthorUid: postData.authorUid,
              postAuthorEmail: authorEmail,
              postPreview: (postData.text ?? "").slice(0, 80),
              likerUsername: resolvedName,
              likerUid: actualUserId,
            });
          }
        } catch (notifErr) {
          console.error("[roar/vote] Failed to upsert like notification:", notifErr);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      vote,
      agreeCount: (postData.agreeCount ?? 0) + agreeData,
      disagreeCount: (postData.disagreeCount ?? 0) + disagreeData,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts/[postId]/vote error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}