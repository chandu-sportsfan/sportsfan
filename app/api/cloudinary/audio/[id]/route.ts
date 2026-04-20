// app/api/cloudinary/audio/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        
        // Decode the ID (it might be URL encoded)
        const publicId = decodeURIComponent(id);
        
        // Get specific resource from Cloudinary
        const result = await cloudinary.api.resource(publicId, {
            resource_type: "video"
        });
        
        const formatDuration = (seconds: number): string => {
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };
        
        const audioData = {
            id: result.public_id,
            title: result.public_id.split('/').pop()?.replace(/_/g, ' ').replace(/\.mp3$/, ''),
            url: result.secure_url,
            duration: formatDuration(result.duration || 0),
            durationSeconds: result.duration || 0,
            size: result.bytes,
            format: result.format,
            createdAt: result.created_at,
            folder: result.public_id.split('/').slice(0, -1).join('/')
        };
        
        return NextResponse.json({
            success: true,
            audio: audioData
        });
        
    } catch (error) {
        console.error("Error fetching audio:", error);
        return NextResponse.json(
            { success: false, error: "Audio not found" },
            { status: 404 }
        );
    }
}