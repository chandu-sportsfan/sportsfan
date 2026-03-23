import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { VerifyOtpRequest } from "@/types/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, otp }: VerifyOtpRequest = await req.json();

    const doc = await db.collection("otps").doc(email).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "OTP not found" }, { status: 400 });
    }

    const data = doc.data();

    if (data?.otp !== otp) {
      return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
    }

    if (Date.now() - data.createdAt > 5 * 60 * 1000) {
      return NextResponse.json({ error: "OTP expired" }, { status: 400 });
    }

    // Save user
    await db.collection("users").doc(email).set({
      email,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      token: "dummy-token",
    });
  } catch (error) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}


export async function GET() {
  const snap = await db.collection("users").orderBy("createdAt", "desc").get();
  const users = snap.docs.map(d => d.data());
  return NextResponse.json({ users, total: users.length });
}