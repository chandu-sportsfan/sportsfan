// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions"; // adjust to your auth setup
import { connectDB } from "@/lib/mongodb";        // adjust to your DB util
import User from "@/models/User";                 // adjust to your User model

/* ─────────────────────────────────────────
   Validation helpers
───────────────────────────────────────── */

function isValidName(name: string): boolean {
  // No digits, no special chars except spaces/hyphens/apostrophes, 2-60 chars
  return /^[A-Za-z\s'\-]{2,60}$/.test(name.trim());
}

function isValidUrl(url: string): boolean {
  if (!url) return true; // optional field
  try {
    new URL(url.startsWith("http") ? url : `https://${url}`);
    return true;
  } catch {
    return false;
  }
}

function isValidLocation(loc: string): boolean {
  if (!loc) return true;
  return loc.length <= 80;
}

function isValidDescription(desc: string): boolean {
  if (!desc) return true;
  return desc.length <= 500;
}

function isValidSubtitle(sub: string): boolean {
  if (!sub) return true;
  return sub.length <= 160;
}

function sanitizeText(str: string): string {
  return str.trim().replace(/<[^>]*>/g, ""); // strip HTML tags
}

/* ─────────────────────────────────────────
   GET /api/profile
   Returns the current user's profile data
───────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email }).select(
      "name email avatar subtitle description location website joinedDate " +
      "stats interests favoriteTeams socialLinks handle"
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Derive handle from name if not stored
    const handle = user.handle || deriveHandle(user.name || "user");

    return NextResponse.json({
      name:          user.name || "",
      handle,
      avatar:        user.avatar || "",
      subtitle:      user.subtitle || "",
      description:   user.description || "",
      location:      user.location || "",
      joinedDate:    user.joinedDate || formatJoinDate(user.createdAt),
      website:       user.website || "",
      stats: {
        following:  user.stats?.following  ?? 0,
        followers:  user.stats?.followers  ?? 0,
        following2: user.stats?.following2 ?? 0,
      },
      interests:     user.interests     || [],
      favoriteTeams: user.favoriteTeams || [],
      socialLinks:   user.socialLinks   || [],
    });
  } catch (err) {
    console.error("[GET /api/profile]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────
   PUT /api/profile
   Updates editable profile fields
   Body: JSON with any subset of editable fields
───────────────────────────────────────── */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const errors: Record<string, string> = {};

    // ── Validate ──────────────────────────────────────────────────
    if (body.name !== undefined) {
      const n = sanitizeText(body.name);
      if (!isValidName(n)) {
        errors.name =
          "Name must be 2–60 characters and contain only letters, spaces, hyphens, or apostrophes (no numbers).";
      }
    }

    if (body.subtitle !== undefined && !isValidSubtitle(body.subtitle)) {
      errors.subtitle = "Subtitle must be 160 characters or fewer.";
    }

    if (body.description !== undefined && !isValidDescription(body.description)) {
      errors.description = "Description must be 500 characters or fewer.";
    }

    if (body.location !== undefined && !isValidLocation(body.location)) {
      errors.location = "Location must be 80 characters or fewer.";
    }

    if (body.website !== undefined && !isValidUrl(body.website)) {
      errors.website = "Website must be a valid URL.";
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    // ── Build update object ───────────────────────────────────────
    const update: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const cleanName = sanitizeText(body.name);
      update.name   = cleanName;
      update.handle = deriveHandle(cleanName);
    }
    if (body.subtitle    !== undefined) update.subtitle    = sanitizeText(body.subtitle);
    if (body.description !== undefined) update.description = sanitizeText(body.description);
    if (body.location    !== undefined) update.location    = sanitizeText(body.location);
    if (body.website     !== undefined) update.website     = sanitizeText(body.website);
    if (body.avatar      !== undefined) update.avatar      = body.avatar; // cloudinary URL
    if (body.interests   !== undefined) update.interests   = body.interests;

    await connectDB();

    const updated = await User.findOneAndUpdate(
      { email: session.user.email },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: {
        name:        updated.name,
        handle:      updated.handle || deriveHandle(updated.name),
        avatar:      updated.avatar || "",
        subtitle:    updated.subtitle || "",
        description: updated.description || "",
        location:    updated.location || "",
        website:     updated.website || "",
      },
    });
  } catch (err) {
    console.error("[PUT /api/profile]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function deriveHandle(name: string): string {
  const slug = name.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  return `@${slug || "user"}fan360`;
}

function formatJoinDate(date?: Date): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(date)
  );
}