import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── POST: Create Season Stats 
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clubProfileId, season } = body;

    if (!clubProfileId || !season?.year) {
      return NextResponse.json(
        { success: false, message: "clubProfileId and season.year are required" },
        { status: 400 }
      );
    }

    // Check if a season for this year already exists for this club
    const existing = await db
      .collection("clubSeasons")
      .where("clubProfileId", "==", clubProfileId)
      .where("season.year", "==", season.year)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { success: false, message: `Season ${season.year} already exists for this club. Use PUT to update.` },
        { status: 409 }
      );
    }

    const seasonData = {
      clubProfileId,
      season: {
        year: season.year || "",
        wins: season.wins || "0",
        losses: season.losses || "0",
        points: season.points || "0",
        position: season.position || "",
        matchesPlayed: season.matchesPlayed || "0",
        netRunRate: season.netRunRate || "0",
        highestTotal: season.highestTotal || "",
        lowestTotal: season.lowestTotal || "",
        runs: season.runs || "0",
        strikeRate: season.strikeRate || "0",
        average: season.average || "0",
        fifties: Number(season.fifties) || 0,
        hundreds: Number(season.hundreds) || 0,
        highestScore: season.highestScore || "",
        fours: Number(season.fours) || 0,
        sixes: Number(season.sixes) || 0,
        award: season.award || "",
        awardSub: season.awardSub || "",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("clubSeasons").add(seasonData);

    return NextResponse.json({
      success: true,
      seasonStats: { id: docRef.id, ...seasonData },
    });
  } catch (error) {
    console.error("Create season error:", error);
    return NextResponse.json(
      { success: false, message: "Create failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}

// ─── GET: Fetch Seasons (by clubProfileId, optional year filter) ──────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clubProfileId = searchParams.get("clubProfileId");
    const year = searchParams.get("year");
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");

    let query: FirebaseFirestore.Query = db.collection("clubSeasons");

    if (clubProfileId) {
      query = query.where("clubProfileId", "==", clubProfileId);
    }
    if (year) {
      query = query.where("season.year", "==", year);
    }

    const countSnapshot = await query.count().get();
    const totalItems = countSnapshot.data().count;

    const startAt = (page - 1) * limit;
    const snapshot = await query
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(startAt)
      .get();

    const seasons = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      success: true,
      seasons,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Fetch seasons error:", error);
    return NextResponse.json(
      { success: false, message: "Fetch failed" },
      { status: 500 }
    );
  }
}