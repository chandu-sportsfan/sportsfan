// "use client";

// import { useEffect } from "react";
// import Link from "next/link";
// import { Pencil, ArrowLeft } from "lucide-react";
// import { RoomProvider, useRoom, RoomStatus, MediaAsset } from "../../../../../context/RoomContext";

// const STATUS_COLORS: Record<RoomStatus, string> = {
//     draft:     "bg-gray-500/10 text-gray-400 border-gray-500/20",
//     published: "bg-green-500/10 text-green-400 border-green-500/20",
//     live:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
//     ended:     "bg-red-500/10 text-red-400 border-red-500/20",
// };

// const MEDIA_TYPE_ICONS: Record<string, string> = {
//     video:    "🎬",
//     image:    "🖼️",
//     document: "📄",
//     slide:    "📊",
// };

// const ROOM_TYPE_ICONS: Record<string, string> = {
//     open:       "🌐",
//     inner:      "🔒",
//     moment:     "⚡",
//     reflection: "🪞",
// };

// function RoomViewInner({ id }: { id: string }) {
//     const { room, loading, fetchRoom } = useRoom();

//     useEffect(() => {
//         if (id) fetchRoom(id);
//     }, [id, fetchRoom]);

//     if (loading) {
//         return (
//             <div className="max-w-[1440px] mx-auto p-6 text-center text-gray-500 py-20">
//                 Loading room…
//             </div>
//         );
//     }

//     const mediaAssets: MediaAsset[] = room.mediaAssets || [];
//     const tags: string[] = room.tags || [];
//     const moderators: string[] = room.moderators || [];

//     const formatBytes = (bytes?: number | null) => {
//         if (!bytes) return "";
//         if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
//         return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
//     };

//     return (
//         <div className="max-w-[1440px] mx-auto p-6">
//             {/* Back + Edit */}
//             <div className="flex items-center justify-between mb-6">
//                 <Link href="/admin/room-management/room-list">
//                     <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
//                         <ArrowLeft size={16} />
//                         Back to Rooms
//                     </button>
//                 </Link>
//                 <Link href={`/admin/room-management/create-room?id=${id}`}>
//                     <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-sm hover:bg-yellow-500/20 transition">
//                         <Pencil size={14} />
//                         Edit Room
//                     </button>
//                 </Link>
//             </div>

//             {/* Hero */}
//             <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden mb-6">
//                 {room.thumbnail && (
//                     <img
//                         src={room.thumbnail}
//                         alt={room.title}
//                         className="w-full h-48 object-cover"
//                     />
//                 )}
//                 <div className="p-6">
//                     <div className="flex items-start justify-between gap-4">
//                         <div>
//                             <div className="flex items-center gap-2 mb-2">
//                                 <span className="text-2xl">{ROOM_TYPE_ICONS[room.roomType || ""] ?? "🏠"}</span>
//                                 <span
//                                     className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
//                                         STATUS_COLORS[room.status as RoomStatus] || STATUS_COLORS.draft
//                                     }`}
//                                 >
//                                     {room.status}
//                                 </span>
//                             </div>
//                             <h1 className="text-2xl font-bold text-white">{room.title || "Untitled Room"}</h1>
//                             {room.description && (
//                                 <p className="text-sm text-gray-400 mt-2 max-w-2xl">{room.description}</p>
//                             )}
//                         </div>

//                         <div className="text-right flex-shrink-0">
//                             {room.price !== null && room.price !== undefined ? (
//                                 <p className="text-2xl font-bold text-white">${room.price}</p>
//                             ) : (
//                                 <p className="text-sm text-green-400 font-medium">Free</p>
//                             )}
//                         </div>
//                     </div>

//                     {/* Tags */}
//                     {tags.length > 0 && (
//                         <div className="flex flex-wrap gap-2 mt-4">
//                             {tags.map((tag) => (
//                                 <span
//                                     key={tag}
//                                     className="text-xs bg-[#21262d] text-gray-400 px-2.5 py-1 rounded-full"
//                                 >
//                                     #{tag}
//                                 </span>
//                             ))}
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {/* Grid */}
//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//                 {/* Left: details */}
//                 <div className="lg:col-span-2 space-y-6">

//                     {/* Core Info */}
//                     <Section title="Room Details">
//                         <InfoGrid rows={[
//                             { label: "Room Type",   value: `${ROOM_TYPE_ICONS[room.roomType || ""]} ${room.roomType || "—"}` },
//                             { label: "Event ID",    value: room.eventId || "—" },
//                             { label: "Host ID",     value: room.hostId || "—" },
//                             { label: "Language",    value: room.language || "—" },
//                             { label: "Capacity",    value: room.capacity ? String(room.capacity) : "Unlimited" },
//                             { label: "Scheduled",   value: room.scheduledAt ? new Date(room.scheduledAt).toLocaleString() : "—" },
//                         ]} />
//                     </Section>

//                     {/* Media */}
//                     <Section title={`Media Assets (${mediaAssets.length})`}>
//                         {mediaAssets.length === 0 ? (
//                             <p className="text-sm text-gray-600">No media uploaded</p>
//                         ) : (
//                             <div className="divide-y divide-[#21262d]">
//                                 {mediaAssets.map((asset, i) => (
//                                     <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
//                                         <span className="text-xl">{MEDIA_TYPE_ICONS[asset.type] ?? "📎"}</span>
//                                         <div className="min-w-0 flex-1">
//                                             <p className="text-sm text-white truncate">{asset.name}</p>
//                                             <p className="text-xs text-gray-500">
//                                                 {asset.type}
//                                                 {asset.sizeBytes && ` · ${formatBytes(asset.sizeBytes)}`}
//                                             </p>
//                                         </div>
//                                         <a
//                                             href={asset.url}
//                                             target="_blank"
//                                             rel="noreferrer"
//                                             className="text-xs text-blue-400 hover:underline flex-shrink-0"
//                                         >
//                                             View →
//                                         </a>
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </Section>
//                 </div>

//                 {/* Right: meta */}
//                 <div className="space-y-6">

//                     {/* Timestamps */}
//                     <Section title="Timestamps">
//                         <InfoGrid rows={[
//                             { label: "Created",   value: room.createdAt ? new Date(room.createdAt).toLocaleString() : "—" },
//                             { label: "Updated",   value: room.updatedAt ? new Date(room.updatedAt).toLocaleString() : "—" },
//                             { label: "Published", value: room.publishedAt ? new Date(room.publishedAt).toLocaleString() : "—" },
//                         ]} />
//                     </Section>

//                     {/* Moderators */}
//                     <Section title={`Moderators (${moderators.length})`}>
//                         {moderators.length === 0 ? (
//                             <p className="text-sm text-gray-600">None assigned</p>
//                         ) : (
//                             <div className="space-y-2">
//                                 {moderators.map((mod) => (
//                                     <div
//                                         key={mod}
//                                         className="bg-[#0d1117] border border-[#21262d] px-3 py-2 rounded-lg text-xs text-gray-400 font-mono truncate"
//                                     >
//                                         {mod}
//                                     </div>
//                                 ))}
//                             </div>
//                         )}
//                     </Section>
//                 </div>
//             </div>
//         </div>
//     );
// }

// export default function RoomViewPage({ params }: { params: { id: string } }) {
//     return (
//         <RoomProvider>
//             <RoomViewInner id={params.id} />
//         </RoomProvider>
//     );
// }

// /* ── helpers ── */

// function Section({ title, children }: { title: string; children: React.ReactNode }) {
//     return (
//         <div className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
//             <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 pb-3 border-b border-[#21262d]">
//                 {title}
//             </h2>
//             {children}
//         </div>
//     );
// }

// function InfoGrid({ rows }: { rows: { label: string; value: string }[] }) {
//     return (
//         <div className="space-y-2.5">
//             {rows.map(({ label, value }) => (
//                 <div key={label} className="flex justify-between gap-4">
//                     <span className="text-xs text-gray-500">{label}</span>
//                     <span className="text-xs text-white text-right capitalize break-all">{value}</span>
//                 </div>
//             ))}
//         </div>
//     );
// }


export default function hostroomList (){
    return (
        <p>List</p>
    )
}