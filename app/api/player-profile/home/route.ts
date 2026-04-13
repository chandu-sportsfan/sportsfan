import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// // ─── GET: Fetch posts by playerProfilesId ─────────────────────────────
// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const playerProfilesId = searchParams.get("playerProfilesId");

//     let query = db.collection("playershome").orderBy("createdAt", "desc");

//     if (playerProfilesId) {
//       query = query.where("playerProfilesId", "==", playerProfilesId);
//     }

//     const snap = await query.get();

//     const posts = snap.docs.map((d) => ({
//       id: d.id,
//       ...d.data(),
//     }));

//     return NextResponse.json({
//       success: true,
//       posts,
//       total: posts.length,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     return NextResponse.json(
//       { success: false, error: msg },
//       { status: 500 }
//     );
//   }
// }
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playerProfilesId = searchParams.get("playerProfilesId");
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const lastDocId = searchParams.get("lastDocId");
    const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

    let query = db.collection("playershome").orderBy("createdAt", "desc");

    // Filter by player ID if provided
    if (playerProfilesId) {
      query = query.where("playerProfilesId", "==", playerProfilesId);
    }

    // 🔍 ADD SEARCH FUNCTIONALITY
    // Note: For text search, you need a 'title' or 'content' field to search on
    // Option 1: Search by title (requires index on 'titleLower')
    if (search) {
      query = query.where("titleLower", ">=", search)
                   .where("titleLower", "<=", search + "\uf8ff");
    }

    query = query.limit(limit);

    // Cursor-based pagination
    if (lastDocId && lastDocCreatedAt) {
      const lastDocRef = db.collection("playershome").doc(lastDocId);
      const lastDoc = await lastDocRef.get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snap = await query.get();

    const posts = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    const lastDoc = snap.docs[snap.docs.length - 1];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore: posts.length === limit,
        nextCursor: posts.length === limit
          ? {
              lastDocId: lastDoc?.id,
              lastDocCreatedAt: lastDoc?.data()?.createdAt,
            }
          : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Fetch playershome error:", error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

// ─── POST: Create new post linked to player ───────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      playerProfilesId,
      playerName,
      title,
      category,
      likes,
      comments,
      live,
      shares,
      image,
      logo,
      catlogo,
      hasVideo,
    } = body;

    // Validation
    // if (!playerProfilesId || !playerName || !title || !image || !logo) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error:
    //         "playerProfilesId, playerName, title, image and logo are required",
    //     },
    //     { status: 400 }
    //   );
    // }

    const newPost = {
      playerProfilesId,
      playerName,
      title,
      category: category ?? [],
      likes: Number(likes) || 0,
      comments: Number(comments) || 0,
      live: Number(live) || 0,
      shares: Number(shares) || 0,
      image,
      logo,
      catlogo: catlogo ?? [],
      hasVideo: hasVideo ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("playershome").add(newPost);

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        post: { id: docRef.id, ...newPost },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}