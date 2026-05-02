// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "An unknown error occurred";
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
  rankChange?: number;
}

interface PollMeta {
  correctOptionId: string | null;
  points: number;
  type: string;
}

interface UserStats {
  totalPoints: number;
  correct: number;
  total: number;
}

// ─── GET /api/leaderboard ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope   = searchParams.get("scope") ?? "global";
    const matchId = searchParams.get("matchId");
    const limit   = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const userId  = searchParams.get("userId");

    const now = new Date();

    // ── 1. Fetch all polls (including active ones that have expired) ─────────
    let pollQuery: FirebaseFirestore.Query = db.collection("polls");

    if (scope === "match" && matchId) {
      pollQuery = pollQuery.where("matchId", "==", matchId);
    }

    const pollSnap = await pollQuery.get();

    if (pollSnap.empty) {
      return NextResponse.json({
        success: true,
        data: { entries: [], totalParticipants: 0, currentUser: null },
      });
    }

    // Build a map: pollId → PollMeta (only for resolved polls)
    const pollMeta: Record<string, PollMeta> = {};

    for (const doc of pollSnap.docs) {
      const d = doc.data();
      const endsAt = d.endsAt instanceof Timestamp ? d.endsAt.toDate() : null;
      
      // Poll is resolved if: active=false OR endsAt date has passed
      const isResolved = !d.active || (endsAt && endsAt <= now);
      
      if (!isResolved) continue; // Skip active polls that haven't ended
      
      const correctOpt = (d.options as { id: string; isCorrect?: boolean }[]).find(
        (o) => o.isCorrect
      );
      
      pollMeta[doc.id] = {
        correctOptionId: correctOpt?.id ?? null,
        points: d.points ?? (d.type === "quiz" ? 10 : 5),
        type: d.type,
      };
    }

    const pollIds = Object.keys(pollMeta);

    if (pollIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { entries: [], totalParticipants: 0, currentUser: null },
      });
    }

    // ── 2. Fetch all votes for those polls ────────────────────────────────
    const chunkSize = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < pollIds.length; i += chunkSize) {
      chunks.push(pollIds.slice(i, i + chunkSize));
    }

    const allVotes: { pollId: string; userId: string; optionId: string }[] = [];

    for (const chunk of chunks) {
      const voteSnap = await db
        .collection("pollVotes")
        .where("pollId", "in", chunk)
        .get();

      for (const v of voteSnap.docs) {
        const d = v.data();
        allVotes.push({
          pollId: d.pollId,
          userId: d.userId,
          optionId: d.optionId,
        });
      }
    }

    // ── 3. Tally points per user ──────────────────────────────────────────
    const userStats: Record<string, UserStats> = {};

    for (const vote of allVotes) {
      const meta = pollMeta[vote.pollId];
      if (!meta) continue;

      if (!userStats[vote.userId]) {
        userStats[vote.userId] = { totalPoints: 0, correct: 0, total: 0 };
      }

      userStats[vote.userId].total += 1;

      if (meta.type === "quiz") {
        if (vote.optionId === meta.correctOptionId) {
          userStats[vote.userId].totalPoints += meta.points;
          userStats[vote.userId].correct += 1;
        }
      } else {
        // Participation points for plain polls
        userStats[vote.userId].totalPoints += meta.points;
        userStats[vote.userId].correct += 1;
      }
    }

    // ── 4. Fetch usernames from a `users` collection (if you have one) ────
    const uniqueUserIds = Object.keys(userStats);
    const usernameMap: Record<string, string> = {};

    if (uniqueUserIds.length > 0) {
      const userChunks: string[][] = [];
      for (let i = 0; i < uniqueUserIds.length; i += chunkSize) {
        userChunks.push(uniqueUserIds.slice(i, i + chunkSize));
      }

      for (const chunk of userChunks) {
        try {
          const userSnap = await db
            .collection("users")
            .where("__name__", "in", chunk)
            .get();
          for (const u of userSnap.docs) {
            const d = u.data();
            usernameMap[u.id] = d.username ?? d.displayName ?? u.id;
          }
        } catch {
          // users collection may not exist — skip silently
        }
      }
    }

    // ── 5. Sort & rank ────────────────────────────────────────────────────
    const sorted = Object.entries(userStats)
      .map(([uid, stats]) => ({
        userId: uid,
        username: usernameMap[uid] ?? uid,
        totalPoints: stats.totalPoints,
        correctPredictions: stats.correct,
        totalPredictions: stats.total,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.correctPredictions - a.correctPredictions);

    const totalParticipants = sorted.length;

    // Assign ranks (ties share rank)
    const ranked: (typeof sorted[0] & { rank: number })[] = [];
    let rank = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].totalPoints < sorted[i - 1].totalPoints) {
        rank = i + 1;
      }
      ranked.push({ ...sorted[i], rank });
    }

    // Top N for the response
    const entries = ranked.slice(0, limit);

    // Caller's own entry (may be outside top N)
    let currentUser: (typeof ranked[0]) | null = null;
    if (userId) {
      currentUser = ranked.find((e) => e.userId === userId) ?? null;
    }

    return NextResponse.json({
      success: true,
      data: {
        entries,
        totalParticipants,
        currentUser,
      },
    });
  } catch (err: unknown) {
    console.error("Leaderboard error:", err);
    return NextResponse.json(
      { success: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}