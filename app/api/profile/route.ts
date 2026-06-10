// app/api/profile/route.ts  — CORRECTED
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db } from "@/lib/firebaseAdmin";
import cloudinary from "@/lib/cloudinary";


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
     
    }
  }

  return null;
}


export async function GET(req: NextRequest) {
  try {
    const authUser = await getUser(req);
    if (!authUser) {
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

  followers:   data.followers   ?? 0,
  following:   data.following   ?? 0,

  connections: data.connections ?? null,
};
    void isOwnProfile; // suppress "unused variable" lint warning

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
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

    
      const formData = await req.formData();
    const name = formData.get("name");
const subtitle = formData.get("subtitle");
const description = formData.get("description");
const location = formData.get("location");
const website = formData.get("website");

const profilePicture =
  formData.get("profilePicture") as File | null;
    const validationErrors: Record<string, string> = {};

    if (name !== undefined) {
      const err = validateName(String(name));
      if (err) validationErrors.name = err;
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
    

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        { error: "Validation failed", fields: validationErrors },
        { status: 422, headers: { "Cache-Control": "no-store" } }
      );
    }

    // ── Build update payload ──────────────────────────────────────────────────
    const updateData: Record<string, unknown> = {};
    if (
  profilePicture &&
  profilePicture.size > 0
) {
  const bytes =
    await profilePicture.arrayBuffer();

  const buffer =
    Buffer.from(bytes);

  const base64 =
    `data:${profilePicture.type};base64,${buffer.toString("base64")}`;

  const uploadRes =
    await cloudinary.uploader.upload(
      base64,
      {
        folder:
          "profile-images",
      }
    );

  updateData.avatarUrl =
    uploadRes.secure_url;
}

    if (name        !== undefined) updateData.name        = String(name).trim().slice(0, 60);
    if (subtitle    !== undefined) updateData.subtitle    = String(subtitle).trim().slice(0, 160);
    if (description !== undefined) updateData.description = String(description).trim().slice(0, 500);
    if (location    !== undefined) updateData.location    = String(location).trim().slice(0, 80);
    if (website     !== undefined) updateData.website     = String(website).trim().slice(0, 200);
    // if (avatarUrl   !== undefined) updateData.avatarUrl   = String(avatarUrl).trim();

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
  updateData.createdAt = now;

  updateData.joinedDate =
    new Date().toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    );

  updateData.role =
    updateData.role ?? "user";

  updateData.followers = 0;
  updateData.following = 0;
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
