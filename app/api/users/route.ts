import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";



export async function GET() {
  const snap = await db.collection("users").orderBy("createdAt", "desc").get();
  const users = snap.docs.map(d => d.data());
  return NextResponse.json({ users, total: users.length });
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

  } catch (error: any) {
    console.error("DELETE USER ERROR:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}