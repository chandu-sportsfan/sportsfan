import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // save inside public folder
    const baseDir = path.join(
      process.cwd(),
      "public",
      "Content",
      "Drops",
      folder
    );

    await mkdir(baseDir, { recursive: true });

    const timestamp = Date.now();
    const originalName = file.name.replace(/\s/g, "_");
    const uniqueFileName = `${timestamp}-${originalName}`;

    const filePath = path.join(baseDir, uniqueFileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFile(filePath, buffer);

    // return browser-accessible URL
    const fileUrl = `/Content/Drops/${folder}/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: uniqueFileName,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}