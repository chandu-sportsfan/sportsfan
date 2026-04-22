// Admin Panel: app/api/audio-messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// POST - User sends message (called from main frontend)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { audioId, audioTitle, userId, userName, message, rating } = body;

        const messageData = {
            audioId,
            audioTitle,
            userId,
            userName: userName || "Anonymous",
            message,
            rating: rating || null,
            createdAt: Date.now(),
            isRead: false,
            isFlagged: false,
        };

        const docRef = await db.collection("audioMessages").add(messageData);

        return NextResponse.json({
            success: true,
            message: { id: docRef.id, ...messageData }
        });
    } catch (error : unknown) {
        console.log("audio-message :",error)
        return NextResponse.json(
            { success: false, message: "Failed to save message" },
            { status: 500 }
        );
    }
}

// GET - Fetch messages for an audio (called from main frontend)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const audioId = searchParams.get("audioId");

        const snapshot = await db.collection("audioMessages")
            .where("audioId", "==", audioId)
            .where("isFlagged", "==", false)
            .orderBy("createdAt", "desc")
            .get();

        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ success: true, messages });
    } catch (error : unknown) {
        console.log("audio-message :",error)
        return NextResponse.json(
            { success: false, message: "Failed to fetch messages" },
            { status: 500 }
        );
    }
}

