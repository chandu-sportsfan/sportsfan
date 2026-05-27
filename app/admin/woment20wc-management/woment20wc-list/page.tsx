// admin/womens-worldcup/matches-list/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Link from "next/link";

interface WomensMatch {
  id: string;
  matchId: number;
  date: string;
  team1: string;
  team2: string;
  winner: string;
  venue: string;
  innings1: { runs: number; wickets: number };
  innings2: { runs: number; wickets: number };
  isNoResult: boolean;
}

export default function WomensMatchesListPage() {
  const [matches, setMatches] = useState<WomensMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState("");
  const [filterVenue, setFilterVenue] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [teams, setTeams] = useState<string[]>([]);
  const [venues, setVenues] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", "200");
      
      const res = await axios.get(`/api/womens-matches?${params}`);
      if (res.data.success) {
        const apiMatches = res.data.matches as WomensMatch[];
        setMatches(apiMatches);

        // Extract unique values for filters
        const allTeams = [...new Set(apiMatches.flatMap((m) => [m.team1, m.team2]))].sort();
        const allVenues = [...new Set(apiMatches.map((m) => m.venue))].sort();
        const allYears = [...new Set(apiMatches.map((m) => new Date(m.date).getFullYear().toString()))].sort().reverse();
        
        setTeams(allTeams);
        setVenues(allVenues);
        setYears(allYears);
      }
    } catch (err) {
      console.error("Error fetching matches:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleDelete = async (id: string, matchId: number) => {
    if (confirm(`Delete match ${matchId}? This action cannot be undone.`)) {
      try {
        await axios.delete(`/api/womens-matches/${id}`);
        fetchMatches();
      } catch {
        alert("Failed to delete");
      }
    }
  };

  // Apply filters
  const filteredMatches = matches.filter((match) => {
    if (filterTeam && match.team1 !== filterTeam && match.team2 !== filterTeam) return false;
    if (filterVenue && match.venue !== filterVenue) return false;
    if (filterYear && new Date(match.date).getFullYear().toString() !== filterYear) return false;
    return true;
  });

  const exportToCSV = () => {
    const headers = ["Match ID", "Date", "Team 1", "Team 2", "Winner", "Venue", "Score"];
    const rows = filteredMatches.map((m) => [
      m.matchId,
      new Date(m.date).toLocaleDateString(),
      m.team1,
      m.team2,
      m.isNoResult ? "No Result" : (m.winner || "—"),
      m.venue,
      `${m.innings1.runs}/${m.innings1.wickets} → ${m.innings2.runs}/${m.innings2.wickets}`
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `womens_matches_backup_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🏏 Women&apos;s World Cup Matches</h1>
        <Link 
          href="/admin/womens-worldcup/add-match" 
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
        >
          + Add New Match
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-gray-400 block mb-1">Filter by Team</label>
            <select 
              value={filterTeam} 
              onChange={(e) => setFilterTeam(e.target.value)} 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              <option value="">All Teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs text-gray-400 block mb-1">Filter by Venue</label>
            <select 
              value={filterVenue} 
              onChange={(e) => setFilterVenue(e.target.value)} 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              <option value="">All Venues</option>
              {venues.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-gray-400 block mb-1">Filter by Year</label>
            <select 
              value={filterYear} 
              onChange={(e) => setFilterYear(e.target.value)} 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button 
            onClick={() => { setFilterTeam(""); setFilterVenue(""); setFilterYear(""); }} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
          >
            Clear Filters
          </button>

          <button 
            onClick={fetchMatches} 
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
          >
            🔄 Refresh
          </button>

          <button 
            onClick={exportToCSV} 
            className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm transition"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{filteredMatches.length}</div>
          <div className="text-xs text-gray-500">Total Matches</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {filteredMatches.filter(m => !m.isNoResult && m.winner === m.team1).length}
          </div>
          <div className="text-xs text-gray-500">Team 1 Wins</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {filteredMatches.filter(m => !m.isNoResult && m.winner === m.team2).length}
          </div>
          <div className="text-xs text-gray-500">Team 2 Wins</div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {filteredMatches.filter(m => m.isNoResult).length}
          </div>
          <div className="text-xs text-gray-500">No Results</div>
        </div>
      </div>

      {/* Match List */}
      {loading ? (
        <div className="text-center py-10">Loading matches...</div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-10 text-gray-500">No matches found</div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map((match) => (
            <Link href={`/admin/womens-worldcup/matches-list/${match.id}`} key={match.id}>
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Match Header */}
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono bg-gray-800 px-2 py-0.5 rounded">
                        #{match.matchId}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">
                        {match.venue}
                      </span>
                    </div>
                    
                    {/* Teams and Score */}
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{match.team1}</span>
                          <span className="text-gray-400 text-sm">
                            {match.innings1.runs}/{match.innings1.wickets}
                          </span>
                        </div>
                      </div>
                      <div className="text-gray-500 text-xl font-bold">vs</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-lg">{match.team2}</span>
                          <span className="text-gray-400 text-sm">
                            {match.innings2.runs}/{match.innings2.wickets}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Result Badge */}
                  <div className="text-right ml-4">
                    {match.isNoResult ? (
                      <div className="px-3 py-1 rounded-full text-sm bg-yellow-900 text-yellow-400">
                        No Result
                      </div>
                    ) : match.winner ? (
                      <div className={`px-3 py-1 rounded-full text-sm ${
                        match.winner === match.team1 
                          ? "bg-blue-900 text-blue-400" 
                          : "bg-green-900 text-green-400"
                      }`}>
                        {match.winner} Won
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-400">
                        —
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(match.id, match.matchId); }}
                      className="text-red-400 text-xs mt-2 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}