"use client";

import { ChangeEvent, useState } from "react";
import { useRoom } from "../../context/RoomContext";

const LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Arabic", "Portuguese", "Mandarin"];

export default function Step2DetailsForm() {
    const { room, setRoom } = useRoom();
    const [tagInput, setTagInput] = useState("");
    const [moderatorInput, setModeratorInput] = useState("");
    const [, setThumbnail] = useState<File | null>(null);

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setRoom({ [name]: value } as never);
    };

    /* Tags */
    const addTag = () => {
        const trimmed = tagInput.trim();
        if (!trimmed) return;
        const current = room.tags || [];
        if (!current.includes(trimmed)) {
            setRoom({ tags: [...current, trimmed] });
        }
        setTagInput("");
    };

    const removeTag = (tag: string) => {
        setRoom({ tags: (room.tags || []).filter((t) => t !== tag) });
    };

    /* Moderators */
    const addModerator = () => {
        const trimmed = moderatorInput.trim();
        if (!trimmed) return;
        const current = room.moderators || [];
        if (!current.includes(trimmed)) {
            setRoom({ moderators: [...current, trimmed] });
        }
        setModeratorInput("");
    };

    const removeModerator = (mod: string) => {
        setRoom({ moderators: (room.moderators || []).filter((m) => m !== mod) });
    };

    /* Thumbnail preview — actual upload handled client-side before Step 3/publish */
    const handleThumbnail = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setThumbnail(file);
        if (file) {
            setRoom({ thumbnail: URL.createObjectURL(file) });
        }
    };

    return (
        <div className="space-y-6">
            {/* Title */}
            <Field label="Room Title" required>
                <input
                    name="title"
                    value={room.title || ""}
                    onChange={handleChange}
                    placeholder="e.g. Match Preview Live Session"
                    className={inputCls}
                />
            </Field>

            {/* Description */}
            <Field label="Description">
                <textarea
                    name="description"
                    value={room.description || ""}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Describe what this room is about…"
                    className={`${inputCls} resize-none`}
                />
            </Field>

            {/* Thumbnail */}
            <Field label="Thumbnail">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnail}
                    className={inputCls}
                />
                {room.thumbnail && (
                    <img
                        src={room.thumbnail}
                        alt="thumbnail preview"
                        className="mt-2 w-32 h-20 object-cover rounded-lg border border-[#30363d]"
                    />
                )}
            </Field>

            {/* Capacity + Language */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Capacity">
                    <input
                        name="capacity"
                        type="number"
                        min={1}
                        value={room.capacity ?? ""}
                        onChange={(e) => setRoom({ capacity: e.target.value ? Number(e.target.value) : null })}
                        placeholder="Max attendees (leave blank for unlimited)"
                        className={inputCls}
                    />
                </Field>

                <Field label="Language">
                    <select
                        name="language"
                        value={room.language || ""}
                        onChange={handleChange}
                        className={inputCls}
                    >
                        <option value="">Select language</option>
                        {LANGUAGES.map((l) => (
                            <option key={l} value={l}>{l}</option>
                        ))}
                    </select>
                </Field>
            </div>

            {/* Scheduled At */}
            <Field label="Scheduled At">
                <input
                    type="datetime-local"
                    name="scheduledAt"
                    value={room.scheduledAt || ""}
                    onChange={handleChange}
                    className={inputCls}
                />
            </Field>

            {/* Tags */}
            <Field label="Tags">
                <div className="flex gap-2">
                    <input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                        placeholder="Add a tag and press Enter"
                        className={`${inputCls} flex-1`}
                    />
                    <button
                        onClick={addTag}
                        className="px-4 py-2 bg-[#21262d] text-gray-300 text-sm rounded-lg hover:bg-[#30363d] transition"
                    >
                        Add
                    </button>
                </div>
                {(room.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(room.tags || []).map((tag) => (
                            <span
                                key={tag}
                                className="flex items-center gap-1 bg-[#21262d] text-gray-300 text-xs px-2.5 py-1 rounded-full"
                            >
                                {tag}
                                <button onClick={() => removeTag(tag)} className="text-gray-500 hover:text-red-400 ml-1">✕</button>
                            </span>
                        ))}
                    </div>
                )}
            </Field>

            {/* Moderators */}
            <Field label="Moderators">
                <div className="flex gap-2">
                    <input
                        value={moderatorInput}
                        onChange={(e) => setModeratorInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModerator())}
                        placeholder="Add moderator user ID and press Enter"
                        className={`${inputCls} flex-1`}
                    />
                    <button
                        onClick={addModerator}
                        className="px-4 py-2 bg-[#21262d] text-gray-300 text-sm rounded-lg hover:bg-[#30363d] transition"
                    >
                        Add
                    </button>
                </div>
                {(room.moderators || []).length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                        {(room.moderators || []).map((mod) => (
                            <div
                                key={mod}
                                className="flex items-center justify-between bg-[#0d1117] border border-[#21262d] px-3 py-1.5 rounded-lg"
                            >
                                <span className="text-xs text-gray-400 font-mono">{mod}</span>
                                <button onClick={() => removeModerator(mod)} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </Field>
        </div>
    );
}

/* ── helpers ── */

const inputCls =
    "w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {children}
        </div>
    );
}