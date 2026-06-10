// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import { getUser } from "@/lib/getUser";
// import type { Leaderboard, LeaderboardEntry } from "@/app/models/LeaderboardEntry";

// export async function GET(req: NextRequest) {
//   try {
//     const user = await getUser(req);
//     if (!user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { searchParams } = new URL(req.url);
//     // period: "all_time" | "this_month" | "cricket" | "football"
//     const period = searchParams.get("period") ?? "all_time";

//     const validPeriods = ["all_time", "this_month", "cricket", "football"];
//     if (!validPeriods.includes(period)) {
//       return NextResponse.json({ error: "Invalid period" }, { status: 400 });
//     }

//     // Map UI tab name -> Firestore doc id
//     const periodKey =
//       period === "this_month"
//         ? `month_${new Date().toISOString().slice(0, 7)}` // "month_2025-06"
//         : period;

//     const snap = await db.collection("leaderboard").doc(periodKey).get();

//     if (!snap.exists) {
//       return NextResponse.json({
//         success: true,
//         leaderboard: { period: periodKey, entries: [], updatedAt: 0 },
//       });
//     }

//     const leaderboard = snap.data() as Leaderboard;

//     // Find current user's entry for "Your rank" card
//     const userEntry = leaderboard.entries.find((e: LeaderboardEntry) => e.uid === user.userId);

//     return NextResponse.json({
//       success: true,
//       leaderboard,
//       currentUserEntry: userEntry ?? null,
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("GET /api/roar/leaderboard error:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }





// api/roar/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Firestore charges per document read. Without a cache, every Postman hit
// (or UI refresh) re-reads N leaderboard docs. This cache absorbs repeated
// calls within the TTL window at zero Firestore cost.
const CACHE_TTL_MS = 5 * 60 * 1000; // 1 minute — tune up to 5 min for production

const cache: {
  data: Record<string, { entries: unknown[]; cachedAt: number }>;
} = { data: {} };

function cacheKey(limit: number, cursor: string) {
  return `${limit}__${cursor}`;
}

// ─── GET /api/roar/leaderboard 
// Query params:
//   limit      — docs per page, max 50 (default 20)
//   cursor     — lastDocId for next-page pagination (default "")
//   breakdown  — if "true", includes per-type point breakdown in response
//
// Firestore reads per call:
//   • Cache hit  → 0 reads
//   • Cache miss → exactly `limit` reads (one per leaderboard doc)
//
// Firestore indexes required:
//   Collection: roarLeaderboard  |  Field: totalPoints DESC  (single-field, auto-created)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit      = Math.min(parseInt(searchParams.get("limit")  || "20"), 50);
    const cursorId   = searchParams.get("cursor") || "";
    const showBreakdown = searchParams.get("breakdown") === "true";

    const key = cacheKey(limit, cursorId);
    const now = Date.now();

    // ── Cache hit 
    const cached = cache.data[key];
    if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(
        {
          success:    true,
          leaderboard: cached.entries,
          cached:     true,
          cachedAt:   cached.cachedAt,
        },
        {
          headers: {
            // Let CDN / browser also cache for the same window
            "Cache-Control": `public, s-maxage=${CACHE_TTL_MS / 1000}, stale-while-revalidate=30`,
          },
        },
      );
    }

    // ── Build query — only fetch fields you actually need ─────────────────────
    // .select() limits the payload Firestore sends over the wire.
    // Each doc is still billed as 1 read, but network + CPU cost drops.
    const fields = showBreakdown
      ? ["userId", "userName", "userEmail", "totalPoints", "breakdown", "lastUpdated"]
      : ["userId", "userName", "userEmail", "totalPoints", "lastUpdated"];

    let query = db
      .collection("roarLeaderboard")
      .orderBy("totalPoints", "desc")
      .select(...fields)
      .limit(limit);

    // ── Cursor-based pagination (no offset — offsets still bill skipped reads) ─
    if (cursorId) {
      const cursorDoc = await db.collection("roarLeaderboard").doc(cursorId).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const snapshot = await query.get();

    const leaderboard = snapshot.docs.map((doc, index) => {
      const d = doc.data();
      return {
        rank:        (cursorId ? "?" : index + 1), // absolute rank only on first page
        userId:      d.userId,
        userName:    d.userName,
        userEmail:   d.userEmail,
        totalPoints: d.totalPoints ?? 0,
        lastUpdated: d.lastUpdated,
        ...(showBreakdown && { breakdown: d.breakdown ?? {} }),
        // expose cursorId so client can pass it for next page
        _docId:      doc.id,
      };
    });

    // Re-number rank correctly on first page
    if (!cursorId) {
      leaderboard.forEach((e, i) => { (e as any).rank = i + 1; });
    }

    const lastDoc  = snapshot.docs[snapshot.docs.length - 1];
    const hasMore  = snapshot.docs.length === limit;

    const payload = {
      success:     true,
      leaderboard,
      cached:      false,
      pagination: {
        limit,
        hasMore,
        nextCursor: hasMore ? lastDoc?.id : null,
      },
    };

    // ── Populate cache 
    cache.data[key] = { entries: leaderboard, cachedAt: now };

    // Evict stale cache keys to prevent unbounded memory growth
    for (const k of Object.keys(cache.data)) {
      if (now - cache.data[k].cachedAt > CACHE_TTL_MS * 2) {
        delete cache.data[k];
      }
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_TTL_MS / 1000}, stale-while-revalidate=30`,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/leaderboard error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}