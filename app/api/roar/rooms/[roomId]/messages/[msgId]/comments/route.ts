// api/roar/rooms/[roomId]/messages/[msgId]/comments/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { getUser } from "@/lib/getUser";
import { notifyRoomMessageComment } from "@/lib/roarNotifyHelpers";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
    req: NextRequest,
    { params }: { params: { roomId: string; msgId: string } }
) {
    try {
        const { roomId, msgId } = params;
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

        const snap = await db
            .collection("roarRooms")
            .doc(roomId)
            .collection("messages")
            .doc(msgId)
            .collection("comments")
            .orderBy("createdAt", "desc")
            .limit(limit)
            .get();

        const comments = snap.docs.map((doc) => ({
            id: doc.id,
            commentId: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ success: true, comments });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(
    req: NextRequest,
    { params }: { params: { roomId: string; msgId: string } }
) {
    try {
        const user = await getUser(req);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { roomId, msgId } = params;
        const body = await req.json();
        const text: string = (body.text ?? "").trim();
        if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

        const { username, avatarUrl, badge } = await resolveUserInfo(user.userId, user.name, user.email);
        const now = Date.now();

        const commentRef = db
            .collection("roarRooms")
            .doc(roomId)
            .collection("messages")
            .doc(msgId)
            .collection("comments")
            .doc();

        await commentRef.set({
            commentId: commentRef.id,
            text,
            authorUid: user.userId,
            authorEmail: user.email,
            authorUsername: username,
            authorAvatarUrl: avatarUrl,
            authorBadge: badge,
            createdAt: now,
            roomId,
        });

        // Increment replyCount on the message
        db.collection("roarRooms")
            .doc(roomId)
            .collection("messages")
            .doc(msgId)
            .update({ replyCount: FieldValue.increment(1) })
            .catch(() => { });

        // Notify post author
        notifyRoomMessageComment(roomId, msgId, user.userId, user.email, username, text.slice(0, 80)).catch(() => { });

        return NextResponse.json({
            success: true,
            commentId: commentRef.id,
            comment: {
                id: commentRef.id,
                commentId: commentRef.id,
                text,
                authorUid: user.userId,
                authorUsername: username,
                authorAvatarUrl: avatarUrl,  
                authorBadge: badge,
                roomId,
                createdAt: now,
            },
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

async function resolveUserInfo(userId: string, name: string, email: string): Promise<{
    username: string;
    avatarUrl: string | null;
    badge: string | null;
}> {
    try {
        const snap = await db.collection("users").doc(userId).get();
        if (snap.exists) {
            const d = snap.data()!;
            return {
                username: (d.username as string) || name || email.split("@")[0],
                avatarUrl: (d.avatarUrl as string) ?? null,
                badge: (d.badge as string) ?? null,
            };
        }
    } catch { }
    return { username: name || email.split("@")[0], avatarUrl: null, badge: null };
}