import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const snapshot = await db.collection("storeCategories").where("status", "==", "active").get();
    const categories = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
        success: true,
        data: categories
    });
  } catch (error: any) {
    console.error("Error fetching store categories:", error);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
