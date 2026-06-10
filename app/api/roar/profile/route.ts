// app/api/roar/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { User } from "@/app/models/RoarUser";
import type { BadgeProgress } from "@/app/models/BadgeProgress";
import type { Post } from "@/app/models/Post";

// ── Validation helpers ────────────────────────────────────────────────────────

function validateDisplayName(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return null; // optional field — empty is fine
  if (v.length < 2) return "Display name must be at least 2 characters.";
  if (v.length > 60) return "Display name must be 60 characters or fewer.";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s'.\-_]+$/.test(v))
    return "Display name contains invalid characters.";
  return null;
}

function validateUsername(value: string): string | null {
  const v = value.trim();
  if (!v) return "Username is required.";
  if (v.length < 2) return "Username must be at least 2 characters.";
  if (v.length > 30) return "Username must be 30 characters or fewer.";
  if (!/^[A-Za-z0-9_]+$/.test(v))
    return "Username may only contain letters, numbers, and underscores.";
  return null;
}

function validateFavouritePlayer(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return null; // optional
  if (v.length > 60) return "Favourite player name must be 60 characters or fewer.";
  return null;
}

function validateAboutMe(value: string): string | null {
  const v = value.trim();
  if (v.length === 0) return null; // optional
  if (v.length > 300) return "About me must be 300 characters or fewer.";
  return null;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  console.log("Received GET /api/roar/profile request");
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let resolvedUserId = user.email;
    let userSnap = await db.collection("users").doc(user.email).get();
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }

    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const userData = userSnap.data() as User;
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
      db.collection("roarPosts").where("authorUid", "==", resolvedUserId).get(),
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
        // Explicitly surface the new editable fields so the frontend
        // can pre-fill them even if they weren't in the original User type
        displayName:      (userData as any).displayName      ?? null,
        favouritePlayer:  (userData as any).favouritePlayer  ?? null,
        aboutMe:          (userData as any).aboutMe          ?? null,
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
    if (body.displayName !== undefined) {
      const err = validateDisplayName(String(body.displayName));
      if (err) validationErrors.displayName = err;
    }
    if (body.favouritePlayer !== undefined) {
      const err = validateFavouritePlayer(String(body.favouritePlayer));
      if (err) validationErrors.favouritePlayer = err;
    }
    if (body.aboutMe !== undefined) {
      const err = validateAboutMe(String(body.aboutMe));
      if (err) validationErrors.aboutMe = err;
    }

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 422 },
      );
    }

    // ── Build the update payload ────────────────────────────────────────────
    // Original allowed fields kept exactly as-is
    const allowedFields = ["username", "fcmToken", "settings", "teams", "sports"];
    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    // New profile fields
    if (body.displayName !== undefined)
      updates.displayName = String(body.displayName).trim().slice(0, 60);
    if (body.favouritePlayer !== undefined)
      updates.favouritePlayer = String(body.favouritePlayer).trim().slice(0, 60);
    if (body.aboutMe !== undefined)
      updates.aboutMe = String(body.aboutMe).trim().slice(0, 300);

    // Nothing meaningful to save?
    const meaningfulKeys = Object.keys(updates).filter((k) => k !== "updatedAt");
    if (meaningfulKeys.length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 },
      );
    }

    // ── Resolve the user's Firestore document ───────────────────────────────
    let userDocRef = db.collection("users").doc(user.email);
    let userSnap = await userDocRef.get();
    if (!userSnap.exists) {
      userDocRef = db.collection("users").doc(user.userId);
      userSnap = await userDocRef.get();
    }
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // ── Persist with merge so we never overwrite unrelated fields ───────────
    await userDocRef.set(updates, { merge: true });

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
