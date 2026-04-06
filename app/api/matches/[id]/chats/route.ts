// // app/api/watch-along/matches/[id]/chats/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// function getIdFromUrl(req: NextRequest): string | null {
//   const url = new URL(req.url);
//   const pathParts = url.pathname.split('/');
//   const chatsIndex = pathParts.indexOf('chats');
//   if (chatsIndex > 0) {
//     return pathParts[chatsIndex - 1];
//   }
//   return null;
// }

// export async function DELETE(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);
//     if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

//     const roomRef = db.collection("watchAlongRooms").doc(id);
//     const roomDoc = await roomRef.get();

//     if (!roomDoc.exists) return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });

//     const chatsSnapshot = await roomRef.collection("chats").get();
//     const batch = db.batch();
//     chatsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
//     batch.delete(roomRef);
//     await batch.commit();

//     return NextResponse.json({ success: true, message: "Room and all chats deleted successfully" });
//   } catch (error) {
//     console.error("[chats DELETE]", error);
//     return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
//   }
// }

// export async function GET(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);
//     const { searchParams } = new URL(req.url);
//     const limit = parseInt(searchParams.get("limit") || "50");

//     if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

//     const roomRef = db.collection("watchAlongRooms").doc(id);
//     const roomDoc = await roomRef.get();

//     if (!roomDoc.exists) return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });

//     const snapshot = await roomRef
//       .collection("chats")
//       .orderBy("createdAt", "asc")
//       .limitToLast(limit)
//       .get();

//     const chats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

//     return NextResponse.json({ success: true, chats, count: chats.length });
//   } catch (error) {
//     console.error("[chats GET]", error);
//     return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
//   }
// }

// export async function POST(req: NextRequest) {
//   try {
//     const id = getIdFromUrl(req);
//     if (!id) return NextResponse.json({ success: false, error: "ID required" }, { status: 400 });

//     const body = await req.json();
//     const { user, text, color } = body;

//     if (!user || !text) return NextResponse.json({ success: false, message: "user and text are required" }, { status: 400 });

//     const roomRef = db.collection("watchAlongRooms").doc(id);
//     const roomDoc = await roomRef.get();

//     if (!roomDoc.exists) return NextResponse.json({ success: false, message: "Room not found" }, { status: 404 });

//     const chatData = { user, text, color: color || "text-pink-400", createdAt: Date.now() };
//     const docRef = await roomRef.collection("chats").add(chatData);

//     return NextResponse.json({ success: true, chat: { id: docRef.id, ...chatData } });
//   } catch (error) {
//     console.error("[chats POST]", error);
//     return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
//   }
// }
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest) {
    return NextResponse.json({ success: true, message: "POST endpoint for chats" });
}