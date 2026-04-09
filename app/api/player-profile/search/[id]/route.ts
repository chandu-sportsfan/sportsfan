import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

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
      // 1️⃣ Profile
      db.collection("PlayerProfiles").doc(id).get(),

      // 2️⃣ Home
      db
        .collection("players360Posts")
        .where("playerProfilesId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),

      // 3️⃣ Season
      db
        .collection("playerSeasons")
        .where("playerProfilesId", "==", id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .get(),

      // 4️⃣ Insights
      db
        .collection("playerInsights")
        .where("playerProfilesId", "==", id)
        .limit(1)
        .get(),

      // 5️⃣ Media
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

    const home = !homeSnap.empty
      ? {
          id: homeSnap.docs[0].id,
          ...homeSnap.docs[0].data(),
        }
      : null;

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