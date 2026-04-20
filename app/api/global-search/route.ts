
// app/api/global-search/route.ts (Modified for your data structure)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Define proper interfaces for the data structures
interface PlayerHomeData {
    playerName: string;
    playerNameLower?: string;
    playerProfilesId?: string;
    title?: string;
    image?: string;
    logo?: string;
}

interface PlayerSeasonData {
    playerProfilesId: string;
    season: {
        jerseyNo?: string;
        year?: string;
    };
}

interface PlayerProfileData {
    name: string;
    team?: string;
    avatar?: string;
    stats?: {
        runs?: string;
        sr?: string;
        avg?: string;
    };
}

interface TeamData {
    teamName: string;
    teamNameLower?: string;
    logo?: string;
    category?: string[];
}

interface SearchResult {
    type: 'player' | 'team';
    id: string;
    playerProfilesId?: string;
    name: string;
    image?: string | null;
    logo?: string | null;
    jerseyNumber?: string | null;
    team?: string | null;
    category?: string[];
    stats?: {
        runs?: string;
        sr?: string;
        avg?: string;
    };
}

export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const query = searchParams.get("q")?.toLowerCase().trim();

        if (!query) {
            return NextResponse.json({ results: [] });
        }

        // Check if query is a number (for jersey number search)
        const isJerseyNumber = !isNaN(parseInt(query));
        
        const playersMap = new Map<string, SearchResult>(); // Use Map to avoid duplicates
        const teams: SearchResult[] = [];

        // 1️⃣ SEARCH PLAYERS BY NAME from playershome collection
        try {
            const playersByNameSnapshot = await db.collection("playershome")
                .where("playerNameLower", ">=", query)
                .where("playerNameLower", "<=", query + "\uf8ff")
                .limit(15)
                .get();
            
            for (const doc of playersByNameSnapshot.docs) {
                const data = doc.data() as PlayerHomeData;
                const playerProfilesId = data.playerProfilesId || doc.id;
                
                // Fetch full player profile to get additional details
                let playerProfile: PlayerProfileData | null = null;
                try {
                    const profileDoc = await db.collection("playerProfiles").doc(playerProfilesId).get();
                    if (profileDoc.exists) {
                        playerProfile = profileDoc.data() as PlayerProfileData;
                    }
                } catch (err) {
                    console.error(`Failed to fetch profile for ${playerProfilesId}:`, err);
                }
                
                playersMap.set(playerProfilesId, {
                    type: 'player',
                    id: doc.id,
                    playerProfilesId: playerProfilesId,
                    name: data.playerName,
                    image: data.image || playerProfile?.avatar || null,
                    jerseyNumber: null, // Will be updated from season data
                    team: playerProfile?.team || null,
                    category: [],
                    stats: playerProfile?.stats || undefined
                });
            }
        } catch (error) {
            console.error("Error searching players by name:", error);
        }

        // 2️⃣ SEARCH BY JERSEY NUMBER from playerSeasons collection
        if (isJerseyNumber) {
            const jerseyNumber = query;
            try {
                const playersByJerseySnapshot = await db.collection("playerSeasons")
                    .where("season.jerseyNo", "==", jerseyNumber)
                    .limit(10)
                    .get();
                
                for (const doc of playersByJerseySnapshot.docs) {
                    const data = doc.data() as PlayerSeasonData;
                    const playerProfilesId = data.playerProfilesId;
                    
                    if (!playersMap.has(playerProfilesId)) {
                        // Fetch player details from playershome
                        let playerName = "";
                        let playerImage = null;
                        let playerTeam = null;
                        
                        try {
                            const playerHomeQuery = await db.collection("playershome")
                                .where("playerProfilesId", "==", playerProfilesId)
                                .limit(1)
                                .get();
                            
                            if (!playerHomeQuery.empty) {
                                const playerData = playerHomeQuery.docs[0].data() as PlayerHomeData;
                                playerName = playerData.playerName;
                                playerImage = playerData.image || null;
                            }
                            
                            // Fetch profile for team info
                            const profileDoc = await db.collection("playerProfiles").doc(playerProfilesId).get();
                            if (profileDoc.exists) {
                                const profileData = profileDoc.data() as PlayerProfileData;
                                playerTeam = profileData.team || null;
                                if (!playerImage) playerImage = profileData.avatar || null;
                            }
                        } catch (err) {
                            console.error(`Failed to fetch player details for ${playerProfilesId}:`, err);
                        }
                        
                        if (playerName) {
                            playersMap.set(playerProfilesId, {
                                type: 'player',
                                id: doc.id,
                                playerProfilesId: playerProfilesId,
                                name: playerName,
                                image: playerImage,
                                jerseyNumber: jerseyNumber,
                                team: playerTeam,
                                category: [],
                            });
                        }
                    } else {
                        // Update existing entry with jersey number
                        const existing = playersMap.get(playerProfilesId);
                        if (existing) {
                            existing.jerseyNumber = jerseyNumber;
                            playersMap.set(playerProfilesId, existing);
                        }
                    }
                }
            } catch (error) {
                console.error("Error searching by jersey number:", error);
            }
        }

        // Also search by jersey number in playerSeasons for different field structure
        if (isJerseyNumber) {
            try {
                const playersByJerseyAltSnapshot = await db.collection("playerSeasons")
                    .where("jerseyNumber", "==", parseInt(query))
                    .limit(5)
                    .get();
                
                for (const doc of playersByJerseyAltSnapshot.docs) {
                    const data = doc.data() as PlayerSeasonData & { jerseyNumber?: number };
                    const playerProfilesId = data.playerProfilesId;
                    
                    if (!playersMap.has(playerProfilesId)) {
                        let playerName = "";
                        let playerImage = null;
                        
                        try {
                            const playerHomeQuery = await db.collection("playershome")
                                .where("playerProfilesId", "==", playerProfilesId)
                                .limit(1)
                                .get();
                            
                            if (!playerHomeQuery.empty) {
                                const playerData = playerHomeQuery.docs[0].data() as PlayerHomeData;
                                playerName = playerData.playerName;
                                playerImage = playerData.image || null;
                            }
                        } catch (err) {
                            console.error(err);
                        }
                        
                        if (playerName) {
                            playersMap.set(playerProfilesId, {
                                type: 'player',
                                id: doc.id,
                                playerProfilesId: playerProfilesId,
                                name: playerName,
                                image: playerImage,
                                jerseyNumber: query,
                                team: null,
                                category: [],
                            });
                        }
                    }
                }
            } catch (error) {
                console.error("Error searching by jersey number (alt):", error);
            }
        }

        // 3️⃣ SEARCH TEAMS BY NAME from team360Posts
        try {
            const teamsSnapshot = await db.collection("team360Posts")
                .where("teamNameLower", ">=", query)
                .where("teamNameLower", "<=", query + "\uf8ff")
                .limit(10)
                .get();
            
            for (const doc of teamsSnapshot.docs) {
                const data = doc.data() as TeamData;
                teams.push({
                    type: 'team',
                    id: doc.id,
                    name: data.teamName,
                    logo: data.logo || null,
                    category: data.category || [],
                });
            }
        } catch (error) {
            console.error("Error searching teams:", error);
        }

        // Also search teams in a simpler way if the above fails
        if (teams.length === 0) {
            try {
                const allTeamsSnapshot = await db.collection("team360Posts").limit(20).get();
                for (const doc of allTeamsSnapshot.docs) {
                    const data = doc.data() as TeamData;
                    const teamName = data.teamName?.toLowerCase() || "";
                    if (teamName.includes(query)) {
                        teams.push({
                            type: 'team',
                            id: doc.id,
                            name: data.teamName,
                            logo: data.logo || null,
                            category: data.category || [],
                        });
                    }
                }
            } catch (error) {
                console.error("Error in fallback team search:", error);
            }
        }

        // Convert Map to array for players
        const players = Array.from(playersMap.values());

        // Combine results (players first, then teams)
        const results = [...players.slice(0, 10), ...teams.slice(0, 10)];

        return NextResponse.json({ 
            success: true, 
            results,
            totalCount: results.length,
            searchInfo: {
                query,
                isJerseyNumber,
                playersFound: players.length,
                teamsFound: teams.length
            }
        });
        
    } catch (error) {
        console.error("Global search error:", error);
        return NextResponse.json(
            { success: false, error: "Search failed", results: [] },
            { status: 500 }
        );
    }
}
