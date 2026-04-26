import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// POST — mark a drop as seen
export async function POST(req: NextRequest) {
    try {
        const { dropId, userId } = await req.json();

        if (!dropId || !userId) {
            return NextResponse.json(
                { success: false, error: "dropId and userId are required" },
                { status: 400 }
            );
        }

        await db
            .collection("seen_drops")
            .doc(`${userId}_${dropId}`)
            .set({ dropId, userId, seenAt: new Date().toISOString() });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// GET — fetch all seen dropIds for a user
export async function GET(req: NextRequest) {
    try {
        const userId = req.nextUrl.searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "userId is required" },
                { status: 400 }
            );
        }

        const snap = await db
            .collection("seen_drops")
            .where("userId", "==", userId)
            .get();

        const seenDropIds = snap.docs.map((d) => d.data().dropId as string);

        return NextResponse.json({ success: true, seenDropIds });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}