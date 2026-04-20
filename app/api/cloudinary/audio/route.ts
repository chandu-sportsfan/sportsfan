// app/api/cloudinary/audio/route.ts
import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

interface CloudinaryResource {
    public_id: string;
    secure_url: string;
    duration: number;
    created_at: string;
    bytes: number;
    format: string;
    filename: string;
    original_filename: string;
    display_name: string;
}

interface AudioMetadata {
    id: string;
    title: string;
    fileName: string;
    url: string;
    duration: string;
    durationSeconds: number;
    size: number;
    sizeFormatted: string;
    format: string;
    createdAt: string;
    createdAtFormatted: string;
    folder: string;
    matchInfo?: {
        team1?: string;
        team2?: string;
        type?: string;
        speaker?: string;
        date?: string;
    };
}

interface CloudinaryApiParams {
    resource_type: string;
    type: string;
    prefix: string;
    max_results: number;
    next_cursor?: string;
}

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const limit = parseInt(searchParams.get("limit") || "50");
        const nextCursor = searchParams.get("nextCursor");
        const search = searchParams.get("search")?.toLowerCase();

        // Build Cloudinary API parameters
        const params: CloudinaryApiParams = {
            resource_type: "video", // Audio files use 'video' resource type
            type: "upload",
            prefix: "sf360/audio", // Your folder path
            max_results: limit,
        };

        if (nextCursor) {
            params.next_cursor = nextCursor;
        }

        // Fetch resources from Cloudinary
        const result = await cloudinary.api.resources(params);

        // Transform and enrich audio data
        let audioFiles: AudioMetadata[] = result.resources.map((resource: CloudinaryResource) => {
            // Extract filename without extension
            const fileName = resource.display_name || resource.public_id.split('/').pop() || resource.public_id;
            const title = fileName.replace(/_/g, ' ');

            // Parse filename to extract match info (based on your naming convention)

           const matchInfo = parseFileName(resource.display_name || fileName);

            // Format duration
            const formatDuration = (seconds: number): string => {
                const minutes = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${minutes}:${secs.toString().padStart(2, '0')}`;
            };

            // Format file size
            const formatFileSize = (bytes: number): string => {
                if (bytes < 1024) return `${bytes} B`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            };

            // Format date
            const formatDate = (dateString: string): string => {
                const date = new Date(dateString);
                return date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            return {
                id: resource.public_id,
                title: title,
                fileName: fileName,
                url: resource.secure_url,
                duration: formatDuration(resource.duration || 0),
                durationSeconds: resource.duration || 0,
                size: resource.bytes,
                sizeFormatted: formatFileSize(resource.bytes),
                format: resource.format,
                createdAt: resource.created_at,
                createdAtFormatted: formatDate(resource.created_at),
                folder: "sf360/audio",
                matchInfo: matchInfo
            };
        });

        // Apply search filter if provided
        if (search) {
            audioFiles = audioFiles.filter(audio =>
                audio.title.toLowerCase().includes(search) ||
                audio.matchInfo?.team1?.toLowerCase().includes(search) ||
                audio.matchInfo?.team2?.toLowerCase().includes(search) ||
                audio.matchInfo?.speaker?.toLowerCase().includes(search)
            );
        }

        // Sort by newest first
        audioFiles.sort((a, b) => b.durationSeconds - a.durationSeconds);

        return NextResponse.json({
            success: true,
            audioFiles,
            totalCount: audioFiles.length,
            pagination: {
                hasMore: !!result.next_cursor,
                nextCursor: result.next_cursor || null,
                limit: limit
            },
            folder: "sf360/audio"
        });

    } catch (error) {
        console.error("Error fetching audio from Cloudinary:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch audio files",
                details: error instanceof Error ? error.message : "Unknown error"
            },
            { status: 500 }
        );
    }
}

// Helper function to parse filename and extract match information
function parseFileName(fileName: string): AudioMetadata['matchInfo'] {
    // Remove extension
    const nameWithoutExt = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, '');

    // Split by underscore
    const parts = nameWithoutExt.split('_');

    // Try to detect pattern: TEAM1_vs_TEAM2_type_speaker_date
    if (parts.length >= 4) {
        const vsIndex = parts.findIndex(p => p.toLowerCase() === 'vs');
        if (vsIndex !== -1 && vsIndex + 1 < parts.length) {
            const team1 = parts[vsIndex - 1];
            const team2 = parts[vsIndex + 1];
            const type = parts[vsIndex + 2] || 'unknown';
            const speaker = parts[vsIndex + 3] || 'unknown';
            const date = parts[vsIndex + 4] || '';

            return {
                team1: team1,
                team2: team2,
                type: type,
                speaker: speaker,
                date: date
            };
        }
    }

    return undefined;
}