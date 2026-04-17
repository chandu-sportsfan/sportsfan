"use client";

import { useEffect, useState } from "react";
import { useRoom, RoomType, Event } from "../../context/RoomContext";

const ROOM_TYPES: { value: RoomType; label: string; description: string; icon: string }[] = [
    {
        value: "open",
        label: "Open",
        description: "Public room — anyone can join",
        icon: "🌐",
    },
    {
        value: "inner",
        label: "Inner",
        description: "Premium room with a price gate",
        icon: "🔒",
    },
    {
        value: "moment",
        label: "Moment",
        description: "Short-lived premium experience",
        icon: "⚡",
    },
    {
        value: "reflection",
        label: "Reflection",
        description: "Post-event analysis room",
        icon: "🪞",
    },
];

export default function Step1RoomTypeForm() {
    const { room, setRoom, events, eventsLoading, fetchEvents } = useRoom();
    const [search, setSearch] = useState("");
    const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleSearchChange = (val: string) => {
        setSearch(val);
        if (debounceTimer) clearTimeout(debounceTimer);
        const t = setTimeout(() => fetchEvents(val || undefined), 300);
        setDebounceTimer(t);
    };

    const selectEvent = (ev: Event) => {
        setRoom({ eventId: ev.id });
    };

    return (
        <div className="space-y-8">
            {/* Room Type */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Room Type
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    {ROOM_TYPES.map((rt) => {
                        const selected = room.roomType === rt.value;
                        return (
                            <button
                                key={rt.value}
                                onClick={() => setRoom({ roomType: rt.value })}
                                className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                                    selected
                                        ? "border-blue-500 bg-blue-500/10 text-white"
                                        : "border-[#30363d] bg-[#0d1117] text-gray-400 hover:border-gray-600"
                                }`}
                            >
                                <span className="text-2xl">{rt.icon}</span>
                                <div>
                                    <p className="text-sm font-semibold">{rt.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{rt.description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Host ID */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Host ID
                </h2>
                <input
                    value={room.hostId || ""}
                    onChange={(e) => setRoom({ hostId: e.target.value })}
                    placeholder="Enter host user ID"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
                />
            </div>

            {/* Event Selector */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Linked Event
                </h2>

                {/* Search */}
                <input
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search events…"
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition mb-3"
                />

                {eventsLoading ? (
                    <p className="text-sm text-gray-500 py-4 text-center">Loading events…</p>
                ) : events.length === 0 ? (
                    <p className="text-sm text-gray-600 py-4 text-center">No events found</p>
                ) : (
                    <div className="border border-[#21262d] rounded-lg overflow-hidden divide-y divide-[#21262d] max-h-64 overflow-y-auto">
                        {events.map((ev) => {
                            const selected = room.eventId === ev.id;
                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => selectEvent(ev)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                                        selected
                                            ? "bg-blue-500/10 border-l-2 border-blue-500"
                                            : "bg-[#0d1117] hover:bg-[#161b22]"
                                    }`}
                                >
                                    {ev.thumbnail ? (
                                        <img
                                            src={ev.thumbnail}
                                            alt={ev.name}
                                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-[#21262d] flex items-center justify-center text-lg flex-shrink-0">
                                            🏟️
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{ev.name}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {ev.sport} ·{" "}
                                            {ev.scheduledAt
                                                ? new Date(ev.scheduledAt).toLocaleDateString()
                                                : "TBD"}
                                        </p>
                                    </div>
                                    {selected && (
                                        <span className="ml-auto text-blue-400 text-xs font-semibold flex-shrink-0">
                                            Selected
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}