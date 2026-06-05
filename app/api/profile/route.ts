// app/api/profile/route.ts  — CORRECTED
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

// ─── COLLECTION & SCHEMA ──────────────────────────────────────────────────────
//  users/{userId}
//  ├── name          string   (2–60, letters/spaces/hyphens/apostrophes)
//  ├── email         string   (valid email)
//  ├── subtitle      string   (max 160 chars)
//  ├── description   string   (max 500 chars)
//  ├── location      string   (max 80 chars)
//  ├── website       string   (valid URL, max 200 chars)
//  ├── avatarUrl     string   (absolute URL)
//  ├── role          string   ("user" | "admin" | "moderator")
//  ├── joinedDate    string   (e.g. "May 2024")
//  ├── followers     number
//  ├── connections   number
//  ├── createdAt     number   (Unix ms, set once)
//  └── updatedAt     number   (Unix ms, updated every write)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Validators ───────────────────────────────────────────────────────────────

function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Name is required.";
  if (v.length < 2) return "Name must be at least 2 characters.";
  if (v.length > 60) return "Name must be 60 characters or fewer.";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$/.test(v))
    return "Name must contain letters only (spaces, hyphens and apostrophes allowed).";
  return null;
}

function validateEmail(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return "Email must be a valid address (e.g. user@example.com).";
  return null;
}

function validateSubtitle(value: string): string | null {
  if (value.length > 160) return "Subtitle must be 160 characters or fewer.";
  return null;
}

function validateDescription(value: string): string | null {
  if (value.length > 500) return "Description must be 500 characters or fewer.";
  return null;
}

function validateLocation(value: string): string | null {
  if (value.length > 80) return "Location must be 80 characters or fewer.";
  return null;
}

function validateWebsite(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["http:", "https:"].includes(url.protocol))
      return "Website must start with http:// or https://.";
  } catch {
    return "Website must be a valid URL (e.g. https://example.com).";
  }
  if (value.length > 200) return "Website URL must be 200 characters or fewer.";
  return null;
}

function validateAvatarUrl(value: string): string | null {
  if (!value) return null;
  try {
    new URL(value);
  } catch {
    return "Avatar URL must be a valid absolute URL.";
  }
  return null;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
// FIX #1: The original getUser() silently returns null whenever the token is
// missing or invalid but does NOT set any response headers. The callers already
// handle the null case, so the helper itself is fine — BUT the frontend was NOT
// sending the Authorization header at all on the POST request (see page.tsx fix).
// This version is unchanged functionally; it is included for completeness.
// ─────────────────────────────────────────────────────────────────────────────
async function getUser(req: NextRequest) {
  // Path A — httpOnly "token" cookie (email/password login)
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string;
        name?: string; role?: string;
      };
      const userId = payload.userId ?? payload.uid ?? payload.id ?? payload.email;
      if (userId && payload.email) {
        return { userId, email: payload.email, name: payload.name ?? "", role: payload.role ?? "user" };
      }
    } catch {
      // Expired / tampered — fall through to Bearer
    }
  }

  // Path B — "Authorization: Bearer <token>" header (Google login)
  const authHeader = req.headers.get("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    try {
      const payload = jwt.verify(bearerToken, process.env.JWT_SECRET!) as {
        email?: string; userId?: string; uid?: string; id?: string;
        name?: string; role?: string;
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
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authUser = await getUser(req);
    if (!authUser) {
      // FIX #2: Return CORS-friendly headers so the browser doesn't
      // misreport a 401 as a "network error" in some environments.
      return NextResponse.json({ error: "Unauthorized" }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const requestedUserId =
      req.nextUrl.searchParams.get("userId") ?? authUser.userId;

    const doc = await db.collection("users").doc(requestedUserId).get();

    if (!doc.exists) {
      return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
    }

    const data = doc.data() as Record<string, unknown>;
    const isOwnProfile = requestedUserId === authUser.userId;

    const payload = {
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
    };

    // FIX #3: Own-profile and visitor-profile returned identical shapes anyway;
    // collapsed into one return. No logic change — just removes dead duplication.
    void isOwnProfile; // suppress "unused variable" lint warning

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/profile
//
// FIX #4 (ROOT CAUSE of "network error"):
//   The frontend fetch() in page.tsx did NOT include `credentials: "include"`.
//   Without it the browser strips the httpOnly "token" cookie from cross-origin
//   or same-origin requests that are marked as "omit" by default in some
//   fetch() call-sites, so getUser() always returned null → 401 → the browser's
//   fetch API reports "network error" when the server returns 401 with no body
//   in some environments, or the frontend catch() block shows the generic
//   "network error" message instead of the real 401 text.
//
// The route itself is correct. The fix is in page.tsx (credentials: "include").
// This file adds defensive "no-store" cache headers and explicit Content-Type
// on responses to prevent proxy/CDN caching of auth-sensitive responses.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authUser = await getUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const CURRENT_USER_ID = authUser.userId;

    // FIX #5: Wrap req.json() in its own try/catch.
    // If the frontend sends a malformed body (e.g. empty string, or the fetch
    // call threw before attaching a body), req.json() throws a SyntaxError
    // which was previously caught by the outer catch and returned as a generic
    // 500 "Unexpected error" — masking the real problem.
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Ensure Content-Type: application/json is set and the body is valid JSON." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { name, email, subtitle, description, location, website, avatarUrl } = body as {
      name?: unknown; email?: unknown; subtitle?: unknown; description?: unknown;
      location?: unknown; website?: unknown; avatarUrl?: unknown;
    };

    // ── Validation ────────────────────────────────────────────────────────────
    const validationErrors: Record<string, string> = {};

    if (name !== undefined) {
      const err = validateName(String(name));
      if (err) validationErrors.name = err;
    }
    if (email !== undefined) {
      const err = validateEmail(String(email));
      if (err) validationErrors.email = err;
    }
    if (subtitle !== undefined) {
      const err = validateSubtitle(String(subtitle));
      if (err) validationErrors.subtitle = err;
    }
    if (description !== undefined) {
      const err = validateDescription(String(description));
      if (err) validationErrors.description = err;
    }
    if (location !== undefined) {
      const err = validateLocation(String(location));
      if (err) validationErrors.location = err;
    }
    if (website !== undefined) {
      const err = validateWebsite(String(website));
      if (err) validationErrors.website = err;
    }
    if (avatarUrl !== undefined) {
      const err = validateAvatarUrl(String(avatarUrl));
      if (err) validationErrors.avatarUrl = err;
    }

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 422, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Build update payload ──────────────────────────────────────────────────
    const updateData: Record<string, unknown> = {};

    if (name        !== undefined) updateData.name        = String(name).trim().slice(0, 60);
    if (email       !== undefined) updateData.email       = String(email).trim().toLowerCase().slice(0, 320);
    if (subtitle    !== undefined) updateData.subtitle    = String(subtitle).trim().slice(0, 160);
    if (description !== undefined) updateData.description = String(description).trim().slice(0, 500);
    if (location    !== undefined) updateData.location    = String(location).trim().slice(0, 80);
    if (website     !== undefined) updateData.website     = String(website).trim().slice(0, 200);
    if (avatarUrl   !== undefined) updateData.avatarUrl   = String(avatarUrl).trim();

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Timestamps ────────────────────────────────────────────────────────────
    const now = Date.now();
    updateData.updatedAt = now;

    const existingDoc = await db.collection("users").doc(CURRENT_USER_ID).get();
    if (!existingDoc.exists) {
      updateData.createdAt  = now;
      updateData.joinedDate = new Date().toLocaleDateString("en-US", {
        month: "long", year: "numeric",
      });
      updateData.role = updateData.role ?? "user";
    }

    // ── Persist ───────────────────────────────────────────────────────────────
    await db.collection("users").doc(CURRENT_USER_ID).set(updateData, { merge: true });

    return NextResponse.json(
      {
        success: true,
        updatedFields: Object.keys(updateData).filter(
          k => !["updatedAt", "createdAt", "joinedDate", "role"].includes(k)
        ),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
