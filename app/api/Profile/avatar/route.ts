// app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES  = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* ─────────────────────────────────────────
   POST /api/profile/avatar
   Uploads a new avatar image to Cloudinary
   and persists the URL in the User document.
───────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // ── Validate ──────────────────────────────────────────────────
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, or GIF images are allowed." },
        { status: 422 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image must be smaller than 5 MB." },
        { status: 422 }
      );
    }

    // ── Upload to Cloudinary ──────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);
    const base64      = buffer.toString("base64");
    const dataUri     = `data:${file.type};base64,${base64}`;

    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file:            dataUri,
          upload_preset:   process.env.CLOUDINARY_UPLOAD_PRESET,
          folder:          "sportsfan360/avatars",
          transformation:  [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
        }),
      }
    );

    if (!cloudRes.ok) {
      const err = await cloudRes.text();
      console.error("[avatar upload cloudinary]", err);
      return NextResponse.json({ error: "Image upload failed." }, { status: 502 });
    }

    const { secure_url: avatarUrl } = await cloudRes.json();

    // ── Persist URL in DB ─────────────────────────────────────────
    await connectDB();
    await User.findOneAndUpdate(
      { email: session.user.email },
      { $set: { avatar: avatarUrl } }
    );

    return NextResponse.json({ success: true, avatarUrl });
  } catch (err) {
    console.error("[POST /api/profile/avatar]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}