"use client";

import { ChangeEvent, useRef, useState } from "react";
import axios from "axios";
import { useRoom, MediaAsset } from "../../context/RoomContext";

type AssetType = "video" | "image" | "document" | "slide";

const ASSET_TYPES: { value: AssetType; label: string; accept: string; icon: string }[] = [
    { value: "video",    label: "Video",    accept: "video/*",                                          icon: "🎬" },
    { value: "image",    label: "Image",    accept: "image/*",                                          icon: "🖼️" },
    { value: "document", label: "Document", accept: ".pdf,.doc,.docx,.txt",                             icon: "📄" },
    { value: "slide",    label: "Slide",    accept: ".ppt,.pptx,.key",                                  icon: "📊" },
];

export default function Step3MediaForm() {
    const { room, roomId, addMediaAsset, removeMediaAsset } = useRoom();
    const [selectedType, setSelectedType] = useState<AssetType>("video");
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileRef = useRef<HTMLInputElement>(null);

    const assets: MediaAsset[] = room.mediaAssets || [];

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !roomId) return;

        setUploading(true);
        setUploadProgress(0);

        try {
            /* 1. Upload to storage via /api/upload */
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "RoomMedia");

            const uploadRes = await axios.post("/api/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (ev) => {
                    if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
                },
            });

            const url: string = uploadRes.data.url;

            /* 2. Register in room doc via /api/rooms/[id]/media */
            await addMediaAsset(roomId, {
                url,
                type: selectedType,
                name: file.name,
                sizeBytes: file.size,
            });

            if (fileRef.current) fileRef.current.value = "";
        } catch (err) {
            console.error("[Step3MediaForm] upload error", err);
            alert("Upload failed. Please try again.");
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleRemove = async (url: string) => {
        if (!roomId) return;
        const ok = window.confirm("Remove this asset?");
        if (!ok) return;
        await removeMediaAsset(roomId, url);
    };

    const formatBytes = (bytes?: number | null) => {
        if (!bytes) return "";
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-6">
            {/* Upload Panel */}
            <div className="border border-[#30363d] rounded-lg p-5 bg-[#0d1117]">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                    Upload Asset
                </h2>

                {/* Asset type selector */}
                <div className="flex gap-2 mb-4">
                    {ASSET_TYPES.map((at) => (
                        <button
                            key={at.value}
                            onClick={() => setSelectedType(at.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                selectedType === at.value
                                    ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                                    : "bg-[#161b22] text-gray-400 border border-[#21262d] hover:border-gray-600"
                            }`}
                        >
                            {at.icon} {at.label}
                        </button>
                    ))}
                </div>

                {!roomId ? (
                    <p className="text-sm text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
                        ⚠️ Save Step 1 first to create the room before uploading media.
                    </p>
                ) : (
                    <>
                        <input
                            ref={fileRef}
                            type="file"
                            accept={ASSET_TYPES.find((a) => a.value === selectedType)?.accept}
                            onChange={handleFileChange}
                            disabled={uploading}
                            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-2.5 text-sm text-white file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />

                        {uploading && (
                            <div className="mt-3">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Uploading…</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-200"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Asset List */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Uploaded Assets ({assets.length})
                </h2>

                {assets.length === 0 ? (
                    <div className="border border-dashed border-[#30363d] rounded-lg py-10 text-center text-gray-600 text-sm">
                        No media assets yet
                    </div>
                ) : (
                    <div className="border border-[#21262d] rounded-lg overflow-hidden divide-y divide-[#21262d]">
                        {assets.map((asset, idx) => {
                            const typeInfo = ASSET_TYPES.find((a) => a.value === asset.type);
                            return (
                                <div key={idx} className="flex items-center gap-4 px-4 py-3 bg-[#0d1117] hover:bg-[#161b22] transition">
                                    <span className="text-xl">{typeInfo?.icon ?? "📎"}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white truncate">{asset.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {typeInfo?.label}
                                            {asset.sizeBytes && ` · ${formatBytes(asset.sizeBytes)}`}
                                            {asset.addedAt && ` · ${new Date(asset.addedAt).toLocaleDateString()}`}
                                        </p>
                                    </div>

                                    <a
                                        href={asset.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-blue-400 hover:underline flex-shrink-0"
                                    >
                                        View
                                    </a>

                                    <button
                                        onClick={() => handleRemove(asset.url)}
                                        className="p-1.5 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition flex-shrink-0"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}