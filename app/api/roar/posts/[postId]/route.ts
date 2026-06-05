import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Post } from "@/models/Post";

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snap = await db.collection("posts").doc(params.postId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      post: { postId: snap.id, ...(snap.data() as Post) },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { postId: string } },
) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snap = await db.collection("posts").doc(params.postId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = snap.data() as Post;
    if (post.authorUid !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await snap.ref.delete();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
