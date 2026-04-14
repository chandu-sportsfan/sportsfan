// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { Eye, Pencil, Trash2 } from "lucide-react";
// import {  useRoom, Room, RoomStatus } from "../../../../context/RoomContext";

// const STATUS_COLORS: Record<RoomStatus, string> = {
//     draft:     "bg-gray-500/10 text-gray-400 border-gray-500/20",
//     published: "bg-green-500/10 text-green-400 border-green-500/20",
//     live:      "bg-blue-500/10 text-blue-400 border-blue-500/20",
//     ended:     "bg-red-500/10 text-red-400 border-red-500/20",
// };

// const ROOM_TYPE_ICONS: Record<string, string> = {
//     open:       "🌐",
//     inner:      "🔒",
//     moment:     "⚡",
//     reflection: "🪞",
// };

// function RoomListInner() {
//     const { rooms, fetchRooms, deleteRoom, loading } = useRoom();

//     const [statusFilter, setStatusFilter] = useState("");
//     const [typeFilter, setTypeFilter]   = useState("");

//     useEffect(() => {
//         const params: Record<string, string> = {};
//         if (statusFilter) params.status   = statusFilter;
//         if (typeFilter)   params.roomType = typeFilter;
//         fetchRooms(params);
//     }, [statusFilter, typeFilter, fetchRooms]);

//     const handleDelete = async (id: string) => {
//         if (!window.confirm("Delete this room? This cannot be undone.")) return;
//         const ok = await deleteRoom(id);
//         if (!ok) alert("Failed to delete room.");
//     };

//     return (
//         <div className="max-w-[1440px] mx-auto p-6">
//             {/* Header */}
//             <div className="flex items-start justify-between mb-6">
//                 <div>
//                     <h1 className="text-xl font-semibold text-white">Rooms</h1>
//                     <p className="text-sm text-gray-400 mt-0.5">Manage all rooms</p>
//                 </div>
//                 <Link href="/admin/room-management/create-room">
//                     <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition">
//                         + New Room
//                     </button>
//                 </Link>
//             </div>

//             {/* Filters */}
//             <div className="flex gap-3 mb-6">
//                 <select
//                     value={statusFilter}
//                     onChange={(e) => setStatusFilter(e.target.value)}
//                     className="bg-[#161b22] border border-[#21262d] text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
//                 >
//                     <option value="">All Statuses</option>
//                     <option value="draft">Draft</option>
//                     <option value="published">Published</option>
//                     <option value="live">Live</option>
//                     <option value="ended">Ended</option>
//                 </select>

//                 <select
//                     value={typeFilter}
//                     onChange={(e) => setTypeFilter(e.target.value)}
//                     className="bg-[#161b22] border border-[#21262d] text-sm text-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
//                 >
//                     <option value="">All Types</option>
//                     <option value="open">Open</option>
//                     <option value="inner">Inner</option>
//                     <option value="moment">Moment</option>
//                     <option value="reflection">Reflection</option>
//                 </select>
//             </div>

//             {/* Table */}
//             <div className="bg-[#161b22] border border-[#21262d] rounded-xl overflow-hidden">
//                 <div className="overflow-x-auto">
//                     <table className="w-full min-w-[800px]">
//                         <thead className="bg-[#1c2330] border-b border-[#21262d]">
//                             <tr>
//                                 {["#", "Title", "Type", "Event", "Price", "Status", "Created", "Actions"].map(
//                                     (h) => (
//                                         <th
//                                             key={h}
//                                             className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
//                                         >
//                                             {h}
//                                         </th>
//                                     )
//                                 )}
//                             </tr>
//                         </thead>
//                         <tbody>
//                             {loading ? (
//                                 <tr>
//                                     <td colSpan={8} className="text-center py-12 text-gray-500 text-sm">
//                                         Loading rooms…
//                                     </td>
//                                 </tr>
//                             ) : rooms.length === 0 ? (
//                                 <tr>
//                                     <td colSpan={8} className="text-center py-12 text-gray-600 text-sm">
//                                         No rooms found
//                                     </td>
//                                 </tr>
//                             ) : (
//                                 rooms.map((room: Room, idx) => (
//                                     <tr
//                                         key={room.id}
//                                         className="border-b border-[#21262d] hover:bg-[#0d1117] transition"
//                                     >
//                                         {/* Index */}
//                                         <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>

//                                         {/* Title + thumbnail */}
//                                         <td className="px-4 py-3">
//                                             <div className="flex items-center gap-3">
//                                                 {room.thumbnail ? (
//                                                     <img
//                                                         src={room.thumbnail}
//                                                         alt={room.title}
//                                                         className="w-9 h-9 rounded object-cover flex-shrink-0"
//                                                     />
//                                                 ) : (
//                                                     <div className="w-9 h-9 rounded bg-[#21262d] flex items-center justify-center text-base flex-shrink-0">
//                                                         {ROOM_TYPE_ICONS[room.roomType] ?? "🏠"}
//                                                     </div>
//                                                 )}
//                                                 <span className="text-sm text-white truncate max-w-[180px]">
//                                                     {room.title || "Untitled"}
//                                                 </span>
//                                             </div>
//                                         </td>

//                                         {/* Type */}
//                                         <td className="px-4 py-3">
//                                             <span className="text-sm text-gray-300 capitalize">
//                                                 {ROOM_TYPE_ICONS[room.roomType]} {room.roomType}
//                                             </span>
//                                         </td>

//                                         {/* Event */}
//                                         <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-[100px] truncate">
//                                             {room.eventId || "—"}
//                                         </td>

//                                         {/* Price */}
//                                         <td className="px-4 py-3 text-sm text-gray-300">
//                                             {room.price !== null && room.price !== undefined
//                                                 ? `$${room.price}`
//                                                 : <span className="text-gray-600">Free</span>}
//                                         </td>

//                                         {/* Status */}
//                                         <td className="px-4 py-3">
//                                             <span
//                                                 className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${
//                                                     STATUS_COLORS[room.status as RoomStatus] || STATUS_COLORS.draft
//                                                 }`}
//                                             >
//                                                 {room.status}
//                                             </span>
//                                         </td>

//                                         {/* Created */}
//                                         <td className="px-4 py-3 text-xs text-gray-500">
//                                             {room.createdAt
//                                                 ? new Date(room.createdAt).toLocaleDateString()
//                                                 : "—"}
//                                         </td>

//                                         {/* Actions */}
//                                         <td className="px-4 py-3">
//                                             <div className="flex items-center gap-2">
//                                                 <Link href={`/admin/room-management/room-list/${room.id}`}>
//                                                     <button className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
//                                                         <Eye size={15} />
//                                                     </button>
//                                                 </Link>
//                                                 <Link href={`/admin/room-management/create-room?id=${room.id}`}>
//                                                     <button className="p-1.5 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition">
//                                                         <Pencil size={15} />
//                                                     </button>
//                                                 </Link>
//                                                 <button
//                                                     onClick={() => handleDelete(room.id!)}
//                                                     className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
//                                                 >
//                                                     <Trash2 size={15} />
//                                                 </button>
//                                             </div>
//                                         </td>
//                                     </tr>
//                                 ))
//                             )}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         </div>
//     );
// }


export default function hostroomList (){
    return (
        <p>List</p>
    )
}