import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type BadgeType = "FEATURE" | "ANALYSIS" | "OPINION" | "NEWS";

// POST - Create a new article
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      badge,
      title,
      readTime,
      views,
      image,
    } = body;

    // Validation
    const validBadges: BadgeType[] = ["FEATURE", "ANALYSIS", "OPINION", "NEWS"];
    
    if (!title || !image) {
      return NextResponse.json(
        { error: "title and image are required" },
        { status: 400 }
      );
    }

    if (badge && !validBadges.includes(badge)) {
      return NextResponse.json(
        { error: "Invalid badge type. Must be FEATURE, ANALYSIS, OPINION, or NEWS" },
        { status: 400 }
      );
    }

    const newArticle = {
      badge: badge || "NEWS",
      title,
      readTime: readTime || "5 min read",
      views: views || "0 views",
      image,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("cricketArticles").add(newArticle);

    return NextResponse.json(
      {
        success: true,
        id: docRef.id,
        article: { id: docRef.id, ...newArticle },
      },
      { status: 201 }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error creating article:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET - List all articles (with pagination)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");
    const badge = searchParams.get("badge");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    let query = db.collection("cricketArticles").orderBy("createdAt", "desc");

    // Filter by badge if provided
    if (badge && ["FEATURE", "ANALYSIS", "OPINION", "NEWS"].includes(badge)) {
      query = query.where("badge", "==", badge);
    }

    const snapshot = await query.limit(limit).offset(skip).get();
    
    const articles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Get total count for pagination
    const totalSnapshot = await db.collection("cricketArticles").get();
    const total = totalSnapshot.size;

    return NextResponse.json({
      success: true,
      articles,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching articles:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}