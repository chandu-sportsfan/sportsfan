// app/api/team360/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

//  GET all posts 
export async function GET() {
  try {
    const snap = await db
      .collection("players360Posts")
      .orderBy("createdAt", "desc")
      .get();

    const posts = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({ posts, total: posts.length });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

//  POST create new post 
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      playerName,
      title,
      category,
      likes,
      comments,
      live,
      shares,
      image,
      logo,
      catlogo,
      hasVideo,
    } = body;

    // Validation
    if (!playerName || !title || !image || !logo) {
      return NextResponse.json(
        { error: "playerName, title, image and logo are required" },
        { status: 400 }
      );
    }

    const newPost = {
      playerName,
      title,

      // category as array of objects
      category: category ?? [],

      likes: Number(likes) || 0,
      comments: Number(comments) || 0,
      live: Number(live) || 0,
      shares: Number(shares) || 0,

      image,
      logo,

      // stats icons
      catlogo: catlogo ?? [],

      hasVideo: hasVideo ?? false,

      // timestamps only
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("players360Posts").add(newPost);

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        post: { id: docRef.id, ...newPost },
      },
      { status: 201 }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}