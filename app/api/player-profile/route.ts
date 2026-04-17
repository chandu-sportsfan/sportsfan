import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { db } from "@/lib/firebaseAdmin";


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const name = formData.get("name") as string;
    const team = formData.get("team") as string;
    const battingStyle = formData.get("battingStyle") as string;
    const bowlingStyle = formData.get("bowlingStyle") as string;
    const about = formData.get("about") as string;

    // Stats
    const statsRuns = formData.get("statsRuns") as string;
    const statsSr = formData.get("statsSr") as string;
    const statsAvg = formData.get("statsAvg") as string;

    // Player Overview
    const iplDebut = formData.get("iplDebut") as string;
    const specialization = formData.get("specialization") as string;
    const dob = formData.get("dob") as string;
    const matches = formData.get("matches") as string;

    // Files
    const avatarFile = formData.get("avatar") as File | null;
    const avatarUrl = formData.get("avatarUrl") as string;

    if (!name || !team) {
      return NextResponse.json(
        { success: false, message: "name and team are required" },
        { status: 400 }
      );
    }

    // Upload avatar
    let resolvedAvatarUrl = "";
    if (avatarUrl) {
      resolvedAvatarUrl = avatarUrl;
    } else if (avatarFile) {
      const bytes = await avatarFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${avatarFile.type};base64,${buffer.toString("base64")}`;
      const uploadRes = await cloudinary.uploader.upload(base64, {
        folder: "club-profiles/avatars",
        public_id: `${Date.now()}-${avatarFile.name.replace(/\s/g, "_")}`,
      });
      resolvedAvatarUrl = uploadRes.secure_url;
    }

    const profileData = {
      name,
      team,
      battingStyle: battingStyle || "",
      bowlingStyle: bowlingStyle || "",
      about: about || "",
      avatar: resolvedAvatarUrl,
      stats: {
        runs: statsRuns || "0",
        sr: statsSr || "0",
        avg: statsAvg || "0",
      },
      overview: {
        iplDebut: iplDebut || "",
        specialization: specialization || "",
        dob: dob || "",
        matches: matches || "",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("PlayerProfiles").add(profileData);

    return NextResponse.json({
      success: true,
      profile: { id: docRef.id, ...profileData },
    });
  } catch (error) {
    console.error("Create Player profile error:", error);
    return NextResponse.json(
      { success: false, message: "Create failed: " + (error as Error).message },
      { status: 500 }
    );
  }
}



// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const limit = parseInt(searchParams.get("limit") || "20");
//     const page = parseInt(searchParams.get("page") || "1");
//     const search = searchParams.get("search")?.trim().toLowerCase() || "";

//     const collectionRef = db.collection("PlayerProfiles");
//     let query: FirebaseFirestore.Query = collectionRef;

//     if (search) {
//       query = query
//         .orderBy("nameLower")          // query the lowercase field
//         .startAt(search)
//         .endAt(search + "\uf8ff");
//     } else {
//       query = query.orderBy("createdAt", "desc");
//     }

//     // const countSnapshot = await query.count().get();
//     // const totalItems = countSnapshot.data().count;

//     const offset = (page - 1) * limit;
//     const snapshot = await query.limit(limit).offset(offset).get();

//     const profiles = snapshot.docs.map((doc) => ({
//       id: doc.id,
//       ...doc.data(),
//     }));

//     return NextResponse.json({
//       success: true,
//       profiles,
//       pagination: {
//         currentPage: page,
//         totalPages: Math.ceil(totalItems / limit),
//         totalItems,
//         itemsPerPage: limit,
//       },
//     });
//   } catch (error) {
//     console.error("Fetch player profiles error:", error);
//     return NextResponse.json(
//       { success: false, message: "Fetch failed" },
//       { status: 500 }
//     );
//   }
// }


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "1");
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    const collectionRef = db.collection("PlayerProfiles");
    let query: FirebaseFirestore.Query = collectionRef;

    if (search) {
      query = query
        .orderBy("nameLower")
        .startAt(search)
        .endAt(search + "\uf8ff");
    } else {
      query = query.orderBy("createdAt", "desc");
    }

    const offset = (page - 1) * limit;

    // Fetch one extra doc to know if there's a next page
    const snapshot = await query.limit(limit + 1).offset(offset).get();

    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    const profiles = docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      profiles,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        hasMore, // use this on frontend instead of totalPages
      },
    });
  } catch (error) {
    console.error("Fetch player profiles error:", error);
    return NextResponse.json(
      { success: false, message: "Fetch failed" },
      { status: 500 }
    );
  }
}