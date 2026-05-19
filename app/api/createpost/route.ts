import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { v4 as uuidv4 } from "uuid";
import type { Post, Poll, PollOption, CreatePostPayload } from "@/types/createposts";


// POST  /api/posts  — Create a new post

export async function POST(req: NextRequest) {
  try {
    const body: CreatePostPayload = await req.json();
    const { authorName, authorHandle, authorAvatar, content, media, poll } = body;

    if (!authorName || !authorHandle) {
      return NextResponse.json(
        { success: false, error: "authorName and authorHandle are required" },
        { status: 400 }
      );
    }

    if (!content && !media?.length && !poll) {
      return NextResponse.json(
        { success: false, error: "Post must have content, media, or a poll" },
        { status: 400 }
      );
    }

    // Build poll object if provided
    let builtPoll: Poll | null = null;
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
      const options: PollOption[] = poll.options
        .filter((o) => o.trim() !== "")
        .map((text) => ({ id: uuidv4(), text: text.trim(), votes: 0 }));

      if (options.length < 2) {
        return NextResponse.json(
          { success: false, error: "Poll must have at least 2 non-empty options" },
          { status: 400 }
        );
      }

      builtPoll = {
        options,
        totalVotes: 0,
        endsAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        createdAt: Date.now(),
        votedBy: [],
      };
    }

    const now = Date.now();
    const newPost: Omit<Post, "id"> = {
      authorName,
      authorHandle,
      authorAvatar: authorAvatar || "",
      content: content || "",
      media: media || [],
      poll: builtPoll,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection("socialPosts").add(newPost);

    return NextResponse.json(
      { success: true, data: { id: docRef.id, ...newPost } },
      { status: 201 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/posts error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}


// GET  /api/posts  — Fetch posts (paginated)
// Query params: limit, lastDocId, lastDocCreatedAt

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const lastDocId = searchParams.get("lastDocId");
    const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

    let query = db
      .collection("socialPosts")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (lastDocId && lastDocCreatedAt) {
      const lastDocRef = db.collection("socialPosts").doc(lastDocId);
      const lastDoc = await lastDocRef.get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    const posts: Post[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Post, "id">),
    }));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore: posts.length === limit,
        nextCursor:
          posts.length === limit
            ? {
                lastDocId: lastDoc?.id,
                lastDocCreatedAt: lastDoc?.data()?.createdAt,
              }
            : null,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/posts error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}