import { NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamRow {
  rank: number;
  abbr: string;
  name: string;
  qualified: boolean;
  m: number;
  w: number;
  l: number;
  nr: number;
  pts: number;
  nrr: string;
}

export interface PlayerRow {
  rank: number;
  player: string;
  team: string;
  m: number;
  runs?: number;
  wickets?: number;
  avg: string;
  sr: string;
  hs?: string;
  econ?: string;
}

// ─── HTML parsing helpers ─────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(html: string): string[][] {
  const rows: string[][] = [];
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(cleaned)) !== null) {
    const cells: string[] = [];
    const tdRegex = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/**
 * Depth-aware <table> extractor — correctly handles nested tables.
 */
function extractTables(html: string): string[] {
  const tables: string[] = [];
  let depth = 0;
  let start = -1;
  const tokenRe = /(<table\b)|(<\/table>)/gi;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1]) {
      if (depth === 0) start = m.index;
      depth++;
    } else {
      depth--;
      if (depth === 0 && start !== -1) {
        tables.push(html.slice(start, m.index + m[0].length));
        start = -1;
      }
    }
  }
  return tables;
}

// ─── Points-table parser ──────────────────────────────────────────────────────

function parsePointsTable(html: string): TeamRow[] {
  const rows = extractRows(html);
  return rows
    .filter((row) => /^\d{1,2}$/.test(row[0]) && Number(row[0]) <= 10)
    .map((row): TeamRow => {
      const rank = Number(row[0]);
      let abbr = "";
      let name = "";
      let offset = 1;

      if (/^[A-Z]{2,5}$/.test(row[1])) {
        abbr = row[1];
        name = row[2] || "";
        offset = 3;
      } else {
        const mm = row[1].match(/^([A-Z]{2,5})\s+(.*)/);
        if (mm) { abbr = mm[1]; name = mm[2]; }
        else    { name = row[1]; }
        offset = 2;
      }

      return {
        rank, abbr, name,
        qualified: rank <= 4,
        m:   Number(row[offset])     || 0,
        w:   Number(row[offset + 1]) || 0,
        l:   Number(row[offset + 2]) || 0,
        nr:  Number(row[offset + 3]) || 0,
        pts: Number(row[offset + 4]) || 0,
        nrr: row[offset + 5] || "0.000",
      };
    });
}

// ─── Caps parser ──────────────────────────────────────────────────────────────

function mapPlayerRow(row: string[], type: "orange" | "purple"): PlayerRow | null {
  if (!/^\d+$/.test(row[0])) return null;
  const rank = Number(row[0]);

  let player = "";
  let team   = "";
  let offset = 1;

  if (row[2] && /^[A-Z]{2,5}$/.test(row[2])) {
    player = row[1];
    team   = row[2];
    offset = 3;
  } else {
    const combined = row[1] || "";
    const mm = combined.match(/^(.*?)\s+([A-Z]{2,5})$/);
    if (mm) { player = mm[1]; team = mm[2]; }
    else    { player = combined; team = row[2] || ""; }
    offset = 3;
  }

  if (type === "orange") {
    return {
      rank, player, team,
      m:    Number(row[offset])     || 0,
      runs: Number(row[offset + 1]) || 0,
      avg:  row[offset + 2] || "-",
      sr:   row[offset + 3] || "-",
      hs:   row[offset + 4] || "-",
    };
  }
  return {
    rank, player, team,
    m:       Number(row[offset])     || 0,
    wickets: Number(row[offset + 1]) || 0,
    avg:     row[offset + 2] || "-",
    econ:    row[offset + 3] || "-",
    hs:      row[offset + 4] || "-",
  };
}

/**
 * Three-strategy parser — survives any HTML layout the CDN uses.
 *
 * Strategy 1: two separate <table> blocks  → table[0]=orange, table[1]=purple
 * Strategy 2: one <table>, two <tbody>     → tbody[0]=orange, tbody[1]=purple
 * Strategy 3: keyword scan across all rows (last resort)
 */
function parseCaps(html: string): { orange: PlayerRow[]; purple: PlayerRow[] } {

  // Strategy 1: multiple top-level tables
  const tables = extractTables(html);
  if (tables.length >= 2) {
    console.log("[parseCaps] Strategy 1: " + tables.length + " tables found");
    const orange = extractRows(tables[0]).map((r) => mapPlayerRow(r, "orange")).filter(Boolean) as PlayerRow[];
    const purple = extractRows(tables[1]).map((r) => mapPlayerRow(r, "purple")).filter(Boolean) as PlayerRow[];
    return { orange, purple };
  }

  // Strategy 2: one table, two tbody blocks
  if (tables.length === 1) {
    const tbodyRe = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi;
    const bodies: string[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = tbodyRe.exec(tables[0])) !== null) bodies.push(bm[1]);

    if (bodies.length >= 2) {
      console.log("[parseCaps] Strategy 2: " + bodies.length + " tbody blocks found");
      const orange = extractRows(bodies[0]).map((r) => mapPlayerRow(r, "orange")).filter(Boolean) as PlayerRow[];
      const purple = extractRows(bodies[1]).map((r) => mapPlayerRow(r, "purple")).filter(Boolean) as PlayerRow[];
      return { orange, purple };
    }
  }

  // Strategy 3: keyword scan fallback
  console.log("[parseCaps] Strategy 3: keyword scan");
  const rows = extractRows(html);
  const orange: PlayerRow[] = [];
  const purple: PlayerRow[] = [];
  let section: "orange" | "purple" | "" = "";

  for (const row of rows) {
    const text = row.join(" ").toLowerCase();
    if (text.includes("orange") || text.includes("batting") || text.includes("run")) {
      section = "orange"; continue;
    }
    if (text.includes("purple") || text.includes("bowling") || text.includes("wicket")) {
      section = "purple"; continue;
    }
    if (!section) continue;
    const p = mapPlayerRow(row, section);
    if (p) (section === "orange" ? orange : purple).push(p);
  }

  return { orange, purple };
}

// ─── Route handler ────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const POINTS_TABLE_URL =
  "https://res.cloudinary.com/dflnsufit/raw/upload/v1777856863/sf360/scripts/IPL_Points_Table_2026.html";
const CAPS_URL =
  "https://res.cloudinary.com/dflnsufit/raw/upload/v1777856864/sf360/scripts/IPL_Caps_2026.html";

export async function GET() {
  try {
    const [pointsRes, capsRes] = await Promise.all([
      fetch(POINTS_TABLE_URL, { cache: "no-store" }),
      fetch(CAPS_URL, { cache: "no-store" }),
    ]);

    if (!pointsRes.ok || !capsRes.ok) {
      throw new Error("One or more CDN fetches failed");
    }

    const [pointsHtml, capsHtml] = await Promise.all([
      pointsRes.text(),
      capsRes.text(),
    ]);

    const pointsTable = parsePointsTable(pointsHtml);
    const { orange: orangeCap, purple: purpleCap } = parseCaps(capsHtml);

    // ── TEMPORARY DEBUG — remove _debug once rows appear in the UI ───────────
    const capsTables = extractTables(capsHtml);
    const allCapsRows = extractRows(capsHtml);

    return NextResponse.json(
      {
        pointsTable,
        orangeCap,
        purpleCap,
        _debug: {
          tableCount:  capsTables.length,
          totalRows:   allCapsRows.length,
          first5Rows:  allCapsRows.slice(0, 5),
          orangeCount: orangeCap.length,
          purpleCount: purpleCap.length,
        },
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("Failed to fetch / parse IPL CDN data:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
