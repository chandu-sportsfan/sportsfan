// admin/womens-worldcup/add-match/page.tsx
"use client";

import { useState, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

interface WomensInningStats {
  runs: number;
  wickets: number;
  powerplay: number;
  deathRuns: number;
  fours: number;
  sixes: number;
  dotballs: number;
}

interface WomensMatchFormData {
  matchId: number;
  date: string;
  team1: string;
  team2: string;
  venue: string;
  winner: string;
  tossWinner: string;
  tossDecision: "bat" | "field";
  playerOfMatch: string;
  innings1: WomensInningStats;
  innings2: WomensInningStats;
  isNoResult: boolean;
}

const defaultForm: WomensMatchFormData = {
  matchId: 0,
  date: "",
  team1: "",
  team2: "",
  venue: "",
  winner: "",
  tossWinner: "",
  tossDecision: "field",
  playerOfMatch: "",
  innings1: { runs: 0, wickets: 0, powerplay: 0, deathRuns: 0, fours: 0, sixes: 0, dotballs: 0 },
  innings2: { runs: 0, wickets: 0, powerplay: 0, deathRuns: 0, fours: 0, sixes: 0, dotballs: 0 },
  isNoResult: false,
};

export default function AddWomensMatchPage() {
  const [form, setForm] = useState<WomensMatchFormData>(defaultForm);
  const [loading, setLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const numValue = type === "number" ? parseInt(value) || 0 : value;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setForm(prev => ({
        ...prev,
        [parent]: { ...prev[parent as keyof WomensMatchFormData] as WomensInningStats, [child]: numValue }
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: numValue }));
    }
  };

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.matchId || !form.date || !form.team1 || !form.team2) {
      alert("Match ID, Date, Team 1, and Team 2 are required");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/woment20wc", form);
      alert("Match added successfully!");
      setForm(defaultForm);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : String(err);
      alert(msg || "Failed to add match");
    } finally {
      setLoading(false);
    }
  };

  const normalizeKey = (s: string) => s.toLowerCase().replace(/[\s_]+/g, " ").trim();
  
  const findValue = (lookup: Record<string, string>, ...fragments: string[]) => {
    for (const frag of fragments) {
      const key = Object.keys(lookup).find(k => k.includes(normalizeKey(frag)));
      if (key && lookup[key]) return lookup[key];
    }
    return "";
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkErrors([]);
    setSuccessCount(0);
    setBulkProgress({ current: 0, total: 0 });

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];

      if (!data.length) {
        alert("File is empty");
        return;
      }

      setBulkProgress({ current: 0, total: data.length });
      let success = 0;
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const lookup: Record<string, string> = {};
        Object.entries(data[i]).forEach(([k, v]) => { 
          lookup[normalizeKey(k)] = String(v ?? "").trim(); 
        });

        // Parse winner - handle "No Result" case
        const winnerValue = findValue(lookup, "winner");
        const isNoResult = winnerValue === "No Result";

        const matchData: Partial<WomensMatchFormData> = {
          matchId: parseInt(findValue(lookup, "match_id", "match id")) || 0,
          date: findValue(lookup, "date"),
          team1: findValue(lookup, "team1", "team 1"),
          team2: findValue(lookup, "team2", "team 2"),
          venue: findValue(lookup, "venue"),
          winner: isNoResult ? "" : winnerValue,
          tossWinner: findValue(lookup, "toss_winner", "toss winner"),
          tossDecision: findValue(lookup, "toss_decision", "toss decision") as "bat" | "field",
          playerOfMatch: findValue(lookup, "player_of_match", "player of match", "mom"),
          isNoResult: isNoResult,
          innings1: {
            runs: parseInt(findValue(lookup, "innings1", "innings 1", "innings_1")) || 0,
            wickets: parseInt(findValue(lookup, "wickets1", "wickets_1", "wickets 1")) || 0,
            powerplay: parseInt(findValue(lookup, "powerplay1", "powerplay_1", "powerplay 1")) || 0,
            deathRuns: parseInt(findValue(lookup, "death_runs1", "death runs1", "death_runs_1", "death runs 1")) || 0,
            fours: parseInt(findValue(lookup, "fours1", "fours_1", "4s_1", "4s 1")) || 0,
            sixes: parseInt(findValue(lookup, "sixes1", "sixes_1", "6s_1", "6s 1")) || 0,
            dotballs: parseInt(findValue(lookup, "dotballs1", "dotballs_1", "dot balls1", "dot balls 1")) || 0,
          },
          innings2: {
            runs: parseInt(findValue(lookup, "innings2", "innings 2", "innings_2")) || 0,
            wickets: parseInt(findValue(lookup, "wickets2", "wickets_2", "wickets 2")) || 0,
            powerplay: parseInt(findValue(lookup, "powerplay2", "powerplay_2", "powerplay 2")) || 0,
            deathRuns: parseInt(findValue(lookup, "death_runs2", "death runs2", "death_runs_2", "death runs 2")) || 0,
            fours: parseInt(findValue(lookup, "fours2", "fours_2", "4s_2", "4s 2")) || 0,
            sixes: parseInt(findValue(lookup, "sixes2", "sixes_2", "6s_2", "6s 2")) || 0,
            dotballs: parseInt(findValue(lookup, "dotballs2", "dotballs_2", "dot balls2", "dot balls 2")) || 0,
          },
        };

        // Validation
        if (!matchData.matchId || !matchData.date || !matchData.team1 || !matchData.team2) {
          errors.push(`Row ${i + 2}: Missing required fields (matchId, date, team1, team2)`);
          setBulkProgress(p => ({ ...p, current: i + 1 }));
          continue;
        }

        try {
          await axios.post("/api/woment20wc", matchData);
          success++;
        } catch (err: unknown) {
          const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : String(err);
          errors.push(`Row ${i + 2}: ${msg}`);
        }
        setBulkProgress(p => ({ ...p, current: i + 1 }));
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setSuccessCount(success);
      setBulkErrors(errors);
      alert(`Bulk upload complete!\n✅ Success: ${success}\n❌ Failed: ${errors.length}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      console.error(err);
      alert("Failed to parse Excel file. Please check the file format.");
    } finally {
      setTimeout(() => {
        setBulkProgress({ current: 0, total: 0 });
      }, 2000);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Add Women&apos;s World Cup Match</h1>

      {/* Bulk Upload Section */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">📊 Bulk Import from Excel</h2>
        <p className="text-sm text-gray-400 mb-3">
          Upload Excel file with Women&apos;s World Cup match data. Supports columns: match_id, date, team1, team2, venue, 
          winner, toss_winner, toss_decision, player_of_match, innings1, wickets1, powerplay1, death_runs1, fours1, sixes1, dotballs1, etc.
        </p>
        <input 
          type="file" 
          accept=".xlsx,.xls,.csv" 
          ref={fileInputRef} 
          onChange={handleBulkUpload} 
          className="mb-3 text-sm"
          disabled={bulkProgress.total > 0 && bulkProgress.current < bulkProgress.total}
        />
        
        {/* Progress Bar */}
        {bulkProgress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Processing: {bulkProgress.current} / {bulkProgress.total} matches</span>
              <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} 
              />
            </div>
          </div>
        )}

        {/* Success Message */}
        {successCount > 0 && bulkProgress.current === bulkProgress.total && bulkProgress.total > 0 && (
          <div className="mt-3 text-sm text-green-400">
            ✅ Successfully imported {successCount} matches
          </div>
        )}

        {/* Error Log */}
        {bulkErrors.length > 0 && (
          <details className="mt-3">
            <summary className="text-red-400 text-sm cursor-pointer">
              ❌ {bulkErrors.length} row(s) failed — click to expand
            </summary>
            <div className="mt-2 max-h-40 overflow-auto text-xs text-red-300 space-y-1 bg-red-950/20 p-2 rounded">
              {bulkErrors.map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          </details>
        )}
      </div>

      {/* Single Match Form */}
      <div className="border-t border-gray-800 pt-4">
        <h2 className="text-lg font-semibold mb-4">📝 Add Single Match</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Match ID *</label>
            <input 
              type="number" 
              name="matchId" 
              value={form.matchId || ""} 
              onChange={handleChange} 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input 
              type="date" 
              name="date" 
              value={form.date} 
              onChange={handleChange} 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Toss Winner *</label>
            <input 
              type="text" 
              name="tossWinner" 
              value={form.tossWinner} 
              onChange={handleChange} 
              placeholder="Team that won toss" 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Toss Decision *</label>
            <select 
              name="tossDecision" 
              value={form.tossDecision} 
              onChange={handleChange} 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
            >
              <option value="bat">Bat First</option>
              <option value="field">Field First</option>
            </select>
          </div>
        </div>

        {/* Teams and Venue */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Team 1 *</label>
            <input 
              type="text" 
              name="team1" 
              value={form.team1} 
              onChange={handleChange} 
              placeholder="e.g., Australia" 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Team 2 *</label>
            <input 
              type="text" 
              name="team2" 
              value={form.team2} 
              onChange={handleChange} 
              placeholder="e.g., England" 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Venue *</label>
            <input 
              type="text" 
              name="venue" 
              value={form.venue} 
              onChange={handleChange} 
              placeholder="Stadium name" 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Winner</label>
            <input 
              type="text" 
              name="winner" 
              value={form.winner} 
              onChange={handleChange} 
              placeholder="Winning team (leave empty for No Result)" 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Player of the Match</label>
            <input 
              type="text" 
              name="playerOfMatch" 
              value={form.playerOfMatch} 
              onChange={handleChange} 
              placeholder="Player name" 
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded" 
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              name="isNoResult" 
              checked={form.isNoResult} 
              onChange={handleCheckbox} 
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm">No Result</span>
          </label>
        </div>

        {/* Innings 1 */}
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
          <h3 className="font-semibold mb-3 text-blue-400">🏏 Innings 1 - {form.team1 || "Team 1"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400">Runs *</label>
              <input type="number" name="innings1.runs" value={form.innings1.runs || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Wickets</label>
              <input type="number" name="innings1.wickets" value={form.innings1.wickets || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Powerplay Runs</label>
              <input type="number" name="innings1.powerplay" value={form.innings1.powerplay || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Death Runs (Last 10)</label>
              <input type="number" name="innings1.deathRuns" value={form.innings1.deathRuns || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Fours</label>
              <input type="number" name="innings1.fours" value={form.innings1.fours || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Sixes</label>
              <input type="number" name="innings1.sixes" value={form.innings1.sixes || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Dot Balls</label>
              <input type="number" name="innings1.dotballs" value={form.innings1.dotballs || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
          </div>
        </div>

        {/* Innings 2 */}
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
          <h3 className="font-semibold mb-3 text-green-400">🏏 Innings 2 - {form.team2 || "Team 2"}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400">Runs *</label>
              <input type="number" name="innings2.runs" value={form.innings2.runs || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" required />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Wickets</label>
              <input type="number" name="innings2.wickets" value={form.innings2.wickets || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Powerplay Runs</label>
              <input type="number" name="innings2.powerplay" value={form.innings2.powerplay || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Death Runs (Last 10)</label>
              <input type="number" name="innings2.deathRuns" value={form.innings2.deathRuns || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Fours</label>
              <input type="number" name="innings2.fours" value={form.innings2.fours || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Sixes</label>
              <input type="number" name="innings2.sixes" value={form.innings2.sixes || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Dot Balls</label>
              <input type="number" name="innings2.dotballs" value={form.innings2.dotballs || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm" />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition font-medium"
        >
          {loading ? "Saving..." : "Add Match"}
        </button>
      </form>
    </div>
  );
}