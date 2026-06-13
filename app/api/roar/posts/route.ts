import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/getUser";
import type { Post, PostType, SportType } from "@/app/models/Post";

export async function POST(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      type,
      text,
      sport = "cricket",
      sideA,
      sideB,
      matchId,
      confidence,
      audience = "Everyone",
      mediaUrls,
      quizQuestion,
      quizOptions,
      quizCorrectOption,
      quizTimer,
      quizPoints,
    }: {
      type: PostType;
      text: string;
      sport: SportType;
      sideA?: string;
      sideB?: string;
      matchId?: string;
      confidence?: number;
      audience?: string;
      mediaUrls?: string[];
      quizQuestion?: string;
      quizOptions?: { label: string; text: string }[];
      quizCorrectOption?: string;
      quizTimer?: number;
      quizPoints?: number;
    } = body;

    if (!type || (!text?.trim() && !quizQuestion?.trim() && (!mediaUrls || mediaUrls.length === 0))) {
      return NextResponse.json(
        { error: "type and text (or quiz question) are required" },
        { status: 400 },
      );
    }

    // Fetch author info
    let userDocRef = db.collection("users").doc(user.email);
    let userSnap = await userDocRef.get();
    let resolvedUserId = user.email;
    if (!userSnap.exists) {
      userDocRef = db.collection("users").doc(user.userId);
      userSnap = await userDocRef.get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 },
      );
    }
    const userData = userSnap.data() as { username: string; badge: string };

    const now = Date.now();
    const postRef = db.collection("roarPosts").doc();

    const newPost: Post = {
      postId: postRef.id,
      authorUid: resolvedUserId,
      authorUsername: userData.username,
      authorBadge: userData.badge,
      type,
      sport,
      text: text?.trim() || quizQuestion?.trim() || "",
      ...(sideA && { sideA }),
      ...(sideB && { sideB }),
      ...(matchId && { matchId }),
      ...(confidence !== undefined && { confidence }),
      ...(quizQuestion && { quizQuestion }),
      ...(quizOptions && { quizOptions }),
      ...(quizCorrectOption && { quizCorrectOption }),
      ...(quizTimer && { quizTimer }),
      ...(quizPoints && { quizPoints }),
      quizParticipants: 0,
      audience,
      agreeCount: 0,
      disagreeCount: 0,
      replyCount: 0,
      isLive: false,
      status: "active",
      mediaUrls: mediaUrls || [],
      createdAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(postRef, newPost);

    // Increment the right counter on the user doc
    const counterField =
      type === "prediction" ? "predictionCount" : "hotTakeCount";
    batch.update(userDocRef, {
      [counterField]: (userData as any)[counterField]
        ? (userData as any)[counterField] + 1
        : 1,
      updatedAt: now,
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      postId: postRef.id,
      post: newPost,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("POST /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const sport = searchParams.get("sport");

    let query = db
      .collection("roarPosts")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (sport) {
      query = query.where("sport", "==", sport);
    }

    let userSnap = await db.collection("users").doc(user.email).get();
    let resolvedUserId = user.email;
    if (!userSnap.exists) {
      userSnap = await db.collection("users").doc(user.userId).get();
      if (userSnap.exists) {
        resolvedUserId = user.userId;
      }
    }

    const snapshot = await query.get();
    const posts = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as Post;
        const voteSnap = await doc.ref.collection("votes").doc(resolvedUserId).get();
        const userVote = voteSnap.exists ? (voteSnap.data() as any).vote : null;

        let userLiked = false;
        if (data.type === "post") {
          const likeSnap = await doc.ref.collection("likes").doc(resolvedUserId).get();
          userLiked = likeSnap.exists;
        }

        return {
          ...data,
          postId: doc.id,
          userVote,
          likeCount: data.likeCount ?? 0,
          userLiked,
        };
      })
    );

    return NextResponse.json({
      success: true,
      posts,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("GET /api/roar/posts error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
