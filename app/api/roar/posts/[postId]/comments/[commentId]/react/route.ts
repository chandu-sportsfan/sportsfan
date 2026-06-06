import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string; commentId: string }> },
) {
  try {
    const { postId, commentId } = await params;
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const commentRef = db
      .collection("roarPosts")
      .doc(postId)
      .collection("comments")
      .doc(commentId);

    const snap = await commentRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const current = (snap.data() as any).heartCount ?? 0;
    await commentRef.update({ heartCount: current + 1 });

    return NextResponse.json({ success: true, heartCount: current + 1 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
