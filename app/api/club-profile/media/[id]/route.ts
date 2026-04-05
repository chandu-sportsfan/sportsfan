import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { db } from "@/lib/firebaseAdmin";

// ─── GET: Single Media Doc ────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await db.collection("clubMedia").doc(params.id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: "Media not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, media: { id: doc.id, ...doc.data() } });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Fetch failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

type MediaItem = {
  title: string;
  views: string;
  time: string;
  thumbnail: string;
};

// ─── PUT: Update Media Doc ────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await req.formData();

    const existing = await db.collection("clubMedia").doc(params.id).get();
    if (!existing.exists) {
      return NextResponse.json(
        { success: false, message: "Media not found" },
        { status: 404 }
      );
    }

    const existingData = existing.data() as Record<string, unknown>;

    const titles = formData.getAll("titles") as string[];
    const viewsCounts = formData.getAll("views") as string[];
    const times = formData.getAll("times") as string[];
    const thumbnailFiles = formData.getAll("thumbnails") as File[];
    const existingThumbnails = formData.getAll("existingThumbnails") as string[];

    const mediaItems: MediaItem[] = [];

    for (let i = 0; i < titles.length; i++) {
      const title = titles[i] || `Media ${i + 1}`;
      const views = viewsCounts[i] || "0";
      const time = times[i] || "";

      let thumbnailUrl = existingThumbnails[i] || "";

      if (thumbnailFiles[i] && thumbnailFiles[i].size > 0) {
        const bytes = await thumbnailFiles[i].arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = `data:${thumbnailFiles[i].type};base64,${buffer.toString("base64")}`;
        const uploadRes = await cloudinary.uploader.upload(base64, {
          folder: `club-profiles/${existingData.clubProfileId}/media/thumbnails`,
          public_id: `${Date.now()}-thumbnail-${thumbnailFiles[i].name.replace(/\s/g, "_")}`,
        });
        thumbnailUrl = uploadRes.secure_url;
      }

      mediaItems.push({ title, views, time, thumbnail: thumbnailUrl });
    }

    const updateData = {
      mediaItems,
      updatedAt: Date.now(),
    };

    await db.collection("clubMedia").doc(params.id).update(updateData);

    return NextResponse.json({
      success: true,
      media: { id: params.id, ...existingData, ...updateData },
    });
  } catch (error) {
    console.error("Update media error:", error);
    return NextResponse.json(
      { success: false, message: "Update failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove Media Doc ─────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doc = await db.collection("clubMedia").doc(params.id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: "Media not found" },
        { status: 404 }
      );
    }
    await db.collection("clubMedia").doc(params.id).delete();
    return NextResponse.json({ success: true, message: "Media deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Delete failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}