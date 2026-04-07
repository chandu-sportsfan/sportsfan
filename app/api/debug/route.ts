// app/api/debug/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
    hasApiKey: !!process.env.CLOUDINARY_API_KEY,
    hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
    nodeEnv: process.env.NODE_ENV,
  });
}