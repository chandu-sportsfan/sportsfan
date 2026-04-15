// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";

// export async function POST(req: NextRequest) {
//   try {
//     const { email, password } = await req.json();

//     if (!email || !password) {
//       return NextResponse.json(
//         { error: "Email & password required" },
//         { status: 400 }
//       );
//     }

//     const userRef = db.collection("users").doc(email);
//     const userDoc = await userRef.get();

//     if (!userDoc.exists) {
//       return NextResponse.json(
//         { error: "User not found" },
//         { status: 404 }
//       );
//     }

//     const user = userDoc.data();

//     if (!user?.isVerified) {
//       return NextResponse.json(
//         { error: "Please verify OTP first" },
//         { status: 403 }
//       );
//     }

//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return NextResponse.json(
//         { error: "Invalid credentials" },
//         { status: 401 }
//       );
//     }

//     // Create JWT token
//     const token = jwt.sign(
//       {
//         email: user.email,
//         userId: user.userId,
//         name: `${user.firstName} ${user.lastName}`,
//       },
//       process.env.JWT_SECRET as string,
//       { expiresIn: "7d" }
//     );

//     // Create response with user data (without token)
//     const response = NextResponse.json({
//       success: true,
//       user: {
//         email: user.email,
//         name: `${user.firstName} ${user.lastName}`,
//         userId: user.userId,
//       },
//     });

//     // Set HTTP-only cookie
//     response.cookies.set("token", token, {
//       httpOnly: true,                      // Cannot be accessed by JavaScript
//       secure: process.env.NODE_ENV === "production", // HTTPS only in production
//       sameSite: "strict",                  // CSRF protection
//       maxAge: 7 * 24 * 60 * 60,            // 7 days in seconds
//       path: "/",                           // Available across the whole app
//     });

//     return response;
//   } catch (error: unknown) {
//     console.error("LOGIN ERROR:", error);
//     const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
//     return NextResponse.json(
//       { error: errorMessage },
//       { status: 500 }
//     );
//   }
// }




// api/auth/login/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email & password required" },
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

    const user = userDoc.data()!;

    // ── 1. Check verified ─────────────────────────
    if (!user.isVerified) {
      return NextResponse.json(
        { error: "Please verify OTP first" },
        { status: 403 }
      );
    }

    // ── 2. Check account status ───────────────────
    if (user.status === "disabled") {
      return NextResponse.json(
        { error: "Your account has been disabled. Contact support." },
        { status: 403 }
      );
    }

    // ── 3. Check password ─────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ── 4. Create JWT token ───────────────────────
    const token = jwt.sign(
      {
        email:  user.email,
        userId: user.userId,
        name:   `${user.firstName} ${user.lastName}`,
        role:   user.role ?? "user",       // ✅ include role in token
        status: user.status ?? "active",   // ✅ include status in token
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    // ── 5. Build response ─────────────────────────
    const response = NextResponse.json({
      success: true,
      user: {
        email:  user.email,
        name:   `${user.firstName} ${user.lastName}`,
        userId: user.userId,
        role:   user.role   ?? "user",
        status: user.status ?? "active",
      },
    });

    // ── 6. Set HTTP-only cookies ───────────────────
    response.cookies.set("token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   7 * 24 * 60 * 60,
      path:     "/",
    });

    return response;

  } catch (error: unknown) {
    console.error("LOGIN ERROR:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}