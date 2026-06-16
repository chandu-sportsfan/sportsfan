// lib/awardPoints.ts
//
// Thin client-side wrapper around POST /api/award-points.
//
// Import this wherever a user completes an activity and you need to award SXP.
// It is intentionally simple: call it, get back the awarded points.
//
// Usage examples
// ──────────────
//
//   // ROAR post created
//   await awardPoints({ userId, activityType: "ROAR_POST", metadata: { postId } });
//
//   // Trivia answered correctly
//   await awardPoints({ userId, activityType: "TRIVIA_CORRECT", metadata: { question } });
//
//   // Fan Battle won — supply a stable transactionId to stay idempotent
//   await awardPoints({
//     userId,
//     activityType:  "FAN_BATTLE_WIN",
//     transactionId: `battle_${battleId}_winner`,
//     metadata:      { battleId, opponent: opponentName },
//   });
//
//   // Registration — call once right after account creation
//   await awardPoints({
//     userId,
//     activityType:  "REGISTRATION",
//     transactionId: `registration_${userId}`,
//   });
//
//   // Invite accepted — triggered when the referred user completes registration
//   await awardPoints({
//     userId:        referrerId,       // the person who sent the invite
//     activityType:  "INVITE_ACCEPTED",
//     transactionId: `invite_${newUserId}`,
//     metadata:      { friendName: newUserName },
//   });

export interface AwardPointsParams {
  /** The auth uid or Firestore doc id of the user earning the points */
  userId: string;

  /**
   * The activity type enum.  Must match a key in ACTIVITY_POINTS_MAP on the server.
   * e.g. "ROAR_POST", "TRIVIA_CORRECT", "FAN_BATTLE_WIN", "REGISTRATION"
   */
  activityType: string;

  /**
   * Optional extra context stored in the activityLog and displayed in FanZone.
   * Include things like postId, battleId, question text, opponent name, etc.
   */
  metadata?: Record<string, unknown>;

  /**
   * Optional stable transaction ID for idempotency.
   * If the same transactionId is submitted twice, points are only awarded once.
   * Recommended for all activities that have a natural unique ID (post, battle, etc.)
   */
  transactionId?: string;

  /**
   * Override the default point value from the server's ACTIVITY_POINTS_MAP.
   * Only use this for activities with variable point values.
   */
  points?: number;
}

export interface AwardPointsResult {
  success:        boolean;
  points:         number;          // 0 if already awarded or error
  alreadyAwarded: boolean;         // true if the transactionId was a duplicate
  activityType:   string;
  activityLabel:  string;
  error?:         string;
}

/**
 * Award SXP to a user for completing an activity.
 *
 * This function never throws — errors are returned in the result object so
 * callers don't need try/catch unless they want to handle specific cases.
 */
export async function awardPoints(
  params: AwardPointsParams
): Promise<AwardPointsResult> {
  const { userId, activityType, metadata, transactionId, points } = params;

  try {
    const res = await fetch("/api/award-points", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId, activityType, metadata, transactionId, points }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      console.error("[awardPoints] server error:", data.error);
      return {
        success:        false,
        points:         0,
        alreadyAwarded: false,
        activityType,
        activityLabel:  activityType,
        error:          data.error || "Unknown error",
      };
    }

    return {
      success:        true,
      points:         data.points,
      alreadyAwarded: data.alreadyAwarded,
      activityType:   data.activityType,
      activityLabel:  data.activityLabel,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    console.error("[awardPoints] fetch error:", message);
    return {
      success:        false,
      points:         0,
      alreadyAwarded: false,
      activityType,
      activityLabel:  activityType,
      error:          message,
    };
  }
}

// ─── Convenience wrappers (optional, improves call-site readability) ──────────

export const awardROARPost       = (userId: string, postId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "ROAR_POST",       transactionId: `roar_post_${postId}`,       metadata: { postId, ...extra } });

export const awardROARHotTake    = (userId: string, postId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "ROAR_HOT_TAKE",   transactionId: `roar_hottake_${postId}`,    metadata: { postId, ...extra } });

export const awardROARPrediction = (userId: string, postId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "ROAR_PREDICTION", transactionId: `roar_prediction_${postId}`, metadata: { postId, ...extra } });

export const awardROARDebate     = (userId: string, postId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "ROAR_DEBATE",     transactionId: `roar_debate_${postId}`,     metadata: { postId, ...extra } });

export const awardROARMemory     = (userId: string, postId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "ROAR_MEMORY",     transactionId: `roar_memory_${postId}`,     metadata: { postId, ...extra } });

export const awardFanBattleWin   = (userId: string, battleId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "FAN_BATTLE_WIN",  transactionId: `battle_win_${battleId}`,    metadata: { battleId, ...extra } });

export const awardFanBattlePlay  = (userId: string, battleId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "FAN_BATTLE_PLAY", transactionId: `battle_play_${battleId}`,   metadata: { battleId, ...extra } });

export const awardTrivia         = (userId: string, questionId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "TRIVIA_CORRECT",  transactionId: `trivia_${questionId}`,      metadata: { questionId, ...extra } });

export const awardPostCreated    = (userId: string, postId: string, extra?: Record<string, unknown>) =>
  awardPoints({ userId, activityType: "POST_CREATED",    transactionId: `post_${postId}`,            metadata: { postId, ...extra } });

export const awardRegistration   = (userId: string) =>
  awardPoints({ userId, activityType: "REGISTRATION",    transactionId: `registration_${userId}` });

export const awardInviteAccepted = (referrerId: string, newUserId: string, newUserName?: string) =>
  awardPoints({
    userId:        referrerId,
    activityType:  "INVITE_ACCEPTED",
    transactionId: `invite_${newUserId}`,
    metadata:      { friendName: newUserName, newUserId },
  });