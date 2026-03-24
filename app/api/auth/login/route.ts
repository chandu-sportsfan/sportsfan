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

 
//     const token = jwt.sign(
//       {
//         email: user.email,
//         name: `${user.firstName} ${user.lastName}`,
//       },
//       process.env.JWT_SECRET as string,
//       { expiresIn: "7d" }
//     );

//     return NextResponse.json({
//       success: true,
//       token,
//       user: {
//         email: user.email,
//         name: `${user.firstName} ${user.lastName}`,
//       },
//     });

//   } catch (error: unknown) {
//     console.error("LOGIN ERROR:", error);
//     const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
//     return NextResponse.json(
//       { error: errorMessage },
//       { status: 500 }
//     );
//   }
// }





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

    const user = userDoc.data();

    if (!user?.isVerified) {
      return NextResponse.json(
        { error: "Please verify OTP first" },
        { status: 403 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = jwt.sign(
      {
        email: user.email,
        userId: user.userId,
        name: `${user.firstName} ${user.lastName}`,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    // Create response with user data (without token)
    const response = NextResponse.json({
      success: true,
      user: {
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userId: user.userId,
      },
    });

    // Set HTTP-only cookie
    response.cookies.set("token", token, {
      httpOnly: true,                      // Cannot be accessed by JavaScript
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict",                  // CSRF protection
      maxAge: 7 * 24 * 60 * 60,            // 7 days in seconds
      path: "/",                           // Available across the whole app
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