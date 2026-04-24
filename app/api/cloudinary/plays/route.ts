import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const PLAYS_FILE = path.join(process.cwd(), "data", "plays.json");

function readPlays(): Record<string, number> {
    try {
        if (!fs.existsSync(PLAYS_FILE)) return {};
        return JSON.parse(fs.readFileSync(PLAYS_FILE, "utf-8"));
    } catch {
        return {};
    }
}

function writePlays(data: Record<string, number>) {
    const dir = path.dirname(PLAYS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PLAYS_FILE, JSON.stringify(data, null, 2));
}

// GET /api/cloudinary/plays — returns all play counts
export async function GET() {
    const plays = readPlays();
    return NextResponse.json({ success: true, plays });
}

// POST /api/cloudinary/plays — increment play count for an id
export async function POST(req: NextRequest) {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false }, { status: 400 });

    const plays = readPlays();
    plays[id] = (plays[id] || 0) + 1;
    writePlays(plays);

    return NextResponse.json({ success: true, plays: plays[id] });
}