// app/api/roar/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { User } from "@/app/models/RoarUser";
import type { BadgeProgress } from "@/app/models/BadgeProgress";
import type { Post } from "@/app/models/Post";

// ── Validation helpers ────────────────────────────────────────────────────────

function validateUsername(value: string): string | null {
  const v = value.trim();
  if (!v) return "Username is required.";
  if (v.length < 2) return "Username must be at least 2 characters.";
  if (v.length > 30) return "Username must be 30 characters or fewer.";
  if (!/^[A-Za-z0-9_]+$/.test(v))
    return "Username may only contain letters, numbers, and underscores.";
  return null;
}

function validateFavPlayer(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return null; // optional
  if (v.length > 60) return "Favourite player name must be 60 characters or fewer.";
  return null;
}

function validateAbout(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return null; // optional
  if (v.length > 300) return "About me must be 300 characters or fewer.";
  return null;
}

function validateAvatarUrl(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return null; // optional
  // Allow base64 data URIs (avatar picker) or standard https URLs
  if (
    !v.startsWith("data:image/") &&
    !v.startsWith("https://") &&
    !v.startsWith("http://")
  ) {
    return "Avatar must be a valid image URL or base64 data URI.";
  }
  return null;
}

// ── Resolve Firestore user doc ────────────────────────────────────────────────

async function resolveUserDoc(userId: string, email: string) {
  let docRef = db.collection("users").doc(email);
  let snap = await docRef.get();
  if (!snap.exists) {
    docRef = db.collection("users").doc(userId);
    snap = await docRef.get();
    if (!snap.exists) return null;
  }
  return { docRef, snap };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  console.log("Received GET /api/roar/profile request");
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await resolveUserDoc(user.userId, user.email);
    if (!resolved) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { docRef, snap } = resolved;
    const resolvedUserId = docRef.id; // the actual Firestore doc ID used

    const userData = snap.data() as User & {
      favPlayer?: string;
      about?: string;
      avatarUrl?: string;
    };

    if (!userData || !userData.username || !userData.badge) {
      return NextResponse.json(
        { error: "ROAR profile not onboarded", onboarded: false },
        { status: 404 },
      );
    }

    const [badgesSnap, postsSnap, rivalSnap] = await Promise.all([
      db
        .collection("roarBadges")
        .doc(resolvedUserId)
        .collection("roarProgress")
        .get(),
      db
        .collection("roarPosts")
        .where("authorUid", "==", resolvedUserId)
        .get(),
      db.collection("rivals").doc(resolvedUserId).get(),
    ]);

    const accuracy =
      userData.predictionCount > 0
        ? Math.round(
            (userData.correctPredictions / userData.predictionCount) * 100,
          )
        : 0;

    const allPosts = postsSnap.docs.map((d) => ({
      ...(d.data() as Post),
      postId: d.id,
    }));
    const sortedPosts = allPosts.sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    );
    const predictions = sortedPosts
      .filter((p) => p.type === "prediction")
      .slice(0, 20);
    const hotTakes = sortedPosts
      .filter((p) => p.type === "hot_take")
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      user: {
        ...userData,
        accuracy,
        // ── Editable profile fields — use the canonical names the frontend
        // expects (favPlayer, about, avatarUrl).  Fall back gracefully if the
        // old camelCase variants were stored by an earlier version.
        favPlayer:
          userData.favPlayer ??
          (userData as any).favouritePlayer ??
          null,
        about:
          userData.about ??
          (userData as any).aboutMe ??
          null,
        avatarUrl: userData.avatarUrl ?? null,
      },
      badges: badgesSnap.docs.map((d) => ({
        ...(d.data() as BadgeProgress),
        badgeId: d.id,
      })),
      predictions,
      hotTakes,
      rival: rivalSnap.exists ? rivalSnap.data() : null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // ── Validate every field that was sent ──────────────────────────────────
    const validationErrors: Record<string, string> = {};

    if (body.username !== undefined) {
      const err = validateUsername(String(body.username));
      if (err) validationErrors.username = err;
    }
    if (body.favPlayer !== undefined) {
      const err = validateFavPlayer(String(body.favPlayer));
      if (err) validationErrors.favPlayer = err;
    }
    if (body.about !== undefined) {
      const err = validateAbout(String(body.about));
      if (err) validationErrors.about = err;
    }
    if (body.avatarUrl !== undefined) {
      const err = validateAvatarUrl(String(body.avatarUrl));
      if (err) validationErrors.avatarUrl = err;
    }

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 422 },
      );
    }

    // ── Build the update payload ────────────────────────────────────────────
    // Original allowed fields kept exactly as-is
    const allowedPassthroughFields = [
      "username",
      "fcmToken",
      "settings",
      "teams",
      "sports",
    ];
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const field of allowedPassthroughFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    // New profile fields — store under the same names the frontend uses
    if (body.favPlayer !== undefined)
      updates.favPlayer = String(body.favPlayer).trim().slice(0, 60);
    if (body.about !== undefined)
      updates.about = String(body.about).trim().slice(0, 300);
    if (body.avatarUrl !== undefined)
      updates.avatarUrl = String(body.avatarUrl).trim();
    if (body.showPredHistory !== undefined)
      updates.showPredHistory = Boolean(body.showPredHistory);

    // Nothing meaningful to save?
    const meaningfulKeys = Object.keys(updates).filter((k) => k !== "updatedAt");
    if (meaningfulKeys.length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 },
      );
    }

    // ── Resolve the user's Firestore document ───────────────────────────────
    const resolved = await resolveUserDoc(user.userId, user.email);
    if (!resolved) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // ── Persist with merge so we never overwrite unrelated fields ───────────
    await resolved.docRef.set(updates, { merge: true });

    return NextResponse.json({
      success: true,
      updatedFields: meaningfulKeys,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("PATCH /api/roar/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
