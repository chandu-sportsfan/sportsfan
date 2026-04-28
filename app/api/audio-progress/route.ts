// app/api/audio-progress/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const userId = searchParams.get("userId");
        const audioId = searchParams.get("audioId");

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "userId is required" },
                { status: 400 }
            );
        }

        // Fetch single audio progress
        if (audioId) {
            const doc = await db
                .collection("audioProgress")
                .doc(userId)
                .collection("tracks")
                .doc(encodeURIComponent(audioId))
                .get();

            if (!doc.exists) {
                return NextResponse.json({ success: true, progress: null });
            }

            return NextResponse.json({ success: true, progress: doc.data() });
        }

        // Fetch all in-progress tracks for user (for Continue Listening)
        const snapshot = await db
            .collection("audioProgress")
            .doc(userId)
            .collection("tracks")
            .where("pct", ">", 2)
            .where("pct", "<", 95)
            .orderBy("pct")
            .orderBy("pausedAt", "desc")
            .limit(10)
            .get();

        const progress = snapshot.docs.map((doc) => doc.data());

        return NextResponse.json({ success: true, progress });
    } catch (error) {
        console.error("Error fetching audio progress:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch progress",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// ─── POST: Save/update progress 
// Body: { userId, audioId, title, subtitle, elapsed, durationSeconds, pct, url }
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, audioId, title, subtitle, elapsed, durationSeconds, pct, url } = body;

        if (!userId || !audioId) {
            return NextResponse.json(
                { success: false, error: "userId and audioId are required" },
                { status: 400 }
            );
        }

        // If audio is >95% listened — clear progress (treat as finished)
        if (pct >= 95) {
            await db
                .collection("audioProgress")
                .doc(userId)
                .collection("tracks")
                .doc(encodeURIComponent(audioId))
                .delete();

            return NextResponse.json({ success: true, message: "Progress cleared — audio finished" });
        }

        const progressData = {
            audioId,
            title,
            subtitle: subtitle || "",
            elapsed: elapsed || 0,
            durationSeconds: durationSeconds || 0,
            pct: pct || 0,
            url,
            pausedAt: Date.now(),
        };

        await db
            .collection("audioProgress")
            .doc(userId)
            .collection("tracks")
            .doc(encodeURIComponent(audioId))
            .set(progressData, { merge: true });

        return NextResponse.json({ success: true, progress: progressData });
    } catch (error) {
        console.error("Error saving audio progress:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to save progress",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

// ─── DELETE: Clear progress for a specific track 
// DELETE /api/audio-progress?userId=xxx&audioId=sf360/audio/bumrah_pregame
export async function DELETE(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const userId = searchParams.get("userId");
        const audioId = searchParams.get("audioId");

        if (!userId || !audioId) {
            return NextResponse.json(
                { success: false, error: "userId and audioId are required" },
                { status: 400 }
            );
        }

        await db
            .collection("audioProgress")
            .doc(userId)
            .collection("tracks")
            .doc(encodeURIComponent(audioId))
            .delete();

        return NextResponse.json({ success: true, message: "Progress cleared" });
    } catch (error) {
        console.error("Error clearing audio progress:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to clear progress",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}