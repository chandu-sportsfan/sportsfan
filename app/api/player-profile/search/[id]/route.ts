import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";


function getIdFromUrl(req: NextRequest): string | null {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  return pathParts[pathParts.length - 1] || null
}

// ─── GET: Single Season 
export async function GET(req: NextRequest) {
  try {
    const id   = getIdFromUrl(req);

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }
   
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Player profile id required" },
        { status: 400 }
      );
    }

    const [
      profileSnap,
      homeSnap,
      seasonSnap,
      insightsSnap,
      mediaSnap,
    ] = await Promise.all([
      // 1️ Profile
      db.collection("PlayerProfiles").doc(id).get(),

      // 2️ Home
      db
        .collection("players360Posts")
        .where("playerProfilesId", "==", id)
        .orderBy("createdAt", "desc")
        .get(),

      // 3️ Season
      db
        .collection("playerSeasons")
        .where("playerProfilesId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),

      // 4️ Insights
      db
        .collection("playerInsights")
        .where("playerProfilesId", "==", id)
        .limit(1)
        .get(),

      // 5️ Media
      db
        .collection("playerMedia")
        .where("playerProfileId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),
    ]);

    const profile = profileSnap.exists
      ? { id: profileSnap.id, ...profileSnap.data() }
      : null;

    // const home = !homeSnap.empty
    //   ? {
    //       id: homeSnap.docs[0].id,
    //       ...homeSnap.docs[0].data(),
    //     }
    //   : null;
    const home = !homeSnap.empty
  ? homeSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  : [];

    const season = !seasonSnap.empty
      ? {
          id: seasonSnap.docs[0].id,
          ...seasonSnap.docs[0].data(),
        }
      : null;

    const insights = !insightsSnap.empty
      ? {
          id: insightsSnap.docs[0].id,
          ...insightsSnap.docs[0].data(),
        }
      : null;

    const media = !mediaSnap.empty
      ? {
          id: mediaSnap.docs[0].id,
          ...mediaSnap.docs[0].data(),
        }
      : null;

    return NextResponse.json({
      success: true,
      data: {
        profile,
        home,
        season,
        insights,
        media,
      },
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Unexpected error";

    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}