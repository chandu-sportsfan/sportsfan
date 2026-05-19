import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";


// Helper function to extract ID from URL
function getIdFromUrl(req: NextRequest): string | null {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    return pathParts[pathParts.length - 1] || null;
}


// POST  /api/polls/[id]/vote
// Body: { optionId: string; voterId: string }

export async function POST(req: NextRequest) {

    const id = getIdFromUrl(req);

    if (!id) {
        return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

  try {
    const { optionId, voterId } = await req.json();

    if (!optionId || !voterId) {
      return NextResponse.json(
        { success: false, error: "optionId and voterId are required" },
        { status: 400 }
      );
    }

    const postRef = db.collection("socialPosts").doc(id);
    const postDoc = await postRef.get();

    if (!postDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Post not found" },
        { status: 404 }
      );
    }

    const data = postDoc.data();
    const poll = data?.poll;

    if (!poll) {
      return NextResponse.json(
        { success: false, error: "This post has no poll" },
        { status: 400 }
      );
    }

    if (Date.now() > poll.endsAt) {
      return NextResponse.json(
        { success: false, error: "This poll has ended" },
        { status: 400 }
      );
    }

    if (Array.isArray(poll.votedBy) && poll.votedBy.includes(voterId)) {
      return NextResponse.json(
        { success: false, error: "You have already voted on this poll" },
        { status: 400 }
      );
    }

    const optionIndex: number = poll.options.findIndex(
      (o: { id: string }) => o.id === optionId
    );

    if (optionIndex === -1) {
      return NextResponse.json(
        { success: false, error: "Invalid option ID" },
        { status: 400 }
      );
    }

    // Increment the chosen option's vote count and totalVotes atomically
    const updatedOptions = poll.options.map(
      (o: { id: string; text: string; votes: number }, idx: number) =>
        idx === optionIndex ? { ...o, votes: o.votes + 1 } : o
    );

    await postRef.update({
      "poll.options": updatedOptions,
      "poll.totalVotes": FieldValue.increment(1),
      "poll.votedBy": FieldValue.arrayUnion(voterId),
      updatedAt: Date.now(),
    });

    const updated = await postRef.get();
    return NextResponse.json({
      success: true,
      data: { id: updated.id, ...updated.data() },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/polls/[id]/vote error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}