// app/api/award-points/route.ts
//
// Universal "award points" endpoint.
//
// Any feature in the app (ROAR, Trivia, Fan Battles, Registration, etc.) calls
// this route when a user earns points.  It is intentionally generic so that
// new activity types can be added to ACTIVITY_POINTS_MAP without touching any
// other file.
//
// Audio Drops already have their own dedicated route; this endpoint handles
// every other activity type.  You may optionally consolidate both routes into
// this one later.
//
// POST /api/award-points
// Body (JSON):
//   {
//     userId:        string,           // required — auth uid or Firestore doc id
//     activityType:  string,           // required — e.g. "ROAR_POST", "TRIVIA_CORRECT"
//     metadata?:     object,           // optional — any extra context to log
//     transactionId?: string,          // optional — supply for idempotency; auto-generated if omitted
//   }
//
// Response (JSON):
//   { success: true,  points: number, alreadyAwarded: boolean }   on success
//   { success: false, error: string }                             on failure

import { NextRequest, NextResponse } from "next/server";
import { getUserInfo, awardUserPoints, getActivityLabel } from "@/lib/userPoints";

// ─── Points table ─────────────────────────────────────────────────────────────
// Canonical points for every activity type.
// If a caller supplies an explicit `points` value in the body, that overrides
// this table (useful for variable-point activities like ranked battles).
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_POINTS_MAP: Record<string, number> = {
  FAN_BATTLE_WIN:  50,
  FAN_BATTLE_PLAY: 10,
  POST_CREATED:    15,
  TRIVIA_CORRECT:  10,
  REGISTRATION:   100,
  INVITE_ACCEPTED: 100,
  ROAR_HOT_TAKE:    2,
  ROAR_PREDICTION:  2,
  ROAR_DEBATE:      2,
  ROAR_MEMORY:      2,
  ROAR_POST:        2,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      activityType,
      metadata = {},
      transactionId: suppliedTxId,
      points: suppliedPoints,
    } = body as {
      userId:         string;
      activityType:   string;
      metadata?:      Record<string, unknown>;
      transactionId?: string;
      points?:        number;
    };

    // ── Validation ─────────────────────────────────────────────────────────
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }
    if (!activityType || typeof activityType !== "string") {
      return NextResponse.json(
        { success: false, error: "activityType is required" },
        { status: 400 }
      );
    }

    const normalizedType = activityType.toUpperCase().replace(/-/g, "_");

    const points =
      typeof suppliedPoints === "number" && suppliedPoints > 0
        ? suppliedPoints
        : ACTIVITY_POINTS_MAP[normalizedType];

    if (!points || points <= 0) {
      return NextResponse.json(
        { success: false, error: `Unknown or zero-point activityType: ${activityType}` },
        { status: 400 }
      );
    }

    // ── Resolve user ────────────────────────────────────────────────────────
    const { userName, userEmail, exists, actualUserId, authUserId } =
      await getUserInfo(
        userId,
        (metadata.userName as string) || undefined,
        (metadata.userEmail as string) || undefined
      );

    // ── Build transaction ID ────────────────────────────────────────────────
    // Callers should supply a stable ID (e.g. postId, battleId) so the endpoint
    // is idempotent.  If none is supplied we generate a time-based one that is
    // NOT idempotent — suitable only for one-shot actions.
    const transactionId =
      suppliedTxId ||
      `${normalizedType}_${actualUserId}_${Date.now()}`;

    // ── Derive human-readable label ─────────────────────────────────────────
    const activityLabel = getActivityLabel(normalizedType, metadata);

    // ── Award points (atomic Firestore batch) ───────────────────────────────
    const awarded = await awardUserPoints({
      actualUserId,
      authUserId,
      userName,
      userEmail,
      userExists: exists,
      points,
      reason: normalizedType,
      transactionId,
      metadata: {
        ...metadata,
        activityType:  normalizedType,
        activityLabel,
        source:        normalizedType,
      },
    });

    return NextResponse.json({
      success:        true,
      points:         awarded ? points : 0,
      alreadyAwarded: !awarded,
      activityType:   normalizedType,
      activityLabel,
    });
  } catch (err) {
    console.error("[award-points] error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}