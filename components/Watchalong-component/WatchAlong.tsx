"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState, useEffect, ChangeEvent, InputHTMLAttributes } from "react";

/* ─── Types ─── */

type MatchOption = {
  id: string;
  matchNo: number;
  tournament: string;
  team1: { name: string; score: string; overs: string };
  team2: { name: string; score: string; overs: string };
  stadium: string;
  isLive: boolean;
};

type RoomForm = {
  name: string;
  role: string;
  badge: string;
  badgeColor: string;
  borderColor: string;
  watching: string;
  engagement: string;
  active: string;
  isLive: boolean;
  liveMatchId: string;
};

type MatchForm = {
  matchNo: string;
  tournament: string;
  stadium: string;
  team1Name: string;
  team1Score: string;
  team1Overs: string;
  team2Name: string;
  team2Score: string;
  team2Overs: string;
  isLive: boolean;
};

const BADGE_OPTIONS = [
  { label: "Legend",       badgeColor: "bg-pink-600",   borderColor: "border-pink-500"   },
  { label: "Pro Analyst",  badgeColor: "bg-orange-500", borderColor: "border-orange-400" },
  { label: "Elite Expert", badgeColor: "bg-purple-600", borderColor: "border-purple-500" },
  { label: "Custom",       badgeColor: "bg-gray-600",   borderColor: "border-gray-500"   },
];

/* ─────────────────────────────────────────────
   MAIN COMPONENT
   Props:
     roomIdToEdit  → edit an existing room
     matchIdToEdit → edit an existing match
   ───────────────────────────────────────────── */
export default function CreateWatchAlong({
  roomIdToEdit,
}: {
  roomIdToEdit?: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"room" | "match">("room");

  /* ── Room state ── */
  const [roomForm, setRoomForm] = useState<RoomForm>({
    name: "",
    role: "",
    badge: "Legend",
    badgeColor: "bg-blue-600",
    borderColor: "border-blue-500",
    watching: "",
    engagement: "",
    active: "",
    isLive: false,
    liveMatchId: "",
  });
  const [dpFile, setDpFile] = useState<File | null>(null);
  const [existingDp, setExistingDp] = useState("");
  const [roomLoading, setRoomLoading] = useState(false);

  /* ── Match state ── */
  const [matchForm, setMatchForm] = useState<MatchForm>({
    matchNo: "",
    tournament: "",
    stadium: "",
    team1Name: "",
    team1Score: "",
    team1Overs: "",
    team2Name: "",
    team2Score: "",
    team2Overs: "",
    isLive: false,
  });
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchOptions, setMatchOptions] = useState<MatchOption[]>([]);

  /* ── Load match options for dropdown ── */
  useEffect(() => {
    axios
      .get("/api/watch-along/matches")
      .then((res) => {
        if (res.data.success) setMatchOptions(res.data.matches);
      })
      .catch(console.error);
  }, []);

  /* ── Load existing room for editing ── */
  useEffect(() => {
    if (!roomIdToEdit) return;
    axios.get(`/api/watch-along/${roomIdToEdit}`).then((res) => {
      if (!res.data.success) return;
      const r = res.data.room;
      setRoomForm({
        name: r.name || "",
        role: r.role || "",
        badge: r.badge || "Legend",
        badgeColor: r.badgeColor || "bg-blue-600",
        borderColor: r.borderColor || "border-blue-500",
        watching: r.watching || "",
        engagement: r.engagement || "",
        active: r.active || "",
        isLive: r.isLive || false,
        liveMatchId: r.liveMatchId || "",
      });
      setExistingDp(r.displayPicture || "");
    });
  }, [roomIdToEdit]);

  /* ─── Room handlers ─── */
  const handleRoomChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setRoomForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleBadgePick = (option: (typeof BADGE_OPTIONS)[0]) => {
    setRoomForm((prev) => ({
      ...prev,
      badge: option.label,
      badgeColor: option.badgeColor,
      borderColor: option.borderColor,
    }));
  };

  const handleRoomSubmit = async () => {
    if (!roomForm.name || !roomForm.role || !roomForm.badge) {
      alert("Name, role, and badge are required");
      return;
    }
    setRoomLoading(true);
    try {
      const fd = new FormData();
      Object.entries(roomForm).forEach(([k, v]) => fd.append(k, String(v)));
      if (dpFile) fd.append("displayPicture", dpFile);

      const url = roomIdToEdit
        ? `/api/watch-along/${roomIdToEdit}`
        : "/api/watch-along";
      const method = roomIdToEdit ? axios.put : axios.post;
      const res = await method(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        alert(roomIdToEdit ? "Room updated!" : "Room created!");
        router.push("/admin/watch-along/list");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving room");
    } finally {
      setRoomLoading(false);
    }
  };

  /* ─── Match handlers ─── */
  const handleMatchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setMatchForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleMatchSubmit = async () => {
    if (!matchForm.matchNo || !matchForm.team1Name || !matchForm.team2Name) {
      alert("Match no, team 1 name, and team 2 name are required");
      return;
    }
    setMatchLoading(true);
    try {
      const payload = {
        matchNo: matchForm.matchNo,
        tournament: matchForm.tournament,
        stadium: matchForm.stadium,
        isLive: matchForm.isLive,
        team1: { name: matchForm.team1Name, score: matchForm.team1Score, overs: matchForm.team1Overs },
        team2: { name: matchForm.team2Name, score: matchForm.team2Score, overs: matchForm.team2Overs },
      };
      const res = await axios.post("/api/watch-along/matches", payload);
      if (res.data.success) {
        alert("Match created!");
        setMatchOptions((prev) => [res.data.match, ...prev]);
        setMatchForm({
          matchNo: "", tournament: "", stadium: "",
          team1Name: "", team1Score: "", team1Overs: "",
          team2Name: "", team2Score: "", team2Overs: "",
          isLive: false,
        });
      }
    } catch (err) {
      console.error(err);
      alert("Error saving match");
    } finally {
      setMatchLoading(false);
    }
  };

  /* ─── Render ─── */
  return (
    <div className="max-w-[1200px] mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">
          {roomIdToEdit ? "Edit Watch Along Room" : "Create Watch Along"}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Rooms are expert cards in the lobby. Matches are the live game data linked to a room.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["room", "match"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded text-sm font-semibold capitalize transition-all ${
              activeTab === t
                ? "bg-blue-600 text-white"
                : "bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#2a2a2a]"
            }`}
          >
            {t === "room" ? "Expert Room" : "Live Match"}
          </button>
        ))}
      </div>

      {/* ══════════ ROOM FORM ══════════ */}
      {activeTab === "room" && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-6">
          <Section title="Expert Info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Expert Name *" name="name" value={roomForm.name} onChange={handleRoomChange} placeholder="e.g. Harsha Bhogle" />
              <TextInput label="Role / Subtitle *" name="role" value={roomForm.role} onChange={handleRoomChange} placeholder="e.g. Cricket Commentary Legend" />
            </div>
          </Section>

          <Section title="Display Picture">
            <div className="flex items-start gap-4">
              <div>
                <label className="text-xs text-gray-400">Upload Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDpFile(e.target.files?.[0] ?? null)}
                  className="block w-full bg-[#0d1117] border border-gray-700 px-3 py-2 rounded text-sm text-white mt-1 cursor-pointer"
                />
              </div>
              {(dpFile || existingDp) && (
                <img
                  src={dpFile ? URL.createObjectURL(dpFile) : existingDp}
                  alt="preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 mt-5"
                />
              )}
            </div>
          </Section>

          <Section title="Badge">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              {BADGE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => handleBadgePick(opt)}
                  className={`py-2 px-3 rounded text-xs font-semibold border transition-all ${
                    roomForm.badge === opt.label
                      ? "border-white text-white " + opt.badgeColor
                      : "border-[#333] text-gray-400 bg-[#0d1117] hover:border-gray-500"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Custom badge name if "Custom" picked */}
            {roomForm.badge !== "Legend" &&
              roomForm.badge !== "Pro Analyst" &&
              roomForm.badge !== "Elite Expert" && (
                <TextInput label="Custom Badge Label" name="badge" value={roomForm.badge} onChange={handleRoomChange} placeholder="e.g. Specialist" />
              )}
          </Section>

          <Section title="Stats (display only)">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextInput label="Watching" name="watching" value={roomForm.watching} onChange={handleRoomChange} placeholder="e.g. 24,892" />
              <TextInput label="Engagement" name="engagement" value={roomForm.engagement} onChange={handleRoomChange} placeholder="e.g. 94%" />
              <TextInput label="Active" name="active" value={roomForm.active} onChange={handleRoomChange} placeholder="e.g. 2.8k" />
            </div>
          </Section>

          <Section title="Live Match">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="isLive"
                name="isLive"
                checked={roomForm.isLive}
                onChange={handleRoomChange}
                className="w-4 h-4 bg-blue-600"
              />
              <label htmlFor="isLive" className="text-sm text-gray-300">
                Mark this room as LIVE
              </label>
            </div>

            {roomForm.isLive && (
              <div>
                <label className="text-xs text-gray-400">
                  Link to a Match <span className="text-gray-600">(optional — create one in the &quot;Live Match&quot; tab first)</span>
                </label>
                <select
                  name="liveMatchId"
                  value={roomForm.liveMatchId}
                  onChange={handleRoomChange}
                  className="w-full bg-[#0d1117] border border-gray-700 px-3 py-2 rounded text-sm text-white mt-1"
                >
                  <option value="">— No match linked —</option>
                  {matchOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      Match {m.matchNo} · {m.team1.name} vs {m.team2.name} · {m.tournament}
                      {m.isLive ? " 🔴 LIVE" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Section>

          <div className="flex gap-3">
            <button
              onClick={handleRoomSubmit}
              disabled={roomLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-3 rounded font-semibold text-white transition-all"
            >
              {roomLoading
                ? roomIdToEdit ? "Updating..." : "Creating..."
                : roomIdToEdit ? "Update Room" : "Create Room"}
            </button>
            <button
              onClick={() => router.back()}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded font-semibold text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MATCH FORM ══════════ */}
      {activeTab === "match" && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-6">
          <Section title="Match Info">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextInput label="Match No *" name="matchNo" value={matchForm.matchNo} onChange={handleMatchChange} placeholder="e.g. 23" />
              <TextInput label="Tournament" name="tournament" value={matchForm.tournament} onChange={handleMatchChange} placeholder="e.g. IPL 2026" />
              <TextInput label="Stadium" name="stadium" value={matchForm.stadium} onChange={handleMatchChange} placeholder="e.g. M. Chinnaswamy Stadium, Bengaluru" />
            </div>
          </Section>

          <Section title="Team 1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextInput label="Team Name *" name="team1Name" value={matchForm.team1Name} onChange={handleMatchChange} placeholder="e.g. RCB" />
              <TextInput label="Score" name="team1Score" value={matchForm.team1Score} onChange={handleMatchChange} placeholder="e.g. 156/3" />
              <TextInput label="Overs" name="team1Overs" value={matchForm.team1Overs} onChange={handleMatchChange} placeholder="e.g. 15.2" />
            </div>
          </Section>

          <Section title="Team 2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <TextInput label="Team Name *" name="team2Name" value={matchForm.team2Name} onChange={handleMatchChange} placeholder="e.g. MI" />
              <TextInput label="Score" name="team2Score" value={matchForm.team2Score} onChange={handleMatchChange} placeholder="e.g. 158/4" />
              <TextInput label="Overs" name="team2Overs" value={matchForm.team2Overs} onChange={handleMatchChange} placeholder="e.g. 20" />
            </div>
          </Section>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="matchIsLive"
              name="isLive"
              checked={matchForm.isLive}
              onChange={handleMatchChange}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="matchIsLive" className="text-sm text-gray-300">
              This match is currently LIVE
            </label>
          </div>

          {/* Existing matches list */}
          {matchOptions.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Existing matches</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {matchOptions.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between bg-[#0d1117] border border-[#2a2a2a] rounded px-3 py-2 text-xs text-gray-300"
                  >
                    <span>
                      Match {m.matchNo} · <span className="text-blue-400">{m.team1.name}</span> vs{" "}
                      <span className="text-blue-400">{m.team2.name}</span> · {m.tournament}
                    </span>
                    {m.isLive && (
                      <span className="ml-2 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded">LIVE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleMatchSubmit}
              disabled={matchLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 py-3 rounded font-semibold text-white transition-all"
            >
              {matchLoading ? "Creating..." : "Create Match"}
            </button>
            <button
              onClick={() =>
                setMatchForm({
                  matchNo: "", tournament: "", stadium: "",
                  team1Name: "", team1Score: "", team1Overs: "",
                  team2Name: "", team2Score: "", team2Overs: "",
                  isLive: false,
                })
              }
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded font-semibold text-white transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Reusable sub-components ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 border-b border-[#21262d] pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { label: string };

function TextInput({ label, ...props }: TextInputProps) {
  return (
    <div>
      <label className="text-xs text-gray-400">{label}</label>
      <input
        {...props}
        className="w-full bg-[#0d1117] border border-gray-700 px-3 py-2 rounded text-sm text-white mt-1 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}