// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";

// ─── COLLECTION & SCHEMA DEFINITION ─────────────────────────────────────────
// Firebase doesn't need manual schema creation like SQL, but we enforce shape
// here. The "users" collection is auto-created by Firestore on first write.
// Every document follows this canonical structure:
//
//  users/{userId}
//  ├── name          string   – display name (2–60 letters/spaces/hyphens/apostrophes)
//  ├── email         string   – valid email (must contain @)
//  ├── subtitle      string   – short bio, max 160 chars
//  ├── description   string   – about text, max 500 chars
//  ├── location      string   – city/country, max 80 chars
//  ├── website       string   – valid URL, max 200 chars
//  ├── avatarUrl     string   – absolute URL to profile image
//  ├── role          string   – "user" | "admin" | "moderator"
//  ├── joinedDate    string   – human-readable, e.g. "May 2024"
//  ├── followers     number
//  ├── connections   number
//  ├── createdAt     number   – Unix ms timestamp (set once on first write)
//  └── updatedAt     number   – Unix ms timestamp (updated on every write)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Data-quality validators ─────────────────────────────────────────────────

/** Returns an error string if invalid, or null if OK. */
function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return "Name is required.";
  if (v.length < 2) return "Name must be at least 2 characters.";
  if (v.length > 60) return "Name must be 60 characters or fewer.";
  // Letters, spaces, hyphens, apostrophes only — no digits or other special chars
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'\-]+$/.test(v))
    return "Name must contain letters only (spaces, hyphens and apostrophes allowed).";
  return null;
}

function validateEmail(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return "Email is required.";
  // Must contain exactly one @, with something before and after, and a dot in the domain
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
  if (!value) return null; // optional field
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
  if (!value) return null; // optional field
  try {
    new URL(value);
  } catch {
    return "Avatar URL must be a valid absolute URL.";
  }
  return null;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
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
        return {
          userId,
          email: payload.email,
          name: payload.name ?? "",
          role: payload.role ?? "user",
        };
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
        return {
          userId,
          email: payload.email,
          name: payload.name ?? "",
          role: payload.role ?? "user",
        };
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
        followers:   data.followers   ?? null,
        connections: data.connections ?? null,
      });
    }

    // Public/visitor view — same fields (email and timestamps excluded)
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
// Creates the "users" collection entry on first save (Firestore does this
// automatically), and merges updates on subsequent saves.
//
// userId is always taken from the verified JWT — never from the request body.
//
// Body (all fields optional; at least one must be present):
//   { name, email, subtitle, description, location, website, avatarUrl }
//
// Validation rules applied server-side (mirrors client-side checks):
//   • name    — required, 2–60 chars, letters/spaces/hyphens/apostrophes only
//   • email   — must contain "@" and follow basic email pattern
//   • subtitle    — max 160 chars
//   • description — max 500 chars
//   • location    — max 80 chars
//   • website     — valid URL if provided
//   • avatarUrl   — valid absolute URL if provided
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authUser = await getUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // userId always comes from the verified token — body value intentionally ignored
    const CURRENT_USER_ID = authUser.userId;

    const body = await req.json();
    const { name, email, subtitle, description, location, website, avatarUrl } = body;

    // ── Run data-quality checks ───────────────────────────────────────────────
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
        { status: 422 }
      );
    }

    // ── Build update payload (only include fields actually sent) ─────────────
    const updateData: Record<string, unknown> = {};

    if (name        !== undefined) updateData.name        = String(name).trim().slice(0, 60);
    if (email       !== undefined) updateData.email       = String(email).trim().toLowerCase().slice(0, 320);
    if (subtitle    !== undefined) updateData.subtitle    = String(subtitle).trim().slice(0, 160);
    if (description !== undefined) updateData.description = String(description).trim().slice(0, 500);
    if (location    !== undefined) updateData.location    = String(location).trim().slice(0, 80);
    if (website     !== undefined) updateData.website     = String(website).trim().slice(0, 200);
    if (avatarUrl   !== undefined) updateData.avatarUrl   = String(avatarUrl).trim();

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    // ── Stamp timestamps ──────────────────────────────────────────────────────
    const now = Date.now();
    updateData.updatedAt = now;

    // Check if the document already exists; if not, stamp createdAt too.
    // This is the "create the users collection" step your instructor mentioned:
    // Firestore auto-creates the collection and document on the first write.
    const existingDoc = await db.collection("users").doc(CURRENT_USER_ID).get();
    if (!existingDoc.exists) {
      updateData.createdAt = now;
      // Stamp the joinedDate on first creation (human-readable)
      updateData.joinedDate = new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
      // Default role for new users
      updateData.role = updateData.role ?? "user";
    }

    // ── Write to Firestore (merge: true keeps untouched fields intact) ────────
    await db.collection("users").doc(CURRENT_USER_ID).set(updateData, { merge: true });

    return NextResponse.json({
      success: true,
      updatedFields: Object.keys(updateData).filter(
        k => !["updatedAt", "createdAt"].includes(k)
      ),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
