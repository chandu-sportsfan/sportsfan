// "use client";

// import axios from "axios";
// import { useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import PlayerProfileForm, { defaultProfileForm } from "./PlayerProfileForm";
// import SeasonStatsForm, { defaultSeasonForm } from "./SeasonStatsForm";
// import InsightsForm from "./InsightsForm";
// import MediaForm from "./MediaForm";

// import type {
//     Tab,
//     ProfileForm,
//     SeasonForm,
//     Insight,
//     MediaItem,
// } from "./shared";



// //  PROPS 

// type Props = {
//     profileIdToEdit?: string;
// };

// //  TAB CONFIG 
// const TABS: { key: Tab; label: string; icon: string }[] = [
//     { key: "profile", label: "Player Profile", icon: "🏏" },
//     { key: "season", label: "Season Stats", icon: "📊" },
//     { key: "insights", label: "Insights", icon: "💡" },
//     { key: "media", label: "Media", icon: "🎬" },
// ];

// //  PAGE COMPONENT 

// export default function CreateClubProfile({ profileIdToEdit }: Props) {
//     const router = useRouter();
//     const [activeTab, setActiveTab] = useState<Tab>("profile");

//     // IDs — set after each section is saved
//     const [savedProfileId, setSavedProfileId] = useState(profileIdToEdit || "");
//     const [savedSeasonId, setSavedSeasonId] = useState("");
//     const [savedInsightsId, setSavedInsightsId] = useState("");
//     const [savedMediaId, setSavedMediaId] = useState("");

//     // Initial data for each form (populated on edit)
//     const [profileInitial, setProfileInitial] = useState<ProfileForm>(defaultProfileForm);
//     const [avatarInitial, setAvatarInitial] = useState("");
//     const [seasonInitial, setSeasonInitial] = useState<SeasonForm>(defaultSeasonForm);
//     const [insightsInitial, setInsightsInitial] = useState<Insight[]>([]);
//     const [strengthsInitial, setStrengthsInitial] = useState<string[]>([]);
//     const [mediaInitial, setMediaInitial] = useState<MediaItem[]>([]);

//     const [loadingData, setLoadingData] = useState(!!profileIdToEdit);

//     //  Fetch all data when editing 
//     useEffect(() => {
//         if (!profileIdToEdit) {
//             setLoadingData(false);
//             return;
//         }

//         const fetchAll = async () => {
//             try {
//                 // 1. Profile
//                 const profileRes = await axios.get(`/api/player-profile/${profileIdToEdit}`);
//                 const p = profileRes.data.profile;
//                 setProfileInitial({
//                     name: p.name || "",
//                     team: p.team || "",
//                     battingStyle: p.battingStyle || "",
//                     bowlingStyle: p.bowlingStyle || "",
//                     about: p.about || "",
//                     statsRuns: p.stats?.runs || "",
//                     statsSr: p.stats?.sr || "",
//                     statsAvg: p.stats?.avg || "",
//                     iplDebut: p.overview?.iplDebut || "",
//                     specialization: p.overview?.specialization || "",
//                     dob: p.overview?.dob || "",
//                     matches: p.overview?.matches || "",
//                 });
//                 setAvatarInitial(p.avatar || "");

//                 // 2. Season (latest)
//                 const seasonRes = await axios.get(
//                     `/api/player-profile/seasonstats?playerProfileId=${profileIdToEdit}&limit=1`
//                 );
//                 if (seasonRes.data.seasons?.length > 0) {
//                     const s = seasonRes.data.seasons[0];
//                     setSavedSeasonId(s.id);
//                     const sd = s.season;
//                     setSeasonInitial({
//                         year: sd.year || "",
//                         // wins:         sd.wins         || "",
//                         // losses:       sd.losses       || "",
//                         // points:       sd.points       || "",
//                         // position:     sd.position     || "",
//                         // matchesPlayed:sd.matchesPlayed|| "",
//                         // netRunRate:   sd.netRunRate   || "",
//                         // highestTotal: sd.highestTotal || "",
//                         // lowestTotal:  sd.lowestTotal  || "",
//                         runs: sd.runs || "",
//                         strikeRate: sd.strikeRate || "",
//                         average: sd.average || "",
//                         fifties: String(sd.fifties ?? ""),
//                         hundreds: String(sd.hundreds ?? ""),
//                         highestScore: sd.highestScore || "",
//                         fours: String(sd.fours ?? ""),
//                         sixes: String(sd.sixes ?? ""),
//                         award: sd.award || "",
//                         awardSub: sd.awardSub || "",
//                         wickets: String(sd.wickets ?? ""),
//                         deliveries: String(sd.deliveries ?? ""),
//                         bowlingAvg: sd.bowlingAvg || "",
//                         bowlingSR: sd.bowlingSR || "",
//                         economy: sd.economy || "",
//                         bestBowling: sd.bestBowling || "",
//                         threeWicketHauls: String(sd.threeWicketHauls ?? ""),
//                         fiveWicketHauls: String(sd.fiveWicketHauls ?? ""),
//                         foursConceded: String(sd.foursConceded ?? ""),
//                         sixesConceded: String(sd.sixesConceded ?? ""),
//                     });
//                 }


//                 // 3. Insights
//                 const insightsRes = await axios.get(
//                     `/api/player-profile/insights/${profileIdToEdit}`
//                 );

//                 if (insightsRes.data.success) {
//                     const ins = insightsRes.data.insightsDoc;

//                     setSavedInsightsId(ins.id);
//                     setInsightsInitial(ins.insights || []);
//                     setStrengthsInitial(ins.strengths || []);
//                 }

//                 // 4. Media
//                 const mediaRes = await axios.get(
//                     `/api/player-profile/media?playerProfileId=${profileIdToEdit}&limit=1`
//                 );
//                 if (mediaRes.data.mediaDocs?.length > 0) {
//                     const med = mediaRes.data.mediaDocs[0];
//                     setSavedMediaId(med.id);
//                     setMediaInitial(
//                         (med.mediaItems || []).map(
//                             (m: { title: string; views: string; time: string; thumbnail: string }) => ({
//                                 title: m.title || "",
//                                 views: m.views || "",
//                                 time: m.time || "",
//                                 file: null,
//                                 existingThumbnail: m.thumbnail || "",
//                             })
//                         )
//                     );
//                 }
//             } catch (err) {
//                 console.error("Fetch error on edit:", err);
//             } finally {
//                 setLoadingData(false);
//             }
//         };

//         fetchAll();
//     }, [profileIdToEdit]);

//     // ── Tab guard: prevent navigating forward before profile is saved ─────────
//     const handleTabClick = (key: Tab) => {
//         if (key !== "profile" && !savedProfileId) {
//             alert("Please save the Player Profile first");
//             return;
//         }
//         setActiveTab(key);
//     };

//     // ── Completion 
//     const handleFinish = () => {
//         router.push("/admin/playerprofile-management/playerprofile-list");
//     };

//     if (loadingData) {
//         return (
//             <div className="max-w-[1440px] mx-auto p-12 flex flex-col items-center justify-center space-y-4">
//                 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
//                 <p className="text-gray-400 text-sm">Loading player data...</p>
//             </div>
//         );
//     }

//     // ─── RENDER 
//     return (
//         <div className="max-w-[1440px] mx-auto p-6">
//             {/* Page header */}
//             <div className="mb-6 flex items-center justify-between">
//                 <div>
//                     <h1 className="text-lg font-semibold text-white">
//                         {profileIdToEdit ? "Edit Player Profile" : "Create Player Profile"}
//                     </h1>
//                     <p className="text-xs text-gray-500 mt-1">
//                         Fill each tab and save before moving to the next
//                     </p>
//                 </div>
//                 {savedProfileId && (
//                     <span className="text-xs bg-green-900/40 text-green-400 border border-green-800 px-3 py-1 rounded-full">
//                         Profile ID: {savedProfileId.slice(0, 8)}…
//                     </span>
//                 )}
//             </div>

//             {/* Tab bar */}
//             <div className="flex gap-1 mb-6 bg-[#0d1117] p-1 rounded-lg border border-[#21262d] w-fit">
//                 {TABS.map((t) => {
//                     const isLocked = t.key !== "profile" && !savedProfileId;
//                     return (
//                         <button
//                             key={t.key}
//                             onClick={() => handleTabClick(t.key)}
//                             className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
//                 ${activeTab === t.key
//                                     ? "bg-blue-600 text-white shadow-lg"
//                                     : isLocked
//                                         ? "text-gray-600 cursor-not-allowed"
//                                         : "text-gray-400 hover:text-white hover:bg-[#161b22]"
//                                 }`}
//                         >
//                             <span>{t.icon}</span>
//                             {t.label}
//                             {isLocked && (
//                                 <span className="text-gray-700 text-xs ml-1">🔒</span>
//                             )}
//                         </button>
//                     );
//                 })}
//             </div>

//             {/* ── Tab: Player Profile ── */}
//             {activeTab === "profile" && (
//                 <PlayerProfileForm
//                     profileIdToEdit={profileIdToEdit}
//                     initialForm={profileInitial}
//                     initialAvatar={avatarInitial}
//                     onSaved={(id) => {
//                         setSavedProfileId(id);
//                         setActiveTab("season");
//                     }}
//                     onCancel={() => router.back()}
//                 />
//             )}

//             {/* ── Tab: Season Stats ── */}
//             {activeTab === "season" && (
//                 <SeasonStatsForm
//                     playerProfilesId={savedProfileId}
//                     seasonDocId={savedSeasonId}
//                     initialForm={seasonInitial}
//                     onSaved={(id) => {
//                         setSavedSeasonId(id);
//                         setActiveTab("insights");
//                     }}
//                     onBack={() => setActiveTab("profile")}
//                 />
//             )}

//             {/* ── Tab: Insights ── */}
//             {activeTab === "insights" && (
//                 <InsightsForm
//                     playerProfilesId={savedProfileId}
//                     insightsDocId={savedInsightsId}
//                     initialInsights={insightsInitial}
//                     initialStrengths={strengthsInitial}
//                     onSaved={(id) => {
//                         setSavedInsightsId(id);
//                         setActiveTab("media");
//                     }}
//                     onBack={() => setActiveTab("season")}
//                 />
//             )}

//             {/* ── Tab: Media ── */}
//             {activeTab === "media" && (
//                 <MediaForm
//                     playerProfilesId={savedProfileId}
//                     mediaDocId={savedMediaId}
//                     initialItems={mediaInitial}
//                     onSaved={setSavedMediaId}
//                     onBack={() => setActiveTab("insights")}
//                     onFinish={handleFinish}
//                 />
//             )}
//         </div>
//     );
// }

















"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PlayerProfileForm, { defaultProfileForm } from "./PlayerProfileForm";
import PlayerHomeForm from "./HomePlayerProfile"; // ✅ NEW
import SeasonStatsForm, { defaultSeasonForm } from "./SeasonStatsForm";
import InsightsForm from "./InsightsForm";
import MediaForm from "./MediaForm";

import type {
    Tab,
    ProfileForm,
    SeasonForm,
    Insight,
    MediaItem,
} from "./shared";

/* PROPS */
type Props = {
    profileIdToEdit?: string;
};

/* TAB CONFIG */
const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "profile", label: "Player Profile", icon: "" },
    { key: "home", label: "Home", icon: "" },
    { key: "season", label: "Season Stats", icon: "" },
    { key: "insights", label: "Insights", icon: "" },
    { key: "media", label: "Media", icon: "" },
];

export default function CreateClubProfile({ profileIdToEdit }: Props) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>("profile");

    const [savedProfileId, setSavedProfileId] = useState(profileIdToEdit || "");
    const [savedHomeId, setSavedHomeId] = useState(""); // ✅ NEW
    const [savedSeasonId, setSavedSeasonId] = useState("");
    const [savedInsightsId, setSavedInsightsId] = useState("");
    const [savedMediaId, setSavedMediaId] = useState("");

    const [profileInitial, setProfileInitial] =
        useState<ProfileForm>(defaultProfileForm);

    const [avatarInitial, setAvatarInitial] = useState("");
    const [seasonInitial, setSeasonInitial] =
        useState<SeasonForm>(defaultSeasonForm);

    const [insightsInitial, setInsightsInitial] = useState<Insight[]>([]);
    const [strengthsInitial, setStrengthsInitial] = useState<string[]>([]);
    const [mediaInitial, setMediaInitial] = useState<MediaItem[]>([]);

    const [loadingData, setLoadingData] = useState(!!profileIdToEdit);

    useEffect(() => {
        if (!profileIdToEdit) {
            setLoadingData(false);
            return;
        }

        const fetchAll = async () => {
            try {
                /* 1. PROFILE */
                const profileRes = await axios.get(
                    `/api/player-profile/${profileIdToEdit}`
                );

                const p = profileRes.data.profile;

                setProfileInitial({
                    name: p.name || "",
                    team: p.team || "",
                    battingStyle: p.battingStyle || "",
                    bowlingStyle: p.bowlingStyle || "",
                    about: p.about || "",
                    statsRuns: p.stats?.runs || "",
                    statsSr: p.stats?.sr || "",
                    statsAvg: p.stats?.avg || "",
                    iplDebut: p.overview?.iplDebut || "",
                    specialization: p.overview?.specialization || "",
                    dob: p.overview?.dob || "",
                    matches: p.overview?.matches || "",
                });

                setAvatarInitial(p.avatar || "");

                /* 2. HOME */
                const homeRes = await axios.get(
                    `/api/player-profile/home?playerProfilesId=${profileIdToEdit}&limit=1`
                );

                if (homeRes.data.posts?.length > 0) {
                    setSavedHomeId(homeRes.data.posts[0].id);
                }

                /* 3. SEASON */
                const seasonRes = await axios.get(
                    `/api/player-profile/seasonstats?playerProfilesId=${profileIdToEdit}&limit=1`
                );

                if (seasonRes.data.seasons?.length > 0) {
                    const s = seasonRes.data.seasons[0];
                    setSavedSeasonId(s.id);

                    const sd = s.season;

                    setSeasonInitial({
                        year: sd.year || "",
                        runs: sd.runs || "",
                        strikeRate: sd.strikeRate || "",
                        average: sd.average || "",
                        // fiftiesAndHundreds: String(sd.fifties ?? ""),
                        highestScore: sd.highestScore || "",
                        fours: String(sd.fours ?? ""),
                        sixes: String(sd.sixes ?? ""),
                        award: sd.award || "",
                        awardSub: sd.awardSub || "",
                        wickets: String(sd.wickets ?? ""),
                        deliveries: String(sd.deliveries ?? ""),
                        bowlingAvg: sd.bowlingAvg || "",
                        bowlingSR: sd.bowlingSR || "",
                        economy: sd.economy || "",
                        bestBowling: sd.bestBowling || "",
                        fiftiesAndHundreds: sd.fiftiesAndHundreds || (sd.fifties != null && sd.hundreds != null ? `${sd.fifties}/${sd.hundreds}` : ""),
                        threeW_fiveW_Hauls: sd.threeW_fiveW_Hauls || (sd.threeWicketHauls != null && sd.fiveWicketHauls != null ? `${sd.threeWicketHauls}/${sd.fiveWicketHauls}` : ""),
                        // threeW_fiveW_Hauls: String(sd.threeWicketHauls ?? ""),
                        foursConceded: String(sd.foursConceded ?? ""),
                        sixesConceded: String(sd.sixesConceded ?? ""),
                    });
                }

                /* 4. INSIGHTS */
                const insightsRes = await axios.get(
                    `/api/player-profile/insights/${profileIdToEdit}`
                );

                if (insightsRes.data.success) {
                    const ins = insightsRes.data.insightsDoc;
                    setSavedInsightsId(ins.id);
                    setInsightsInitial(ins.insights || []);
                    setStrengthsInitial(ins.strengths || []);
                }

                /* 5. MEDIA */
                const mediaRes = await axios.get(
                    `/api/player-profile/media?playerProfilesId=${profileIdToEdit}&limit=1`
                );

                if (mediaRes.data.mediaDocs?.length > 0) {
                    const med = mediaRes.data.mediaDocs[0];
                    setSavedMediaId(med.id);

                    setMediaInitial(
                        (med.mediaItems || []).map(
                            (m: {
                                title: string;
                                views: string;
                                time: string;
                                thumbnail: string;
                            }) => ({
                                title: m.title || "",
                                views: m.views || "",
                                time: m.time || "",
                                file: null,
                                existingThumbnail: m.thumbnail || "",
                            })
                        )
                    );
                }
            } catch (err) {
                console.error("Fetch error on edit:", err);
            } finally {
                setLoadingData(false);
            }
        };

        fetchAll();
    }, [profileIdToEdit]);

    const handleTabClick = (key: Tab) => {
        if (key !== "profile" && !savedProfileId) {
            alert("Please save the Player Profile first");
            return;
        }
        setActiveTab(key);
    };

    const handleFinish = () => {
        router.push("/admin/playerprofile-management/playerprofile-list");
    };

    if (loadingData) {
        return (
            <div className="max-w-[1440px] mx-auto p-12 flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                <p className="text-gray-400 text-sm">Loading player data...</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1440px] mx-auto p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold text-white">
                        {profileIdToEdit
                            ? "Edit Player Profile"
                            : "Create Player Profile"}
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Fill each tab and save before moving to the next
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-[#0d1117] p-1 rounded-lg border border-[#21262d] w-fit">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => handleTabClick(t.key)}
                        className={`px-4 py-2 rounded-md text-sm ${activeTab === t.key
                            ? "bg-blue-600 text-white"
                            : "text-gray-400"
                            }`}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* PROFILE */}
            {activeTab === "profile" && (
                <PlayerProfileForm
                    profileIdToEdit={profileIdToEdit}
                    initialForm={profileInitial}
                    initialAvatar={avatarInitial}
                    onSaved={(id) => {
                        setSavedProfileId(id);
                        setActiveTab("home"); // ✅ NEXT TAB
                    }}
                    onCancel={() => router.back()}
                />
            )}

            {/* HOME */}
            {/* {activeTab === "home" && (
                <PlayerHomeForm
                    playerProfilesId={savedProfileId}
                    homeDocId={savedHomeId}
                    onSaved={(id) => {
                        setSavedHomeId(id);
                        setActiveTab("season");
                    }}
                    onBack={() => setActiveTab("profile")}
                />
            )} */}

            {activeTab === "home" && (
                <PlayerHomeForm
                    playerProfilesId={savedProfileId}
                    homeDocId={savedHomeId}
                    onSaved={(id) => {
                        setSavedHomeId(id); // optional if you need later
                        setActiveTab("season");
                    }}
                    onBack={() => setActiveTab("profile")}
                />
            )}
            {/* SEASON */}
            {activeTab === "season" && (
                <SeasonStatsForm
                    playerProfilesId={savedProfileId}
                    seasonDocId={savedSeasonId}
                    initialForm={seasonInitial}
                    onSaved={(id) => {
                        setSavedSeasonId(id);
                        setActiveTab("insights");
                    }}
                    onBack={() => setActiveTab("home")}
                />
            )}

            {/* INSIGHTS */}
            {activeTab === "insights" && (
                <InsightsForm
                    playerProfilesId={savedProfileId}
                    insightsDocId={savedInsightsId}
                    initialInsights={insightsInitial}
                    initialStrengths={strengthsInitial}
                    onSaved={(id) => {
                        setSavedInsightsId(id);
                        setActiveTab("media");
                    }}
                    onBack={() => setActiveTab("season")}
                />
            )}

            {/* MEDIA */}
            {activeTab === "media" && (
                <MediaForm
                    playerProfilesId={savedProfileId}
                    mediaDocId={savedMediaId}
                    initialItems={mediaInitial}
                    onSaved={setSavedMediaId}
                    onBack={() => setActiveTab("insights")}
                    onFinish={handleFinish}
                />
            )}
        </div>
    );
}