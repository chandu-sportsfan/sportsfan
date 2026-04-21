// // app/api/cloudinary/audio/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import cloudinary from "@/lib/cloudinary";

// interface CloudinaryResource {
//     public_id: string;
//     secure_url: string;
//     duration: number;
//     created_at: string;
//     bytes: number;
//     format: string;
//     filename: string;
//     original_filename: string;
//     display_name: string;
// }

// interface AudioMetadata {
//     id: string;
//     title: string;
//     fileName: string;
//     url: string;
//     duration: string;
//     durationSeconds: number;
//     size: number;
//     sizeFormatted: string;
//     format: string;
//     createdAt: string;
//     createdAtFormatted: string;
//     folder: string;
//     matchInfo?: {
//         team1?: string;
//         team2?: string;
//         type?: string;
//         speaker?: string;
//         date?: string;
//     };
// }

// interface CloudinaryApiParams {
//     resource_type: string;
//     type: string;
//     prefix: string;
//     max_results: number;
//     next_cursor?: string;
// }

// export async function GET(req: NextRequest) {
//     try {
//         const searchParams = req.nextUrl.searchParams;
//         const limit = parseInt(searchParams.get("limit") || "50");
//         const nextCursor = searchParams.get("nextCursor");
//         const search = searchParams.get("search")?.toLowerCase();

//         // Build Cloudinary API parameters
//         const params: CloudinaryApiParams = {
//             resource_type: "video", // Audio files use 'video' resource type
//             type: "upload",
//             prefix: "sf360/audio", // Your folder path
//             max_results: limit,
//         };

//         if (nextCursor) {
//             params.next_cursor = nextCursor;
//         }

//         // Fetch resources from Cloudinary
//         const result = await cloudinary.search
//             .expression("folder:sf360/audio resource_type:video")
//             .with_field("duration")
//             .sort_by("created_at", "desc")
//             .max_results(limit)
//             .execute();

//         // Transform and enrich audio data
//         let audioFiles: AudioMetadata[] = result.resources.map((resource: CloudinaryResource) => {
//             // Extract filename without extension
//             const fileName = resource.display_name || resource.public_id.split('/').pop() || resource.public_id;
//             const title = fileName.replace(/_/g, ' ');

//             // Parse filename to extract match info (based on your naming convention)

//             const matchInfo = parseFileName(resource.display_name || fileName);

//             // Format duration
//             const formatDuration = (seconds: number): string => {
//                 const minutes = Math.floor(seconds / 60);
//                 const secs = Math.floor(seconds % 60);
//                 return `${minutes}:${secs.toString().padStart(2, '0')}`;
//             };

//             // Format file size
//             const formatFileSize = (bytes: number): string => {
//                 if (bytes < 1024) return `${bytes} B`;
//                 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
//                 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
//             };

//             // Format date
//             const formatDate = (dateString: string): string => {
//                 const date = new Date(dateString);
//                 return date.toLocaleDateString('en-IN', {
//                     day: '2-digit',
//                     month: 'short',
//                     year: 'numeric',
//                     hour: '2-digit',
//                     minute: '2-digit'
//                 });
//             };

//             return {
//                 id: resource.public_id,
//                 title: title,
//                 fileName: fileName,
//                 url: resource.secure_url,
//                 duration: formatDuration(resource.duration || 0),
//                 durationSeconds: resource.duration || 0,
//                 size: resource.bytes,
//                 sizeFormatted: formatFileSize(resource.bytes),
//                 format: resource.format,
//                 createdAt: resource.created_at,
//                 createdAtFormatted: formatDate(resource.created_at),
//                 folder: "sf360/audio",
//                 matchInfo: matchInfo
//             };
//         });

//         // Apply search filter if provided
//         if (search) {
//             audioFiles = audioFiles.filter(audio =>
//                 audio.title.toLowerCase().includes(search) ||
//                 audio.matchInfo?.team1?.toLowerCase().includes(search) ||
//                 audio.matchInfo?.team2?.toLowerCase().includes(search) ||
//                 audio.matchInfo?.speaker?.toLowerCase().includes(search)
//             );
//         }

//         // Sort by newest first
//         audioFiles.sort((a, b) =>
//             new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//         );

//         return NextResponse.json({
//             success: true,
//             audioFiles,
//             totalCount: audioFiles.length,
//             pagination: {
//                 hasMore: !!result.next_cursor,
//                 nextCursor: result.next_cursor || null,
//                 limit: limit
//             },
//             folder: "sf360/audio"
//         });

//     } catch (error) {
//         console.error("Error fetching audio from Cloudinary:", error);
//         return NextResponse.json(
//             {
//                 success: false,
//                 error: "Failed to fetch audio files",
//                 details: error instanceof Error ? error.message : "Unknown error"
//             },
//             { status: 500 }
//         );
//     }
// }

// // Helper function to parse filename and extract match information
// function parseFileName(fileName: string): AudioMetadata['matchInfo'] {
//     const nameWithoutExt = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, '');
//     const parts = nameWithoutExt.split('_');

//     if (parts.length < 4) return undefined;

//     const vsIndex = parts.findIndex(p => p.toLowerCase() === 'vs');
//     if (vsIndex === -1 || vsIndex + 1 >= parts.length) return undefined;

//     const team1 = parts[vsIndex - 1];
//     const team2 = parts[vsIndex + 1];

//     // Everything after team2, excluding trailing 8-digit date
//     const remainder = parts.slice(vsIndex + 2);

//     // Detect trailing date like "20042026" (8 digits)
//     const datePattern = /^\d{8}$/;
//     const dateIndex = remainder.findIndex(p => datePattern.test(p));

//     const date = dateIndex !== -1 ? remainder[dateIndex] : '';
//     const nonDateParts = dateIndex !== -1 ? remainder.slice(0, dateIndex) : remainder;

//     // Known match type keywords
//     const typeKeywords = ['post', 'pre', 'mid', 'match', 'fan', 'highlights'];

//     // Separate type words from speaker name words
//     const typeParts: string[] = [];
//     const speakerParts: string[] = [];
//     let speakerStarted = false;

//     for (const part of nonDateParts) {
//         if (!speakerStarted && typeKeywords.includes(part.toLowerCase())) {
//             typeParts.push(part);
//         } else {
//             speakerStarted = true;
//             speakerParts.push(part);
//         }
//     }

//     return {
//         team1,
//         team2,
//         type: typeParts.join(' ') || 'unknown',       // "post match"
//         speaker: speakerParts.join(' ') || 'unknown',  // "Kabir Sharma"
//         date,
//     };
// }



















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
    image_metadata: boolean;
    next_cursor?: string;
}

function formatDuration(seconds: number): string {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function parseFileName(fileName: string): AudioMetadata["matchInfo"] {
    const nameWithoutExt = fileName.replace(/\.(mp3|wav|m4a|ogg)$/i, "");
    const parts = nameWithoutExt.split("_");

    if (parts.length < 4) return undefined;

    const vsIndex = parts.findIndex((p) => p.toLowerCase() === "vs");
    if (vsIndex === -1 || vsIndex + 1 >= parts.length) return undefined;

    const team1 = parts[vsIndex - 1];
    const team2 = parts[vsIndex + 1];
    const remainder = parts.slice(vsIndex + 2);

    const datePattern = /^\d{8}$/;
    const dateIndex = remainder.findIndex((p) => datePattern.test(p));

    const date = dateIndex !== -1 ? remainder[dateIndex] : "";
    const nonDateParts = dateIndex !== -1 ? remainder.slice(0, dateIndex) : remainder;

    const typeKeywords = ["post", "pre", "mid", "match", "fan", "highlights"];
    const typeParts: string[] = [];
    const speakerParts: string[] = [];
    let speakerStarted = false;

    for (const part of nonDateParts) {
        if (!speakerStarted && typeKeywords.includes(part.toLowerCase())) {
            typeParts.push(part);
        } else {
            speakerStarted = true;
            speakerParts.push(part);
        }
    }

    return {
        team1,
        team2,
        type: typeParts.join(" ") || "unknown",
        speaker: speakerParts.join(" ") || "unknown",
        date,
    };
}

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 50);
        const nextCursor = searchParams.get("nextCursor");
        const search = searchParams.get("search")?.toLowerCase();

        const params: CloudinaryApiParams = {
            resource_type: "video",
            type: "upload",
            prefix: "sf360/audio",
            max_results: limit,
            image_metadata: true,
        };

        if (nextCursor) {
            params.next_cursor = nextCursor;
        }

        const result = await cloudinary.api.resources(params);

        let audioFiles: AudioMetadata[] = result.resources.map(
            (resource: CloudinaryResource) => {
                const fileName =
                    resource.display_name ||
                    resource.public_id.split("/").pop() ||
                    resource.public_id;
                const title = fileName.replace(/_/g, " ");
                const matchInfo = parseFileName(resource.display_name || fileName);

                return {
                    id: resource.public_id,
                    title,
                    fileName,
                    url: resource.secure_url,
                    duration: formatDuration(resource.duration),
                    durationSeconds: resource.duration || 0,
                    size: resource.bytes,
                    sizeFormatted: formatFileSize(resource.bytes),
                    format: resource.format,
                    createdAt: resource.created_at,
                    createdAtFormatted: formatDate(resource.created_at),
                    folder: "sf360/audio",
                    matchInfo,
                };
            }
        );

        if (search) {
            audioFiles = audioFiles.filter(
                (audio) =>
                    audio.title.toLowerCase().includes(search) ||
                    audio.matchInfo?.team1?.toLowerCase().includes(search) ||
                    audio.matchInfo?.team2?.toLowerCase().includes(search) ||
                    audio.matchInfo?.speaker?.toLowerCase().includes(search)
            );
        }

        audioFiles.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return NextResponse.json({
            success: true,
            audioFiles,
            totalCount: audioFiles.length,
            pagination: {
                hasMore: !!result.next_cursor,
                nextCursor: result.next_cursor || null,
                limit,
            },
            folder: "sf360/audio",
        });
    } catch (error) {
        console.error("Error fetching audio from Cloudinary:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch audio files",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}