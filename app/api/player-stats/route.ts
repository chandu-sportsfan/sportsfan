// // api/player-stats/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from "firebase-admin/firestore";
// import { validatePlayerStatsCreate } from "../../../lib/validations/playerStatsValidation";
// import { validatePlayerStatsRecord } from "../../../lib/ingestion/playerStatsRules";

// // export async function GET(req: NextRequest) {
// //   const { searchParams } = new URL(req.url);
// //   const tournament = searchParams.get("tournament");
// //   const gender = searchParams.get("gender");
// //   const format = searchParams.get("format");
// //   const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 500);
// //   const after = searchParams.get("after");

// //   try {
// //     let query: FirebaseFirestore.Query = db.collection("playerStats").orderBy("player_name");

// //     if (tournament) query = query.where("tournament", "==", tournament);
// //     if (gender) query = query.where("gender", "==", gender);
// //     if (format) query = query.where("format", "==", format);

// //     if (after) {
// //       const cursorDoc = await db.collection("playerStats").doc(after).get();
// //       if (cursorDoc.exists) query = query.startAfter(cursorDoc);
// //     }

// //     query = query.limit(limit);
// //     const snap = await query.get();
// //     const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
// //     const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;
    

// //     return NextResponse.json({ success: true, data, nextCursor, count: data.length });
// //   } catch (err) {
// //     const msg = err instanceof Error ? err.message : String(err);
// //     return NextResponse.json({ success: false, error: msg }, { status: 500 });
// //   }
// // }


// export async function GET(req: NextRequest) {
//   const { searchParams } = new URL(req.url);
//   const tournament = searchParams.get("tournament");
//   const gender = searchParams.get("gender");
//   const format = searchParams.get("format");
//   const countOnly = searchParams.get("count") === "true"; // ← add this
//   const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
//   const after = searchParams.get("after");

//   try {
//     let query: FirebaseFirestore.Query = db.collection("playerStats");

//     if (tournament) query = query.where("tournament", "==", tournament);
//     if (gender) query = query.where("gender", "==", gender);
//     if (format) query = query.where("format", "==", format);

//     // ── Count-only path — 1 read regardless of total docs ──────────────────
//     if (countOnly) {
//       const countSnap = await query.count().get();
//       return NextResponse.json(
//         { success: true, total: countSnap.data().count },
//         { headers: { "Cache-Control": "public, max-age=300" } }
//       );
//     }

//     // ── Normal paginated path ───────────────────────────────────────────────
//     query = query.orderBy("player_name").orderBy("__name__");
//     if (after) query = query.startAfter(after);
//     query = query.limit(limit);

//     const snap = await query.get();
//     const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
//     const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

//     return NextResponse.json(
//       { success: true, data, nextCursor, pageSize: data.length },
//       { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" } }
//     );
//   } catch (err) {
//     const msg = err instanceof Error ? err.message : String(err);
//     return NextResponse.json({ success: false, error: msg }, { status: 500 });
//   }
// }


// export async function POST(req: NextRequest) {
//   let body: Record<string, unknown>;
//   try {
//     body = await req.json();
//   } catch {
//     return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
//   }

//   const injection = validatePlayerStatsRecord(body);
//   if (!injection.valid) {
//     return NextResponse.json({ success: false, errors: injection.errors }, { status: 422 });
//   }

//   const schema = validatePlayerStatsCreate(body);
//   if (!schema.success) {
//     return NextResponse.json({ success: false, errors: schema.errors }, { status: 422 });
//   }

//   const stat = schema.data!;

//   // Check duplicate
//   const existing = await db
//     .collection("playerStats")
//     .where("player_name", "==", stat.player_name)
//     .where("tournament", "==", stat.tournament)
//     .limit(1)
//     .get();

//   if (!existing.empty) {
//     return NextResponse.json(
//       { success: false, error: `${stat.player_name} already exists for ${stat.tournament}` },
//       { status: 409 }
//     );
//   }

//   const docRef = await db.collection("playerStats").add({
//     ...stat,
//     created_at: FieldValue.serverTimestamp(),
//     updated_at: FieldValue.serverTimestamp(),
//   });

//   return NextResponse.json({ success: true, id: docRef.id }, { status: 201 });
// }










// api/player-stats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { validatePlayerStatsCreate } from "../../../lib/validations/playerStatsValidation";
import { validatePlayerStatsRecord } from "../../../lib/ingestion/playerStatsRules";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const tournament = searchParams.get("tournament");
  const gender     = searchParams.get("gender");
  const format     = searchParams.get("format");
  const playerId   = searchParams.get("player_id");   // ← single player lookup
  const search     = searchParams.get("search");       // ← prefix search on player_name
  const countOnly  = searchParams.get("count") === "true";

  // Accept both `limit` and `pageSize` — context sends pageSize, some callers send limit
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? searchParams.get("pageSize") ?? "20", 10),
    100
  );

  // Accept both `after` (original) and `cursor` (context alias)
  const after = searchParams.get("after") ?? searchParams.get("cursor");

  try {
    let query: FirebaseFirestore.Query = db.collection("playerStats");

    // ── Filters ────────────────────────────────────────────────────────────
    if (tournament) query = query.where("tournament", "==", tournament);
    if (gender)     query = query.where("gender",     "==", gender);
    if (format)     query = query.where("format",     "==", format);

    // Exact match on player_id — used by fetchWPLPlayer(playerId)
    if (playerId)   query = query.where("player_id",  "==", playerId);

    // ── Count-only path ────────────────────────────────────────────────────
    if (countOnly) {
      const countSnap = await query.count().get();
      return NextResponse.json(
        { success: true, total: countSnap.data().count },
        { headers: { "Cache-Control": "public, max-age=300" } }
      );
    }

    // ── Prefix search on player_name ───────────────────────────────────────
    // Firestore doesn't support LIKE, but a range query covers prefix matches.
    // e.g. search="smi" → player_name >= "smi" && player_name < "smj"
    if (search) {
      const term     = search.trim();
      const end      = term.slice(0, -1) + String.fromCharCode(term.charCodeAt(term.length - 1) + 1);
      query = query
        .orderBy("player_name")
        .orderBy("__name__")
        .where("player_name", ">=", term)
        .where("player_name", "<",  end);
    } else {
      // Default ordering — needed for stable cursor pagination
      query = query.orderBy("player_name").orderBy("__name__");
    }

    // ── Cursor pagination ──────────────────────────────────────────────────
    // `after` is a doc ID string; we use it as a cursor value in __name__ ordering
    if (after) {
      const cursorDoc = await db.collection("playerStats").doc(after).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    query = query.limit(limit);

    const snap = await query.get();
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return NextResponse.json(
      { success: true, data, nextCursor, pageSize: data.length },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const injection = validatePlayerStatsRecord(body);
  if (!injection.valid) {
    return NextResponse.json({ success: false, errors: injection.errors }, { status: 422 });
  }

  const schema = validatePlayerStatsCreate(body);
  if (!schema.success) {
    return NextResponse.json({ success: false, errors: schema.errors }, { status: 422 });
  }

  const stat = schema.data!;

  // Check duplicate
  const existing = await db
    .collection("playerStats")
    .where("player_name", "==", stat.player_name)
    .where("tournament",  "==", stat.tournament)
    .limit(1)
    .get();

  if (!existing.empty) {
    return NextResponse.json(
      { success: false, error: `${stat.player_name} already exists for ${stat.tournament}` },
      { status: 409 }
    );
  }

  const docRef = await db.collection("playerStats").add({
    ...stat,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, id: docRef.id }, { status: 201 });
}