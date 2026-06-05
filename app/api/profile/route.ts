// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

// ─── Auth helper (mirrors /api/chats pattern) ─────────────────────────────────
// Path A — Email/password: httpOnly "token" cookie
// Path B — Google users:   "Authorization: Bearer <token>" header
// ─────────────────────────────────────────────────────────────────────────────
async function getUser(req: NextRequest) {
  // ── Path A: JWT cookie ────────────────────────────────────────────────────
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET!) as {
        email?: string;
        userId?: string;
        uid?: string;
        id?: string;
        name?: string;
        role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
      }
    } catch {
      // Expired or tampered — fall through to Bearer
    }
  }

  // ── Path B: Bearer token (Google users) ───────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(bearerToken, process.env.JWT_SECRET!) as {
        email?: string;
        userId?: string;
        uid?: string;
        id?: string;
        name?: string;
        role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
      }
    } catch {
      // Invalid token
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/profile
//
// Two modes:
//   ?userId=<id>  — public profile view (any authenticated user can fetch any
//                   profile; returns all public fields)
//   no param      — returns the authenticated user's own profile
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authUser = await getUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If ?userId is provided, fetch that profile (visitor view).
    // Otherwise fall back to the authenticated user's own profile.
    const requestedUserId =
      req.nextUrl.searchParams.get("userId") ?? authUser.userId;

    const doc = await db.collection("users").doc(requestedUserId).get();

    if (!doc.exists) {
      // Return empty object — profile page shows defaults for new users
      return NextResponse.json({});
    }

    const data = doc.data() as Record<string, unknown>;

    // ── Decide which fields to expose ────────────────────────────────────────
    // Own profile → full data (edit form needs all fields)
    // Visitor view → public fields only (no private metadata)
    const isOwnProfile = requestedUserId === authUser.userId;

    if (isOwnProfile) {
      return NextResponse.json({
        name:        data.name        ?? null,
        subtitle:    data.subtitle    ?? null,
        description: data.description ?? null,
        location:    data.location    ?? null,
        website:     data.website     ?? null,
        avatarUrl:   data.avatarUrl   ?? null,
        joinedDate:  data.joinedDate  ?? null,
        role:        data.role        ?? null,
        // Stats stored on the user doc (written by other services)
        followers:   data.followers   ?? null,
        connections: data.connections ?? null,
      });
    }

    // Public/visitor view — same fields minus anything sensitive
    return NextResponse.json({
      name:        data.name        ?? null,
      subtitle:    data.subtitle    ?? null,
      description: data.description ?? null,
      location:    data.location    ?? null,
      website:     data.website     ?? null,
      avatarUrl:   data.avatarUrl   ?? null,
      joinedDate:  data.joinedDate  ?? null,
      role:        data.role        ?? null,
      followers:   data.followers   ?? null,
      connections: data.connections ?? null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile
//
// Authenticated users can only update their OWN profile.
// userId is taken from the verified JWT — never trusted from the request body.
//
// Body (all fields optional except the route needs at least one):
//   { name, subtitle, description, location, website, avatarUrl }
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authUser = await getUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // userId always comes from the verified token — body value is intentionally ignored
    const CURRENT_USER_ID = authUser.userId;

    const body = await req.json();
    const { name, subtitle, description, location, website, avatarUrl } = body;

    // Build update payload — only include fields that were actually sent
    const updateData: Record<string, unknown> = {};
    if (name        !== undefined) updateData.name        = String(name).trim().slice(0, 60);
    if (subtitle    !== undefined) updateData.subtitle    = String(subtitle).trim().slice(0, 160);
    if (description !== undefined) updateData.description = String(description).trim().slice(0, 500);
    if (location    !== undefined) updateData.location    = String(location).trim().slice(0, 80);
    if (website     !== undefined) updateData.website     = String(website).trim().slice(0, 200);
    if (avatarUrl   !== undefined) updateData.avatarUrl   = String(avatarUrl).trim();

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Stamp the last-updated time
    updateData.updatedAt = Date.now();

    await db.collection("users").doc(CURRENT_USER_ID).set(updateData, { merge: true });

    return NextResponse.json({ success: true, updatedFields: Object.keys(updateData) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
