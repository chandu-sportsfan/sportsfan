//api/auth/google-signup/route.ts
// chandu's code

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// export async function POST(req: NextRequest) {
//     try {
//         const { email, name, avatar } = await req.json();

//         if (!email) {
//             return NextResponse.json({ error: "Email required" }, { status: 400 });
//         }

//         const userRef = db.collection("users").doc(email);
//         const userDoc = await userRef.get();

//         if (!userDoc.exists) {
//             // New user — save to Firebase
//             const nameParts = (name ?? "").split(" ");
//             const userId = `google_${email.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;

//             await userRef.set({
//                 email,
//                 userId,
//                 firstName: nameParts[0] ?? "",
//                 lastName: nameParts.slice(1).join(" ") ?? "",
//                 avatar: avatar ?? "",
//                 provider: "google",
//                 isVerified: true,
//                 status: "active",
//                 role: "user",
//                 createdAt: Date.now(),
//                 updatedAt: Date.now(),
//             });

//             return NextResponse.json({
//                 success: true,
//                 isNewUser: true,
//                 userId,
//                 firstName: nameParts[0] ?? "",
//                 lastName: nameParts.slice(1).join(" ") ?? "",
//                 role: "user",
//                 status: "active",
//             });
//         }

//         // Existing user
//         const data = userDoc.data()!;

//         if (data.status === "disabled") {
//             return NextResponse.json({ error: "Account disabled" }, { status: 403 });
//         }

//         await userRef.update({
//             lastLoginAt: Date.now(),
//             updatedAt: Date.now(),
//         });

//         return NextResponse.json({
//             success: true,
//             isNewUser: false,
//             userId: data.userId,
//             firstName: data.firstName,
//             lastName: data.lastName,
//             role: data.role || "user",
//             status: data.status || "active",
//         });

//     } catch (error) {
//         console.error("Google signup error:", error);
//         return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
//     }
// }





//api/auth/google-signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Helper function to generate consistent user ID
function generateConsistentUserId(email: string): string {
  // Remove special characters and make it consistent
  return email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
}

export async function POST(req: NextRequest) {
    try {
        const { email, name, avatar } = await req.json();

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const userRef = db.collection("users").doc(email);
        const userDoc = await userRef.get();
        
        const consistentUserId = generateConsistentUserId(email);
        const nameParts = (name ?? "").split(" ");
        const firstName = nameParts[0] ?? "";
        const lastName = nameParts.slice(1).join(" ") ?? "";

        if (!userDoc.exists) {
            // New user — create with consistent ID
            await userRef.set({
                email,
                userId: consistentUserId, // Use consistent ID, not google_xxx
                firstName,
                lastName,
                avatar: avatar ?? "",
                provider: "google",
                authProviders: { google: true, emailPassword: false },
                isVerified: true,
                status: "active",
                role: "user",
                totalPoints: 0,
                pointsBreakdown: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastLoginAt: Date.now(),
            });

            return NextResponse.json({
                success: true,
                isNewUser: true,
                userId: consistentUserId,
                firstName,
                lastName,
                role: "user",
                status: "active",
            });
        }

        // Existing user — just update, don't change userId
        const data = userDoc.data()!;

        if (data.status === "disabled") {
            return NextResponse.json({ error: "Account disabled" }, { status: 403 });
        }

        // If user exists but doesn't have google provider flag, add it
        const updateData: Record<string, unknown> = {
            lastLoginAt: Date.now(),
            updatedAt: Date.now(),
        };
        
        if (!data.authProviders?.google) {
            updateData['authProviders.google'] = true;
        }
        
        // If user exists but missing firstName/lastName, update them
        if (!data.firstName && firstName) {
            updateData.firstName = firstName;
            updateData.lastName = lastName;
        }
        
        // If user exists but no avatar and we have one
        if (!data.avatar && avatar) {
            updateData.avatar = avatar;
        }

        await userRef.update(updateData);

        return NextResponse.json({
            success: true,
            isNewUser: false,
            userId: data.userId || consistentUserId, // Use existing userId
            firstName: data.firstName || firstName,
            lastName: data.lastName || lastName,
            role: data.role || "user",
            status: data.status || "active",
        });

    } catch (error) {
        console.error("Google signup error:", error);
        return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
    }
}