// api/womens-matches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { validateWomensMatchCreate } from "../../../lib/validations/womensT20WC";

// Define the match data type
interface WomensMatch {
  id?: string;
  matchId: number;
  team1: string;
  team2: string;
  venue: string;
  date: number;
  [key: string]: unknown; // For other dynamic fields
}

// GET - List women's matches
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get("matchId");
    const team = searchParams.get("team");
    const venue = searchParams.get("venue");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(Number(limitParam), 500)) : 100;

    let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
      db.collection("womensMatches");

    if (matchId) {
      const numericMatchId = Number(matchId);
      if (!Number.isNaN(numericMatchId)) {
        query = query.where("matchId", "==", numericMatchId);
      }
    }

    const snapshot = await query.orderBy("date", "desc").limit(limit).get();
    let matches: WomensMatch[] = snapshot.docs.map((doc) => ({ 
      id: doc.id, 
      ...doc.data() 
    } as WomensMatch));

    // Apply team filter (client-side since Firestore can't do OR queries easily)
    if (team) {
      matches = matches.filter((match: WomensMatch) => 
        match.team1 === team || match.team2 === team
      );
    }

    // Apply venue filter
    if (venue) {
      matches = matches.filter((match: WomensMatch) => match.venue === venue);
    }

    return NextResponse.json({ success: true, matches, count: matches.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching women's matches:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST - Create a new women's match
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validation = validateWomensMatchCreate(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    const matchData = validation.data!;
    
    // Check for duplicate match_id
    const existing = await db.collection("womensMatches")
      .where("matchId", "==", matchData.matchId)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      return NextResponse.json(
        { success: false, error: `Match with ID ${matchData.matchId} already exists` },
        { status: 409 }
      );
    }
    
    const newMatch: Omit<WomensMatch, 'id'> = {
      ...matchData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const docRef = await db.collection("womensMatches").add(newMatch);
    
    return NextResponse.json({
      success: true,
      id: docRef.id,
      match: { id: docRef.id, ...newMatch },
    }, { status: 201 });
    
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error creating women's match:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}