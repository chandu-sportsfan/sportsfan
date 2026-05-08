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
  sr?: string;
  hs?: string;
  econ?: string;
}

export interface MatchCard {
  matchNo: number;
  date: string;      // e.g. "May 07"
  day: string;       // e.g. "Wed"
  time: string;      // e.g. "7:30 PM IST"
  teamA: string;     // abbr, e.g. "LSG"
  teamAFull: string;
  teamB: string;     // abbr, e.g. "RCB"
  teamBFull: string;
  venue: string;
  status: "upcoming" | "live" | "completed";
  result?: string;   // e.g. "MI won by 7 wickets"
}

export interface HighestScoreRow {
  rank: number;
  player: string;
  team: string;
  score: string; // e.g. "141*"
}

export interface MostFiftiesRow {
  rank: number;
  player: string;
  team: string;
  fifties: number;
}

export interface TodayMatch {
  teamA: string;
  teamAFull: string;
  teamB: string;
  teamBFull: string;
  time: string;
  venue: string;
  matchNo: number;
  totalMatches: number;
}

export interface RecentMatch {
  teamA: string;
  teamB: string;
  result: string;
  scoreA?: string;
  scoreB?: string;
  oversA?: string;
  oversB?: string;
}

export interface IPLStatsResponse {
  pointsTable: TeamRow[];
  orangeCap: PlayerRow[];
  purpleCap: PlayerRow[];
  todayMatch: TodayMatch;
  recentMatch: RecentMatch;
  upcomingMatches: MatchCard[];
  highestScores: HighestScoreRow[];
  mostFifties: MostFiftiesRow[];
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

function parseCaps(html: string): { orange: PlayerRow[]; purple: PlayerRow[] } {
  const tables = extractTables(html);
  if (tables.length >= 2) {
    const orange = extractRows(tables[0]).map((r) => mapPlayerRow(r, "orange")).filter(Boolean) as PlayerRow[];
    const purple = extractRows(tables[1]).map((r) => mapPlayerRow(r, "purple")).filter(Boolean) as PlayerRow[];
    return { orange, purple };
  }

  if (tables.length === 1) {
    const tbodyRe = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi;
    const bodies: string[] = [];
    let bm: RegExpExecArray | null;
    while ((bm = tbodyRe.exec(tables[0])) !== null) bodies.push(bm[1]);

    if (bodies.length >= 2) {
      const orange = extractRows(bodies[0]).map((r) => mapPlayerRow(r, "orange")).filter(Boolean) as PlayerRow[];
      const purple = extractRows(bodies[1]).map((r) => mapPlayerRow(r, "purple")).filter(Boolean) as PlayerRow[];
      return { orange, purple };
    }
  }

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

// ─── Mock data for new sections ───────────────────────────────────────────────
// Replace these with real CDN fetches when URLs are available

function getMockTodayMatch(): TodayMatch {
  return {
    teamA: "LSG",
    teamAFull: "Lucknow Super Giants",
    teamB: "RCB",
    teamBFull: "Royal Challengers Bengaluru",
    time: "7:30 PM IST",
    venue: "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow",
    matchNo: 50,
    totalMatches: 74,
  };
}

function getMockRecentMatch(): RecentMatch {
  return {
    teamA: "GT",
    teamB: "MI",
    result: "MI won by 7 wickets",
    scoreA: "174/8",
    scoreB: "175/3",
    oversA: "20.0",
    oversB: "18.4",
  };
}

function getMockUpcomingMatches(): MatchCard[] {
  return [
    {
      matchNo: 50,
      date: "May 07",
      day: "Wed",
      time: "7:30 PM IST",
      teamA: "LSG",
      teamAFull: "Lucknow Super Giants",
      teamB: "RCB",
      teamBFull: "Royal Challengers Bengaluru",
      venue: "Ekana Cricket Stadium, Lucknow",
      status: "upcoming",
    },
    {
      matchNo: 51,
      date: "May 08",
      day: "Thu",
      time: "7:30 PM IST",
      teamA: "PBKS",
      teamAFull: "Punjab Kings",
      teamB: "RR",
      teamBFull: "Rajasthan Royals",
      venue: "Himachal Pradesh Cricket Association Stadium, Dharamshala",
      status: "upcoming",
    },
    {
      matchNo: 52,
      date: "May 09",
      day: "Fri",
      time: "7:30 PM IST",
      teamA: "CSK",
      teamAFull: "Chennai Super Kings",
      teamB: "GT",
      teamBFull: "Gujarat Titans",
      venue: "MA Chidambaram Stadium, Chennai",
      status: "upcoming",
    },
    {
      matchNo: 53,
      date: "May 10",
      day: "Sat",
      time: "3:30 PM IST",
      teamA: "SRH",
      teamAFull: "Sunrisers Hyderabad",
      teamB: "KKR",
      teamBFull: "Kolkata Knight Riders",
      venue: "Rajiv Gandhi International Stadium, Hyderabad",
      status: "upcoming",
    },
  ];
}

function getMockHighestScores(): HighestScoreRow[] {
  return [
    { rank: 1, player: "Abhishek Sharma", team: "SRH", score: "141*" },
    { rank: 2, player: "Jos Buttler", team: "RR", score: "124*" },
    { rank: 3, player: "Quinton de Kock", team: "LSG", score: "108*" },
    { rank: 4, player: "Shubman Gill", team: "GT", score: "104" },
    { rank: 5, player: "Virat Kohli", team: "RCB", score: "100*" },
    { rank: 6, player: "Ruturaj Gaikwad", team: "CSK", score: "98" },
    { rank: 7, player: "KL Rahul", team: "LSG", score: "97*" },
    { rank: 8, player: "David Warner", team: "DC", score: "92" },
    { rank: 9, player: "Rohit Sharma", team: "MI", score: "91" },
    { rank: 10, player: "Faf du Plessis", team: "RCB", score: "88" },
  ];
}

function getMockMostFifties(): MostFiftiesRow[] {
  return [
    { rank: 1, player: "Sai Sudharsan", team: "GT", fifties: 6 },
    { rank: 2, player: "Abhishek Sharma", team: "SRH", fifties: 5 },
    { rank: 3, player: "Shubman Gill", team: "GT", fifties: 5 },
    { rank: 4, player: "Virat Kohli", team: "RCB", fifties: 4 },
    { rank: 5, player: "Jos Buttler", team: "RR", fifties: 4 },
    { rank: 6, player: "KL Rahul", team: "LSG", fifties: 3 },
    { rank: 7, player: "Rohit Sharma", team: "MI", fifties: 3 },
    { rank: 8, player: "Ruturaj Gaikwad", team: "CSK", fifties: 3 },
    { rank: 9, player: "David Warner", team: "DC", fifties: 2 },
    { rank: 10, player: "Hardik Pandya", team: "MI", fifties: 2 },
  ];
}

// ─── CORS Headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── CDN URLs ─────────────────────────────────────────────────────────────────

const POINTS_TABLE_URL =
  "https://res.cloudinary.com/dflnsufit/raw/upload/v1778156923/sf360/scripts/IPL_Points_Table_2026.html";
const CAPS_URL =
  "https://res.cloudinary.com/dflnsufit/raw/upload/v1778156925/sf360/scripts/IPL_Caps_2026.html";

// Placeholder URLs — replace when CDN endpoints are live:
 const MATCHES_STATS_URL    = "https://res.cloudinary.com/dflnsufit/raw/upload/v1778156927/sf360/scripts/IPL_Fixtures_2026.html";

// ─── Route handler ────────────────────────────────────────────────────────────

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

    const response: IPLStatsResponse = {
      pointsTable,
      orangeCap,
      purpleCap,
      todayMatch: getMockTodayMatch(),
      recentMatch: getMockRecentMatch(),
      upcomingMatches: getMockUpcomingMatches(),
      highestScores: getMockHighestScores(),
      mostFifties: getMockMostFifties(),
    };

    return NextResponse.json(response, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    console.error("Failed to fetch / parse IPL CDN data:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
