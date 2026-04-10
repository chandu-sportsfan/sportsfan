import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── GET: All home posts OR by playerProfilesId ─────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const playerProfilesId = searchParams.get("playerProfilesId");

    let query = db.collection("players360Posts") as FirebaseFirestore.Query;

    // filter by player profile if provided
    if (playerProfilesId) {
      query = query.where("playerProfilesId", "==", playerProfilesId);
    }

    const snap = await query.orderBy("createdAt", "desc").get();

    const posts = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      posts,
      total: posts.length,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

// // ─── POST: Create new player home post ─────────────────
// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();

//     const {
//       playerProfilesId,
//       playerName,
//       title,
//       category,
//       likes,
//       comments,
//       live,
//       shares,
//       image,
//       logo,
//       catlogo,
//       hasVideo,
//     } = body;

//     // Validation
//     if (!playerProfilesId || !title || !image || !logo) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "playerProfilesId, title, image and logo are required",
//         },
//         { status: 400 }
//       );
//     }

//     const newPost = {
//       playerProfilesId,
//       playerName: playerName || "",

//       title,

//       // arrays
//       category: category ?? [],
//       catlogo: catlogo ?? [],

//       // stats
//       likes: Number(likes) || 0,
//       comments: Number(comments) || 0,
//       live: Number(live) || 0,
//       shares: Number(shares) || 0,

//       // media
//       image,
//       logo,

//       hasVideo: Boolean(hasVideo),

//       createdAt: Date.now(),
//       updatedAt: Date.now(),
//     };

//     const docRef = await db.collection("players360Posts").add(newPost);

//     return NextResponse.json(
//       {
//         success: true,
//         post: {
//           id: docRef.id,
//           ...newPost,
//         },
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg =
//       error instanceof Error ? error.message : "Unexpected error";

//     return NextResponse.json(
//       { success: false, message: msg },
//       { status: 500 }
//     );
//   }
// }



export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const newPost = {
      ...body,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("playershome").add(newPost);

    return NextResponse.json({
      success: true,
      id: docRef.id,
      post: {
        id: docRef.id,
        ...newPost,
      },
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

// ✅ PUT
export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Post id is required" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const docRef = db.collection("playershome").doc(id);

    await docRef.update({
      ...body,
      updatedAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      message: "Post updated successfully",
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}


// ✅ DELETE single post using query param
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const id = pathParts[pathParts.length - 1];

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Post id is required" },
        { status: 400 }
      );
    }

    const docRef = db.collection("playershome").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: "Post not found" },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}