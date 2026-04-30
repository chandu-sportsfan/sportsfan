"use client";

import { useState, useEffect } from "react";
import { Poll, CreatePollBody, PollType } from "@/types/polls";

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiGet(): Promise<Poll[]> {
  const res = await fetch("/api/polls");
  const json = await res.json();
  return json.data ?? [];
}

async function apiCreate(body: CreatePollBody): Promise<Poll> {
  const res = await fetch("/api/polls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function apiToggleActive(id: string, active: boolean) {
  await fetch(`/api/polls/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

async function apiDelete(id: string) {
  await fetch(`/api/polls/${id}`, { method: "DELETE" });
}

// ─── Option row in the form ───────────────────────────────────────────────────
interface OptionInput {
  label: string;
  isCorrect: boolean;
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
export default function AdminPollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [type, setType] = useState<PollType>("poll");
  const [title, setTitle] = useState("");
  const [options, setOptions] = useState<OptionInput[]>([
    { label: "", isCorrect: false },
    { label: "", isCorrect: false },
  ]);
  const [durationHours, setDurationHours] = useState(24);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load polls
  const loadPolls = async () => {
    setLoading(true);
    const data = await apiGet();
    setPolls(data);
    setLoading(false);
  };

  useEffect(() => { loadPolls(); }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────
  function addOption() {
    if (options.length >= 6) return;
    setOptions((p) => [...p, { label: "", isCorrect: false }]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions((p) => p.filter((_, idx) => idx !== i));
  }

  function updateLabel(i: number, val: string) {
    setOptions((p) => p.map((o, idx) => (idx === i ? { ...o, label: val } : o)));
  }

  function toggleCorrect(i: number) {
    setOptions((p) => p.map((o, idx) => (idx === i ? { ...o, isCorrect: !o.isCorrect } : o)));
  }

  function resetForm() {
    setTitle("");
    setType("poll");
    setOptions([{ label: "", isCorrect: false }, { label: "", isCorrect: false }]);
    setDurationHours(24);
    setFormError("");
  }

  async function handleCreate() {
    setFormError("");
    if (!title.trim()) return setFormError("Title is required.");
    if (options.some((o) => !o.label.trim())) return setFormError("All options need a label.");
    if (type === "quiz" && !options.some((o) => o.isCorrect))
      return setFormError("Mark at least one correct answer.");

    setSubmitting(true);
    try {
      await apiCreate({
        title: title.trim(),
        type,
        options: options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
        endsAt: new Date(Date.now() + durationHours * 3_600_000).toISOString(),
      });
      resetForm();
      await loadPolls();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An unknown error occurred";
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(poll: Poll) {
    await apiToggleActive(poll.id, !poll.active);
    await loadPolls();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this poll?")) return;
    await apiDelete(id);
    await loadPolls();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white font-sans">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <span className="text-purple-400 text-2xl">✦</span>
          <h1 className="text-2xl font-bold tracking-tight">Polls & Quiz Admin</h1>
        </div>

        {/* ── Create form ── */}
        <div className="bg-[#16162a] border border-white/10 rounded-2xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-white/80">Create New</h2>

          {/* Type toggle */}
          <div className="flex rounded-lg overflow-hidden border border-white/10 w-fit">
            {(["poll", "quiz"] as PollType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={[
                  "px-6 py-2 text-sm font-semibold capitalize transition-colors",
                  type === t ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-medium">Question / Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Who are you supporting today?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          {/* Options */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400 font-medium">
              Options {type === "quiz" && <span className="text-emerald-400">(tick correct answer)</span>}
            </label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt.label}
                    onChange={(e) => updateLabel(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  {type === "quiz" && (
                    <button
                      onClick={() => toggleCorrect(i)}
                      title="Correct answer"
                      className={[
                        "w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors",
                        opt.isCorrect
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "border-gray-600 text-gray-600 hover:border-emerald-500",
                      ].join(" ")}
                    >
                      ✓
                    </button>
                  )}
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-xl leading-none w-7 flex-shrink-0 text-center"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors mt-1"
                >
                  + Add option
                </button>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 font-medium whitespace-nowrap">Active duration</label>
            <input
              type="number"
              min={1}
              max={720}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <span className="text-xs text-gray-500">hours</span>
          </div>

          {formError && <p className="text-red-400 text-xs">{formError}</p>}

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {submitting ? "Creating…" : `Create ${type === "quiz" ? "Quiz" : "Poll"}`}
          </button>
        </div>

        {/* ── Existing polls list ── */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white/80">All Polls & Quizzes</h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-[#16162a] animate-pulse border border-white/5" />
              ))}
            </div>
          ) : polls.length === 0 ? (
            <p className="text-gray-500 text-sm">No polls yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {polls.map((poll) => (
                <div
                  key={poll.id}
                  className="bg-[#16162a] border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between gap-4"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={[
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          poll.type === "quiz"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-purple-500/20 text-purple-400",
                        ].join(" ")}
                      >
                        {poll.type}
                      </span>
                      <span
                        className={[
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                          poll.active
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400",
                        ].join(" ")}
                      >
                        {poll.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-white truncate">{poll.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {poll.options.length} options ·{" "}
                      {poll.options.reduce((s, o) => s + o.votes, 0)} total votes ·{" "}
                      Ends {new Date(poll.endsAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(poll)}
                      className={[
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border",
                        poll.active
                          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10",
                      ].join(" ")}
                    >
                      {poll.active ? "Close" : "Reopen"}
                    </button>
                    <button
                      onClick={() => handleDelete(poll.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}