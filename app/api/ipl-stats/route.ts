import { NextResponse } from "next/server";

export async function GET() {
    try {
        // The exact ID for the 2026 IPL Season on CricketData
        const seriesId = "87c62aac-bc3c-4738-ab93-19da0690488f"; 
        
        // We use 'series_info' to grab all matches and calculate the table dynamically
        const url = `https://api.cricapi.com/v1/series_info?apikey=${process.env.CRICKETDATA_API_KEY}&id=${seriesId}`;

        const response = await fetch(url, { next: { revalidate: 3600 } });
        const data = await response.json();

        // 1. Crash Protection: If the API fails, return empty arrays instead of crashing
        if (data.status === "failure") {
            console.error("🚨 CRICKETDATA API ERROR:", data.reason);
            return NextResponse.json({ pointsTable: [], orangeCap: [], purpleCap: [] });
        }

        // --- THE WORKAROUND: Calculate the points table dynamically ---
        const matches = data.data?.matchList || [];
        const teamStats: Record<string, any> = {};

        // Step A: Create a blank stat sheet for every team found in the schedule
        matches.forEach((match: any) => {
            if (!match.teamInfo || match.teamInfo.length < 2) return;
            match.teamInfo.forEach((team: any) => {
                if (!teamStats[team.shortname]) {
                    teamStats[team.shortname] = {
                        name: team.name, 
                        abbr: team.shortname, 
                        m: 0, w: 0, l: 0, nr: 0, pts: 0, nrr: "0.00", form: []
                    };
                }
            });
        });

        // Step B: Loop through all finished matches and assign points based on who won
        matches.forEach((match: any) => {
            if (match.matchEnded && match.teamInfo && match.teamInfo.length === 2) {
                const team1 = match.teamInfo[0];
                const team2 = match.teamInfo[1];
                
                teamStats[team1.shortname].m += 1;
                teamStats[team2.shortname].m += 1;

                // The 'status' string usually says who won (e.g., "Punjab Kings won by...")
                if (match.status.includes(team1.name)) {
                     teamStats[team1.shortname].w += 1;
                     teamStats[team1.shortname].pts += 2;
                     teamStats[team1.shortname].form.unshift("W"); // Add W to recent form
                     
                     teamStats[team2.shortname].l += 1;
                     teamStats[team2.shortname].form.unshift("L");
                } else if (match.status.includes(team2.name)) {
                     teamStats[team2.shortname].w += 1;
                     teamStats[team2.shortname].pts += 2;
                     teamStats[team2.shortname].form.unshift("W");
                     
                     teamStats[team1.shortname].l += 1;
                     teamStats[team1.shortname].form.unshift("L");
                } else {
                     // Handle ties or no-results
                     teamStats[team1.shortname].nr += 1;
                     teamStats[team1.shortname].pts += 1;
                     teamStats[team1.shortname].form.unshift("N");
                     
                     teamStats[team2.shortname].nr += 1;
                     teamStats[team2.shortname].pts += 1;
                     teamStats[team2.shortname].form.unshift("N");
                }
            }
        });

        // Step C: Sort the teams by points and format them for your frontend
        let calculatedPointsTable = Object.values(teamStats).sort((a: any, b: any) => b.pts - a.pts);
        
        calculatedPointsTable = calculatedPointsTable.map((team: any, index: number) => ({
            ...team,
            pos: index + 1,
            qual: index < 4, // Top 4 qualify visually
            form: team.form.length > 0 ? team.form.slice(0, 5) : ["N", "N", "N", "N", "N"]
        }));

        // ... (Keep all your existing points table calculation code above this) ...

        // NEW STEP: Filter for matches that haven't ended yet
        const upcomingMatches = matches
            .filter((match: any) => match.matchEnded === false)
            .slice(0, 5) // Just grab the next 5 matches
            .map((match: any) => ({
                id: match.id,
                name: match.name, // e.g., "CSK vs MI, 12th Match"
                date: match.date,
                venue: match.venue,
                teams: match.teamInfo?.map((t: any) => t.shortname).join(" vs ") || "TBD"
            }));
        
        const recentResults = matches
        .filter((match: any) => match.matchEnded === true)
        .slice(-5) // Grab the 5 most recently completed matches
        .reverse() // Put the newest one at the top
        .map((match: any) => ({
            id: match.id,
            name: match.name,
            date: match.date,
            result: match.status // e.g., "Punjab Kings won by 4 wickets"
        }));    

        // 2. Send the real data to your UI!
        return NextResponse.json({
            pointsTable: calculatedPointsTable,
            
            // Swap out the caps for real upcoming fixtures
            upcomingMatches: upcomingMatches, 

            recentResults: recentResults,
            
            // You can keep one mock data array if you still want a visual placeholder 
            // while you design the Upcoming Matches component
            topPerformersMock: [] 
        });

    } catch (error) {
        console.error("Server Error:", error);
        return NextResponse.json({ error: "Failed to fetch IPL stats" }, { status: 500 });
    }
}
