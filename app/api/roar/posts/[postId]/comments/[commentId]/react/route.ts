// //api/roar/posts/[postId]/comments/[commentId]/react/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import { FieldValue } from "firebase-admin/firestore";

// export async function POST(
//   req: NextRequest,
//   { params }: { params: Promise<{ postId: string; commentId: string }> },
// ) {
//   try {
//     const { postId, commentId } = await params;
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // Resolve user ID
//     let resolvedUserId = user.email;
//     let userSnap = await db.collection("users").doc(user.email).get();
//     if (!userSnap.exists) {
//       userSnap = await db.collection("users").doc(user.userId).get();
//       if (userSnap.exists) {
//         resolvedUserId = user.userId;
//       }
//     }

//     const commentRef = db
//       .collection("roarPosts")
//       .doc(postId)
//       .collection("comments")
//       .doc(commentId);

//     const reactionRef = commentRef.collection("reactions").doc(resolvedUserId);

//     let finalHeartCount = 0;

//     await db.runTransaction(async (tx) => {
//       const [commentSnap, reactionSnap] = await Promise.all([
//         tx.get(commentRef),
//         tx.get(reactionRef),
//       ]);

//       if (!commentSnap.exists) {
//         throw new Error("Comment not found");
//       }

//       if (reactionSnap.exists) {
//         throw new Error("Already reacted");
//       }

//       const current = (commentSnap.data() as any).heartCount ?? 0;
//       finalHeartCount = current + 1;

//       tx.update(commentRef, {
//         heartCount: FieldValue.increment(1),
//       });

//       tx.set(reactionRef, {
//         reactedAt: Date.now(),
//       });
//     });

//     return NextResponse.json({ success: true, heartCount: finalHeartCount });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     if (msg === "Comment not found") {
//       return NextResponse.json({ error: msg }, { status: 404 });
//     }
//     if (msg === "Already reacted") {
//       return NextResponse.json({ error: msg }, { status: 400 });
//     }
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }



import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getUser } from "@/lib/getUser";

function reactionCountField(reaction: string): string {
    const map: Record<string, string> = {
        heart: "heartCount", fire: "fireCount", mindblown: "mindblownCount",
        goat: "goatCount", clap: "clapCount", nochance: "nochanceCount",
        laugh: "laughCount", sad: "sadCount", thumb: "thumbCount",
    };
    return map[reaction] ?? `${reaction}Count`;
}

export async function POST(
    req: NextRequest,
    { params }: { params: { roomId: string; msgId: string; commentId: string } }
) {
    try {
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { roomId, msgId, commentId } = params;
        const { reaction } = await req.json();
        if (!reaction) return NextResponse.json({ error: "reaction is required" }, { status: 400 });

        const userId = user.userId;
        const commentRef = db
            .collection("roarRooms").doc(roomId)
            .collection("messages").doc(msgId)
            .collection("comments").doc(commentId);

        const snap = await commentRef.get();
        if (!snap.exists) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

        const data = snap.data()!;
        const reactions: Record<string, string> = data.reactions ?? {};
        const previousReaction = reactions[userId] ?? null;
        const isSameReaction = previousReaction === reaction;

        if (isSameReaction) {
            const newHeartCount = Math.max(0, (data.heartCount ?? 0) - 1);
            await commentRef.update({
                [`reactions.${userId}`]: FieldValue.delete(),
                heartCount: newHeartCount,
                [reactionCountField(previousReaction)]: Math.max(0, (data[reactionCountField(previousReaction)] ?? 0) - 1),
            });
            await commentRef.collection("likes").doc(userId).delete().catch(() => {});
            return NextResponse.json({ success: true, action: "removed", reaction: null, heartCount: newHeartCount });
        }

        const update: Record<string, any> = {
            [`reactions.${userId}`]: reaction,
            [reactionCountField(reaction)]: (data[reactionCountField(reaction)] ?? 0) + 1,
        };
        if (previousReaction) {
            update[reactionCountField(previousReaction)] = Math.max(0, (data[reactionCountField(previousReaction)] ?? 0) - 1);
        }
        const newHeartCount = (data.heartCount ?? 0) + (previousReaction ? 0 : 1);
        update.heartCount = newHeartCount;

        await commentRef.update(update);
        await commentRef.collection("likes").doc(userId).set({ reaction, reactedAt: Date.now(), userId });

        return NextResponse.json({ success: true, action: previousReaction ? "switched" : "added", reaction, heartCount: newHeartCount });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}