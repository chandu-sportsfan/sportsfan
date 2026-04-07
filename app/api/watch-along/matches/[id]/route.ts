import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Helper function to extract ID from URL
function getIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  return pathParts[pathParts.length - 1] || null;
}
// GET Request
export async function GET(req: NextRequest) {
  try {
    const id   = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
    const doc = await db.collection("watchAlongMatches").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, match: { id: doc.id, ...doc.data() } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}


// GET Request
export async function PUT(req: NextRequest) {
  try {
    const id   = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
    const docRef = db.collection("watchAlongMatches").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (body.matchNo !== undefined) updates.matchNo = Number(body.matchNo);
    if (body.tournament !== undefined) updates.tournament = body.tournament;
    if (body.stadium !== undefined) updates.stadium = body.stadium;
    if (body.isLive !== undefined) updates.isLive = Boolean(body.isLive);

    if (body.team1) {
      const prev = (existing.data()?.team1 || {}) as Record<string, string>;
      updates.team1 = { ...prev, ...body.team1 };
    }
    if (body.team2) {
      const prev = (existing.data()?.team2 || {}) as Record<string, string>;
      updates.team2 = { ...prev, ...body.team2 };
    }

    await docRef.update(updates);
    const updated = await docRef.get();

    return NextResponse.json({ success: true, match: { id: updated.id, ...updated.data() } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}


// GET Request
export async function DELETE(req: NextRequest) {
  try {
    const id   = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
    const docRef = db.collection("watchAlongMatches").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json({ success: false, message: "Match not found" }, { status: 404 });
    }

    // Detach this match from any room that references it
    const roomsSnap = await db
      .collection("watchAlongRooms")
      .where("liveMatchId", "==", id)
      .get();

    const batch = db.batch();
    roomsSnap.docs.forEach((roomDoc) =>
      batch.update(roomDoc.ref, { liveMatchId: null, isLive: false, updatedAt: Date.now() })
    );
    batch.delete(docRef);
    await batch.commit();

    return NextResponse.json({ success: true, message: "Match deleted and rooms updated" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message },
      { status: 500 }
    );
  }
}
















// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// // Helper function to extract ID from URL
// function getIdFromUrl(req: NextRequest): string | null {
//   const url = new URL(req.url);
//   const pathParts = url.pathname.split('/');
//   return pathParts[pathParts.length - 1] || null;
// }

// /* ─────────────────────────────────────────────
//    GET  /api/watch-along/[id]/chats
//    Returns paginated chat messages for a room
//    ───────────────────────────────────────────── */
// export async function GET(req: NextRequest) {  // ← Changed from DELETE to GET
//   try {
//     const id = getIdFromUrl(req);

//     if (!id) {
//       return NextResponse.json({ error: "ID required" }, { status: 400 });
//     }
//     const { searchParams } = new URL(req.url);
//     const limit = parseInt(searchParams.get("limit") || "50");

//     const roomRef = db.collection("watchAlongRooms").doc(id);
//     const roomDoc = await roomRef.get();

//     if (!roomDoc.exists) {
//       return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });
//     }

//     const snapshot = await roomRef
//       .collection("chats")
//       .orderBy("createdAt", "asc")
//       .limitToLast(limit)
//       .get();

//     const chats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

//     return NextResponse.json({ success: true, chats });
//   } catch (error) {
//     console.error("[chats GET]", error);
//     return NextResponse.json(
//       { success: false, message: (error as Error).message },
//       { status: 500 }
//     );
//   }
// }


// export async function POST(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);

//     if (!id) {
//       return NextResponse.json({ error: "ID required" }, { status: 400 });
//     }
//     const body = await req.json();
//     const { user, text, color } = body;

//     if (!user || !text) {
//       return NextResponse.json(
//         { success: false, message: "user and text are required" },
//         { status: 400 }
//       );
//     }

//     const roomRef = db.collection("watchAlongRooms").doc(id);
//     const roomDoc = await roomRef.get();

//     if (!roomDoc.exists) {
//       return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });
//     }

//     const chatData = {
//       user,
//       text,
//       color: color || "text-pink-400",
//       createdAt: Date.now(),
//     };

//     const docRef = await roomRef.collection("chats").add(chatData);

//     return NextResponse.json({
//       success: true,
//       chat: { id: docRef.id, ...chatData },
//     });
//   } catch (error) {
//     console.error("[chats POST]", error);
//     return NextResponse.json(
//       { success: false, message: (error as Error).message },
//       { status: 500 }
//     );
//   }
// }

// /* ─────────────────────────────────────────────
//    DELETE  /api/watch-along/[id]/chats
//    (Optional - add if you need delete functionality)
//    ───────────────────────────────────────────── */
// // export async function DELETE(req: NextRequest) {
// //   // Your delete logic here
// // }