// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { v4 as uuidv4 } from "uuid";
// import type { Post, Poll, PollOption, CreatePostPayload } from "@/types/createposts";


// // POST  /api/posts  — Create a new post

// export async function POST(req: NextRequest) {
//   try {
//     const body: CreatePostPayload = await req.json();
//     const { authorName, authorHandle, authorAvatar, content, media, poll } = body;

//     if (!authorName || !authorHandle) {
//       return NextResponse.json(
//         { success: false, error: "authorName and authorHandle are required" },
//         { status: 400 }
//       );
//     }

//     if (!content && !media?.length && !poll) {
//       return NextResponse.json(
//         { success: false, error: "Post must have content, media, or a poll" },
//         { status: 400 }
//       );
//     }

//     // Build poll object if provided
//     let builtPoll: Poll | null = null;
//     if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
//       const options: PollOption[] = poll.options
//         .filter((o) => o.trim() !== "")
//         .map((text) => ({ id: uuidv4(), text: text.trim(), votes: 0 }));

//       if (options.length < 2) {
//         return NextResponse.json(
//           { success: false, error: "Poll must have at least 2 non-empty options" },
//           { status: 400 }
//         );
//       }

//       builtPoll = {
//         options,
//         totalVotes: 0,
//         endsAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
//         createdAt: Date.now(),
//         votedBy: [],
//       };
//     }

//     const now = Date.now();
//     const newPost: Omit<Post, "id"> = {
//       authorName,
//       authorHandle,
//       authorAvatar: authorAvatar || "",
//       content: content || "",
//       media: media || [],
//       poll: builtPoll,
//       createdAt: now,
//       updatedAt: now,
//     };

//     const docRef = await db.collection("socialPosts").add(newPost);

//     return NextResponse.json(
//       { success: true, data: { id: docRef.id, ...newPost } },
//       { status: 201 }
//     );
//   } catch (error) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("POST /api/posts error:", error);
//     return NextResponse.json({ success: false, error: msg }, { status: 500 });
//   }
// }


// // GET  /api/posts  — Fetch posts (paginated)
// // Query params: limit, lastDocId, lastDocCreatedAt

// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
//     const lastDocId = searchParams.get("lastDocId");
//     const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

//     let query = db
//       .collection("socialPosts")
//       .orderBy("createdAt", "desc")
//       .limit(limit);

//     if (lastDocId && lastDocCreatedAt) {
//       const lastDocRef = db.collection("socialPosts").doc(lastDocId);
//       const lastDoc = await lastDocRef.get();
//       if (lastDoc.exists) {
//         query = query.startAfter(lastDoc);
//       }
//     }

//     const snapshot = await query.get();
//     const posts: Post[] = snapshot.docs.map((doc) => ({
//       id: doc.id,
//       ...(doc.data() as Omit<Post, "id">),
//     }));

//     const lastDoc = snapshot.docs[snapshot.docs.length - 1];

//     return NextResponse.json({
//       success: true,
//       posts,
//       pagination: {
//         limit,
//         hasMore: posts.length === limit,
//         nextCursor:
//           posts.length === limit
//             ? {
//                 lastDocId: lastDoc?.id,
//                 lastDocCreatedAt: lastDoc?.data()?.createdAt,
//               }
//             : null,
//       },
//     });
//   } catch (error) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/posts error:", error);
//     return NextResponse.json({ success: false, error: msg }, { status: 500 });
//   }
// }




import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { v4 as uuidv4 } from "uuid";
import { awardUserPoints } from "@/lib/userPoints";
import type { Post, Poll, PollOption, CreatePostPayload } from "@/types/createposts";

const POST_POINTS_REWARD = 12;

// ─── POST  /api/createpost  — Create a new post ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: CreatePostPayload & {
      userId?: string;
      userEmail?: string;
    } = await req.json();

    const {
      userName,
      userHandle,
      userAvatar,
      content,
      media,
      poll,
      userId,
      userEmail,
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!userName || !userHandle) {
      return NextResponse.json(
        { success: false, error: "userName and userHandle are required" },
        { status: 400 }
      );
    }

    if (!content && !media?.length && !poll) {
      return NextResponse.json(
        { success: false, error: "Post must have content, media, or a poll" },
        { status: 400 }
      );
    }

    // ── Build poll ────────────────────────────────────────────────────────────
    let builtPoll: Poll | null = null;
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
      const options: PollOption[] = poll.options
        .filter((o) => o.trim() !== "")
        .map((text) => ({ id: uuidv4(), text: text.trim(), votes: 0 }));

      if (options.length < 2) {
        return NextResponse.json(
          { success: false, error: "Poll must have at least 2 non-empty options" },
          { status: 400 }
        );
      }

      builtPoll = {
        options,
        totalVotes: 0,
        endsAt: Date.now() + 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
        votedBy: [],
      };
    }

    // ── Save post ─────────────────────────────────────────────────────────────
    const now = Date.now();
    const newPost: Omit<Post, "id"> = {
      userName,
      userHandle,
      userAvatar: userAvatar || "",
      content: content || "",
      media: media || [],
      poll: builtPoll,
      likes: 0,
      likedBy: [],
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("socialPosts").add(newPost);

    // ── Award +12 points ──────────────────────────────────────────────────────
    // Only when a real userId is supplied (guests don't earn points).
    // transactionId is deterministic — double-submits never double-award.
    let pointsAwarded = 0;

    if (userId) {
      try {
        // Resolve / ensure user doc exists (mirrors battle API pattern)
        const userSnap = await db.collection("users").doc(userId).get();
        const userExists = userSnap.exists;

        let resolvedName  = userName;
        let resolvedEmail = userEmail || "";

        if (userExists) {
          const data = userSnap.data()!;
          resolvedName =
            data.firstName
              ? [data.firstName, data.lastName].filter(Boolean).join(" ")
              : data.name || userName;
          resolvedEmail = resolvedEmail || data.email || "";
        } else {
          // Create a minimal user doc so awardUserPoints can update it
          await db.collection("users").doc(userId).set({
            userId,
            email: resolvedEmail,
            name: resolvedName,
            firstName: resolvedName.split(" ")[0] || "",
            lastName:  resolvedName.split(" ")[1] || "",
            totalPoints: 0,
            pointsBreakdown: {},
            createdAt: now,
            lastUpdated: now,
            status: "active",
            role: "user",
          });
        }

        await awardUserPoints({
          actualUserId:  userId,
          userName:      resolvedName,
          userEmail:     resolvedEmail,
          userExists:    true, // created above if it didn't exist
          points:        POST_POINTS_REWARD,
          reason:        "CREATE_POST",
          transactionId: `${userId}_${docRef.id}_CREATE_POST`,
          metadata: { postId: docRef.id },
        });

        pointsAwarded = POST_POINTS_REWARD;
        console.log(`✅ Post created: ${docRef.id} | +${POST_POINTS_REWARD} pts awarded to ${userId}`);
      } catch (pointsErr) {
        // Points failure is non-critical — post is already saved
        console.error("[createpost] Failed to award points:", pointsErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: { id: docRef.id, ...newPost },
        pointsAwarded,
        message: pointsAwarded
          ? `Post created! +${pointsAwarded} points awarded!`
          : "Post created successfully!",
      },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/createpost error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── GET  /api/createpost  — Fetch posts (paginated) ─────────────────────────
// Query params: limit, lastDocId, lastDocCreatedAt
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const lastDocId = searchParams.get("lastDocId");
    const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

    let query = db
      .collection("socialPosts")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId && lastDocCreatedAt) {
      const lastDocRef = db.collection("socialPosts").doc(lastDocId);
      const lastDoc = await lastDocRef.get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const posts: Post[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Post, "id">),
    }));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore: posts.length === limit,
        nextCursor:
          posts.length === limit
            ? {
                lastDocId: lastDoc?.id,
                lastDocCreatedAt: lastDoc?.data()?.createdAt,
              }
            : null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/createpost error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}