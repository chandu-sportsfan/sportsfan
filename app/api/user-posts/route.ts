// app/api/user-posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectDB } from "@/lib/mongodb";
import Post from "@/models/Post"; // adjust to your Post model

/* ─────────────────────────────────────────
   GET /api/user-posts?userId=xxx&page=1&limit=10
   Returns paginated posts created by the given userId.
   If no userId is supplied, defaults to the logged-in user.
───────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    // Allow fetching another user's posts by userId param,
    // fallback to session user's id
    const userId = searchParams.get("userId") || session.user.id;
    const page   = Math.max(1, parseInt(searchParams.get("page")  || "1",  10));
    const limit  = Math.min(20, parseInt(searchParams.get("limit") || "10", 10));
    const skip   = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await connectDB();

    const [posts, total] = await Promise.all([
      Post.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments({ userId }),
    ]);

    return NextResponse.json({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    });
  } catch (err) {
    console.error("[GET /api/user-posts]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}