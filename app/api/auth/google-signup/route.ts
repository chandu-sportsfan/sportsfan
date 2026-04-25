import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: NextRequest) {
    try {
        const { email, name, avatar } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const userRef = db.collection("users").doc(email);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // New user — save to Firebase
            const nameParts = (name ?? "").split(" ");
            const userId = `google_${email.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;

            await userRef.set({
                email,
                userId,
                firstName: nameParts[0] ?? "",
                lastName: nameParts.slice(1).join(" ") ?? "",
                avatar: avatar ?? "",
                provider: "google",
                isVerified: true,
                status: "active",
                role: "user",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            return NextResponse.json({
                success: true,
                isNewUser: true,
                userId,
                firstName: nameParts[0] ?? "",
                lastName: nameParts.slice(1).join(" ") ?? "",
                role: "user",
                status: "active",
            });
        }

        // Existing user
        const data = userDoc.data()!;

        if (data.status === "disabled") {
            return NextResponse.json({ error: "Account disabled" }, { status: 403 });
        }

        await userRef.update({
            lastLoginAt: Date.now(),
            updatedAt: Date.now(),
        });

        return NextResponse.json({
            success: true,
            isNewUser: false,
            userId: data.userId,
            firstName: data.firstName,
            lastName: data.lastName,
            role: data.role || "user",
            status: data.status || "active",
        });

    } catch (error) {
        console.error("Google signup error:", error);
        return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
    }
}