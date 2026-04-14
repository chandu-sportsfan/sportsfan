"use client";

import { useState } from "react";
import { useRoom } from "../../context/RoomContext";
import { useRouter } from "next/navigation";

const PREMIUM_ROOM_TYPES = ["inner", "moment"];

export default function Step4PriceForm() {
    const { room, roomId, setRoom, publishRoom, loading } = useRoom();
    const [publishing, setPublishing] = useState(false);
    const router = useRouter();

    const isPremium = PREMIUM_ROOM_TYPES.includes(room.roomType || "");

    const handlePublish = async () => {
        if (!roomId) {
            alert("Room must be saved first.");
            return;
        }

        if (isPremium && (room.price === null || room.price === undefined)) {
            alert("Price is required for Inner and Moment rooms.");
            return;
        }

        setPublishing(true);
        const ok = await publishRoom(roomId, room.price ?? undefined);
        setPublishing(false);

        if (ok) {
            alert("Room published successfully!");
            router.push("/admin/room-management/room-list");
        } else {
            alert("Failed to publish. Check required fields and try again.");
        }
    };

    return (
        <div className="space-y-8">
            {/* Price */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Pricing
                </h2>

                {isPremium ? (
                    <div className="space-y-3">
                        <p className="text-sm text-amber-400/90 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-3">
                            💰 <strong>{room.roomType === "inner" ? "Inner" : "Moment"}</strong> rooms require a price to publish.
                        </p>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                                Price (USD) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                                <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={room.price ?? ""}
                                    onChange={(e) =>
                                        setRoom({ price: e.target.value !== "" ? Number(e.target.value) : null })
                                    }
                                    placeholder="0.00"
                                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-8 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 bg-[#0d1117] border border-[#21262d] rounded-lg px-4 py-3">
                        <span className="text-xl">🌐</span>
                        <div>
                            <p className="text-sm text-white font-medium">Free Access</p>
                            <p className="text-xs text-gray-500">
                                {room.roomType === "open"
                                    ? "Open rooms are free for all participants."
                                    : "Reflection rooms are free access."}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Summary */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Room Summary
                </h2>

                <div className="bg-[#0d1117] border border-[#21262d] rounded-lg divide-y divide-[#21262d]">
                    {[
                        { label: "Room Type", value: room.roomType },
                        { label: "Event ID",  value: room.eventId || "—" },
                        { label: "Title",     value: room.title || "—" },
                        {
                            label: "Media Assets",
                            value: `${(room.mediaAssets || []).length} file(s)`,
                        },
                        {
                            label: "Price",
                            value: isPremium
                                ? room.price !== null && room.price !== undefined
                                    ? `$${room.price}`
                                    : "Not set"
                                : "Free",
                        },
                        { label: "Status",    value: room.status || "draft" },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between px-4 py-2.5">
                            <span className="text-xs text-gray-500">{label}</span>
                            <span className="text-xs text-white font-medium capitalize">{value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Publish CTA */}
            <button
                onClick={handlePublish}
                disabled={publishing || loading}
                className="w-full py-3.5 rounded-lg font-semibold text-sm transition bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {publishing ? "Publishing…" : "Publish Room"}
            </button>

            {!roomId && (
                <p className="text-xs text-red-400/80 text-center">
                    ⚠️ Complete Steps 1–2 and save a draft before publishing.
                </p>
            )}
        </div>
    );
}