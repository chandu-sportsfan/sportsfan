import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// // ─── GET: Fetch posts by playerProfilesId ─────────────────────────────


// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const playerProfilesId = searchParams.get("playerProfilesId");
//     const rawSearch = searchParams.get("search")?.trim() || "";
//     const limit = parseInt(searchParams.get("limit") || "20");
//     const lastDocId = searchParams.get("lastDocId");
//     const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

//     // If searching
//     if (rawSearch) {
//       const searchLower = rawSearch.toLowerCase();
      
//       // Search by full name (starts with)
//       const fullNameSnap = await db
//         .collection("playershome")
//         .where("playerNameLower", ">=", searchLower)
//         .where("playerNameLower", "<=", searchLower + "\uf8ff")
//         .limit(limit)
//         .get();
      
//       if (!fullNameSnap.empty) {
//         return NextResponse.json({
//           success: true,
//           posts: fullNameSnap.docs.map(d => ({ id: d.id, ...d.data() })),
//           pagination: { limit, hasMore: false, nextCursor: null },
//         });
//       }
      
//       // If no match, try searching for last name
   
//       const lastNameSnap = await db
//         .collection("playershome")
//         .where("playerNameLower", ">=", searchLower)
//         .where("playerNameLower", "<=", searchLower + "\uf8ff")
//         .limit(limit)
//         .get();
      
//       // If still no match, do a contains search (more expensive but works)
//       // Note: This requires all documents to be read (use sparingly)
//       if (lastNameSnap.empty) {
//         const allDocs = await db.collection("playershome").get();
//         const matchedDocs = allDocs.docs.filter(doc => {
//           const name = doc.data().playerNameLower;
//           return name.includes(searchLower);
//         }).slice(0, limit);
        
//         return NextResponse.json({
//           success: true,
//           posts: matchedDocs.map(d => ({ id: d.id, ...d.data() })),
//           pagination: { limit, hasMore: false, nextCursor: null },
//         });
//       }
      
//       return NextResponse.json({
//         success: true,
//         posts: lastNameSnap.docs.map(d => ({ id: d.id, ...d.data() })),
//         pagination: { limit, hasMore: false, nextCursor: null },
//       });
//     }

//     // No search - normal paginated response
//     let query = db.collection("playershome").orderBy("createdAt", "desc");

//     if (playerProfilesId) {
//       query = query.where("playerProfilesId", "==", playerProfilesId);
//     }

//     if (lastDocId && lastDocCreatedAt) {
//       const lastDocRef = db.collection("playershome").doc(lastDocId);
//       const lastDoc = await lastDocRef.get();
//       if (lastDoc.exists) {
//         query = query.startAfter(lastDoc);
//       }
//     }

//     query = query.limit(limit);
//     const snap = await query.get();
//     const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
//     const lastDoc = snap.docs[snap.docs.length - 1];

//     return NextResponse.json({
//       success: true,
//       posts,
//       pagination: {
//         limit,
//         hasMore: posts.length === limit,
//         nextCursor: posts.length === limit
//           ? { lastDocId: lastDoc?.id, lastDocCreatedAt: lastDoc?.data()?.createdAt }
//           : null,
//       },
//     });
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("Fetch error:", error);
//     return NextResponse.json({ success: false, error: msg }, { status: 500 });
//   }
// }


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    
    // Handle count request - uses aggregate query (NO document reads)
    if (action === "count") {
      const collectionRef = db.collection("playershome");
      
      // Apply filters if needed
      const playerProfilesId = searchParams.get("playerProfilesId");
      let query: FirebaseFirestore.Query = collectionRef;
      
      if (playerProfilesId) {
        query = query.where("playerProfilesId", "==", playerProfilesId);
      }
      
      // Use count aggregation
      const snapshot = await query.count().get();
      const totalCount = snapshot.data().count;
      
      return NextResponse.json({
        success: true,
        totalCount,
        filtered: !!playerProfilesId,
        filter: playerProfilesId || null,
      });
    }
    
    // Original search/pagination logic
    const playerProfilesId = searchParams.get("playerProfilesId");
    const rawSearch = searchParams.get("search")?.trim() || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const lastDocId = searchParams.get("lastDocId");
    const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

    // If searching
    if (rawSearch) {
      const searchLower = rawSearch.toLowerCase();
      
      // Search by full name (starts with)
      const fullNameSnap = await db
        .collection("playershome")
        .where("playerNameLower", ">=", searchLower)
        .where("playerNameLower", "<=", searchLower + "\uf8ff")
        .limit(limit)
        .get();
      
      if (!fullNameSnap.empty) {
        return NextResponse.json({
          success: true,
          posts: fullNameSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          pagination: { limit, hasMore: false, nextCursor: null },
        });
      }
      
      // If no match, try searching for last name
      const lastNameSnap = await db
        .collection("playershome")
        .where("playerNameLower", ">=", searchLower)
        .where("playerNameLower", "<=", searchLower + "\uf8ff")
        .limit(limit)
        .get();
      
      // If still no match, do a contains search with limit
      if (lastNameSnap.empty) {
        // WARNING: This reads all documents - use sparingly or remove this feature
        // Better to implement a search index using Algolia/Meilisearch
        const allDocs = await db.collection("playershome").limit(100).get(); // Limit to 100 docs
        const matchedDocs = allDocs.docs.filter(doc => {
          const name = doc.data().playerNameLower;
          return name && name.includes(searchLower);
        }).slice(0, limit);
        
        return NextResponse.json({
          success: true,
          posts: matchedDocs.map(d => ({ id: d.id, ...d.data() })),
          pagination: { limit, hasMore: false, nextCursor: null },
        });
      }
      
      return NextResponse.json({
        success: true,
        posts: lastNameSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        pagination: { limit, hasMore: false, nextCursor: null },
      });
    }

    // No search - normal paginated response
    let query = db.collection("playershome").orderBy("createdAt", "desc");

    if (playerProfilesId) {
      query = query.where("playerProfilesId", "==", playerProfilesId);
    }

    if (lastDocId && lastDocCreatedAt) {
      const lastDocRef = db.collection("playershome").doc(lastDocId);
      const lastDoc = await lastDocRef.get();
      if (lastDoc.exists) {
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit);
    const snap = await query.get();
    const posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const lastDoc = snap.docs[snap.docs.length - 1];

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        limit,
        hasMore: posts.length === limit,
        nextCursor: posts.length === limit
          ? { lastDocId: lastDoc?.id, lastDocCreatedAt: lastDoc?.data()?.createdAt }
          : null,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Fetch error:", error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ─── POST: Create new post linked to player ───────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      playerProfilesId,
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
    // if (!playerProfilesId || !playerName || !title || !image || !logo) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error:
    //         "playerProfilesId, playerName, title, image and logo are required",
    //     },
    //     { status: 400 }
    //   );
    // }

    const newPost = {
      playerProfilesId,
      playerName,
       playerNameLower: playerName?.trim().toLowerCase() || "",
      title,
      category: category ?? [],
      likes: Number(likes) || 0,
      comments: Number(comments) || 0,
      live: Number(live) || 0,
      shares: Number(shares) || 0,
      image,
      logo,
      catlogo: catlogo ?? [],
      hasVideo: hasVideo ?? false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("playershome").add(newPost);

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
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}