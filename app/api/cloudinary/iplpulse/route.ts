// app/api/cloudinary/pulse/route.ts
import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

interface CloudinaryResource {
  public_id: string;
  secure_url: string;
  created_at: string;
  bytes: number;
  format: string;
  display_name: string;
}

interface PulseFileMeta {
  id: string;
  fileName: string;
  url: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  /** YYYY-MM-DD extracted from filename like ipl_pulse_2026-05-12.json */
  reportDate: string | null;
  /** Human-readable label e.g. "May 12, 2026" */
  reportDateFormatted: string | null;
}

interface CloudinaryApiParams {
  resource_type: string;
  type: string;
  prefix: string;
  max_results: number;
  next_cursor?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extract YYYY-MM-DD from filenames like ipl_pulse_2026-05-12.json or ipl_pulse_latest.json */
function extractReportDate(fileName: string): string | null {
  const match = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function formatReportDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e:unknown) {
    if (e instanceof Error) {
      console.error("Error formatting report date:", e.message);
    }
    return dateStr;
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get("mode") || "latest"; // "latest" | "list"
    const nextCursor = searchParams.get("nextCursor");

    // ── MODE: list — return metadata of all pulse files ──────────────────────
    if (mode === "list") {
      const params: CloudinaryApiParams = {
        resource_type: "raw",
        type: "upload",
        prefix: "sf360/pulse",
        max_results: 50,
      };
      if (nextCursor) params.next_cursor = nextCursor;

      const result = await cloudinary.api.resources(params);

      const files: PulseFileMeta[] = result.resources
        .map((r: CloudinaryResource) => {
          const fileName = r.display_name || r.public_id.split("/").pop() || r.public_id;
          const reportDate = extractReportDate(fileName);
          return {
            id: r.public_id,
            fileName,
            url: r.secure_url,
            size: r.bytes,
            sizeFormatted: formatFileSize(r.bytes),
            createdAt: r.created_at,
            reportDate,
            reportDateFormatted: formatReportDate(reportDate),
          };
        })
        .sort((a: PulseFileMeta, b: PulseFileMeta) => {
          if (!a.reportDate && !b.reportDate) return 0;
          if (!a.reportDate) return 1;
          if (!b.reportDate) return -1;
          return b.reportDate.localeCompare(a.reportDate);
        });

      return NextResponse.json({
        success: true,
        files,
        totalCount: files.length,
        pagination: {
          hasMore: !!result.next_cursor,
          nextCursor: result.next_cursor || null,
        },
      });
    }

    // ── MODE: latest — fetch and return the JSON content of the latest pulse ─
    const latestUrl = "https://res.cloudinary.com/dflnsufit/raw/upload/sf360/pulse/ipl_pulse_latest.json";

    const res = await fetch(latestUrl, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!res.ok) {
      throw new Error(`Cloudinary fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /api/cloudinary/pulse:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch IPL Pulse data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}