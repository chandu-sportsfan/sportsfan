import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";



export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const lastDocEmail = searchParams.get("lastDocEmail");
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const fetchAll = searchParams.get("fetchAll") === "true"; // Escape hatch if they REALLY need it

    let query: FirebaseFirestore.Query = db.collection("users");

    if (search) {
      // Basic prefix search on email (which is the doc ID)
      query = query.orderBy("__name__").startAt(search).endAt(search + "\uf8ff");
    } else {
      query = query.orderBy("createdAt", "desc");
      if (lastDocEmail) {
        const lastDoc = await db.collection("users").doc(lastDocEmail).get();
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }
    }

    if (!fetchAll) {
      query = query.limit(limit);
    }

    const snap = await query.get();
    const users = snap.docs.map((d) => ({
      email: d.id,
      ...d.data(),
      status: d.data().status ?? "active",
      role: d.data().role ?? "user",
    }));

    return NextResponse.json({
      success: true,
      users,
      hasMore: !fetchAll && users.length === limit,
    });
  } catch (error) {
    console.error("Fetch users error:", error);
    return NextResponse.json(
      { success: false, message: "Fetch failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { email, status, role } = await req.json();

  await db.collection("users").doc(email).update({
    ...(status !== undefined && { status }),
    ...(role   !== undefined && { role   }),
    updatedAt: Date.now(),
  });

  return NextResponse.json({ success: true });
}


export async function DELETE(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }


    await userRef.delete();

   
    await db.collection("otps").doc(email).delete();

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });

  }catch (error: unknown) {
    console.error("❌ ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}