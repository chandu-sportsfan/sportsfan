// // app/admin/matches/components/MatchForm.tsx
// "use client";

// import axios from "axios";
// import { ChangeEvent, useState, useRef, useEffect } from "react";
// import XLSX from "xlsx";

// // ============================================
// // TYPES
// // ============================================

// export interface InningStats {
//   runs: number;
//   wickets: number;
//   powerplay: number;
//   middle: number;
//   death: number;
//   dots: number;
//   fours: number;
//   sixes: number;
//   extras: number;
//   highestOver?: number;
// }

// export interface MatchFormData {
//   matchId: number;
//   date: string;
//   season: string;
//   team1: string;
//   team2: string;
//   venue: string;
//   city: string;
//   winner: string;
//   tossWinner: string;
//   tossDecision: "bat" | "field";
//   playerOfMatch: string;
//   inning1: InningStats;
//   inning2: InningStats;
//   inning3?: InningStats;
//   inning4?: InningStats;
//   inning5?: InningStats;
//   inning6?: InningStats;
//   target: number;
//   chaseSuccess: boolean;
//   isNoResult: boolean;
// }

// // Default form data
// export const defaultMatchForm: MatchFormData = {
//   matchId: 0,
//   date: "",
//   season: "",
//   team1: "",
//   team2: "",
//   venue: "",
//   city: "",
//   winner: "",
//   tossWinner: "",
//   tossDecision: "field",
//   playerOfMatch: "",
//   inning1: {
//     runs: 0,
//     wickets: 0,
//     powerplay: 0,
//     middle: 0,
//     death: 0,
//     dots: 0,
//     fours: 0,
//     sixes: 0,
//     extras: 0,
//     highestOver: 0,
//   },
//   inning2: {
//     runs: 0,
//     wickets: 0,
//     powerplay: 0,
//     middle: 0,
//     death: 0,
//     dots: 0,
//     fours: 0,
//     sixes: 0,
//     extras: 0,
//     highestOver: 0,
//   },
//   target: 0,
//   chaseSuccess: false,
//   isNoResult: false,
// };

// // ============================================
// // HELPER FUNCTIONS
// // ============================================

// const normalizeKey = (s: string): string =>
//   s.toLowerCase().replace(/[\s_]+/g, " ").trim();

// const buildLookup = (row: Record<string, unknown>): Record<string, string> =>
//   Object.keys(row).reduce((acc, k) => {
//     acc[normalizeKey(k)] = String(row[k] ?? "").trim();
//     return acc;
//   }, {} as Record<string, string>);

// const findValue = (
//   lookup: Record<string, string>,
//   ...fragments: string[]
// ): string => {
//   for (const frag of fragments) {
//     const normFrag = normalizeKey(frag);
//     const matchedKey = Object.keys(lookup).find((k) => k.includes(normFrag));
//     if (matchedKey !== undefined && lookup[matchedKey] !== "") {
//       return lookup[matchedKey];
//     }
//   }
//   return "";
// };

// const parseNumber = (value: string): number => {
//   const num = parseInt(value, 10);
//   return isNaN(num) ? 0 : num;
// };

// const parseBoolean = (value: string): boolean => {
//   const lower = value.toLowerCase();
//   return lower === "true" || lower === "yes" || lower === "1" || lower === "won";
// };

// // ============================================
// // COMPONENT PROPS
// // ============================================

// type Props = {
//   matchIdToEdit?: string;
//   initialForm?: MatchFormData;
//   onSavedAction: (matchId: string) => void;
//   onCancelAction: () => void;
// };

// // ============================================
// // MAIN COMPONENT
// // ============================================

// export default function MatchForm({
//   matchIdToEdit,
//   initialForm = defaultMatchForm,
//   onSavedAction,
//   onCancelAction,
// }: Props) {
//   const [form, setForm] = useState<MatchFormData>(initialForm);
//   const [loading, setLoading] = useState(false);
//   const [progress, setProgress] = useState({ current: 0, total: 0 });
//   const [errors, setErrors] = useState<string[]>([]);
//   const [successCount, setSuccessCount] = useState(0);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // Load match data if editing
//   useEffect(() => {
//     if (matchIdToEdit) {
//       const fetchMatch = async () => {
//         try {
//           const res = await axios.get(`/api/matches/${matchIdToEdit}`);
//           if (res.data.success) {
//             setForm(res.data.match);
//           }
//         } catch (error) {
//           console.error("Error fetching match:", error);
//         }
//       };
//       fetchMatch();
//     }
//   }, [matchIdToEdit]);

//   // ============================================
//   // FORM HANDLERS
//   // ============================================

//   const handleChange = (
//     e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
//   ) => {
//     const { name, value, type } = e.target;
    
//     if (name.includes(".")) {
//       const [parent, child] = name.split(".");
//       setForm((prev) => ({
//         ...prev,
//         [parent]: {
//           ...prev[parent as keyof MatchFormData] as InningStats,
//           [child]: type === "number" ? parseNumber(value) : value,
//         },
//       }));
//     } else {
//       setForm((prev) => ({
//         ...prev,
//         [name]: type === "number" ? parseNumber(value) : value,
//       }));
//     }
//   };

//   const handleSubmit = async () => {
//     // Validation
//     if (!form.matchId || !form.date || !form.team1 || !form.team2) {
//       alert("Match ID, Date, Team 1, and Team 2 are required");
//       return;
//     }

//     setLoading(true);
//     try {
//       let res;
//       if (matchIdToEdit) {
//         res = await axios.put(`/api/matches/${matchIdToEdit}`, form);
//         onSavedAction(matchIdToEdit);
//       } else {
//         res = await axios.post("/api/matches", form);
//         onSavedAction(res.data.id);
//       }

//       if (res.data.success) {
//         alert(matchIdToEdit ? "Match updated!" : "Match created!");
//         if (!matchIdToEdit) {
//           setForm({ ...defaultMatchForm, matchId: 0 });
//         }
//       }
//     } catch (err: unknown) {
//       console.error(err);
//       const msg = axios.isAxiosError(err) 
//         ? err.response?.data?.error || err.message 
//         : "Error saving match";
//       alert(msg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ============================================
//   // EXCEL IMPORT
//   // ============================================

//   const processExcelRow = async (
//     row: Record<string, unknown>,
//     idx: number
//   ): Promise<{ success: boolean; error?: string }> => {
//     const lookup = buildLookup(row);

//     // Extract match data from Excel row
//     const matchData: Partial<MatchFormData> = {
//       matchId: parseNumber(findValue(lookup, "match_id", "match id", "matchid")),
//       date: findValue(lookup, "date"),
//       season: findValue(lookup, "season"),
//       team1: findValue(lookup, "team1", "team 1"),
//       team2: findValue(lookup, "team2", "team 2"),
//       venue: findValue(lookup, "venue"),
//       city: findValue(lookup, "city"),
//       winner: findValue(lookup, "winner"),
//       tossWinner: findValue(lookup, "toss_winner", "toss winner"),
//       tossDecision: findValue(lookup, "toss_decision", "toss decision") as "bat" | "field",
//       playerOfMatch: findValue(lookup, "player_of_match", "player of match", "mom"),
//       chaseSuccess: parseBoolean(findValue(lookup, "chase_success", "chase success")),
//       isNoResult: findValue(lookup, "winner", "result") === "No Result",
//     };

//     // Inning 1 stats
//     matchData.inning1 = {
//       runs: parseNumber(findValue(lookup, "runs_1", "runs 1")),
//       wickets: parseNumber(findValue(lookup, "wkts_1", "wkts 1", "wickets 1")),
//       powerplay: parseNumber(findValue(lookup, "powerplay_1", "powerplay 1")),
//       middle: parseNumber(findValue(lookup, "middle_1", "middle 1")),
//       death: parseNumber(findValue(lookup, "death_1", "death 1")),
//       dots: parseNumber(findValue(lookup, "dots_1", "dots 1")),
//       fours: parseNumber(findValue(lookup, "4s_1", "4s 1", "fours 1")),
//       sixes: parseNumber(findValue(lookup, "6s_1", "6s 1", "sixes 1")),
//       extras: parseNumber(findValue(lookup, "extras_1", "extras 1")),
//       highestOver: parseNumber(findValue(lookup, "highest_over_1", "highest over 1")),
//     };

//     // Inning 2 stats
//     matchData.inning2 = {
//       runs: parseNumber(findValue(lookup, "runs_2", "runs 2")),
//       wickets: parseNumber(findValue(lookup, "wkts_2", "wkts 2", "wickets 2")),
//       powerplay: parseNumber(findValue(lookup, "powerplay_2", "powerplay 2")),
//       middle: parseNumber(findValue(lookup, "middle_2", "middle 2")),
//       death: parseNumber(findValue(lookup, "death_2", "death 2")),
//       dots: parseNumber(findValue(lookup, "dots_2", "dots 2")),
//       fours: parseNumber(findValue(lookup, "4s_2", "4s 2", "fours 2")),
//       sixes: parseNumber(findValue(lookup, "6s_2", "6s 2", "sixes 2")),
//       extras: parseNumber(findValue(lookup, "extras_2", "extras 2")),
//       highestOver: parseNumber(findValue(lookup, "highest_over_2", "highest over 2")),
//     };

//     // Calculate target if not present
//     matchData.target = parseNumber(findValue(lookup, "target")) || 
//       (matchData.inning1!.runs + (matchData.chaseSuccess ? 1 : 0));

//     // Validate required fields
//     if (!matchData.matchId || !matchData.date || !matchData.team1 || !matchData.team2) {
//       return {
//         success: false,
//         error: `Missing required fields: matchId=${matchData.matchId}, date=${matchData.date}, teams=${matchData.team1}/${matchData.team2}`,
//       };
//     }

//     // Check for duplicate match_id
//     try {
//       const existing = await axios.get(`/api/matches?matchId=${matchData.matchId}`);
//       if (existing.data.matches?.length > 0) {
//         return { success: false, error: `Match ID ${matchData.matchId} already exists` };
//       }
//     } catch {
//       // If check fails, continue anyway (API might not support this filter)
//     }

//     // Create match
//     try {
//       await axios.post("/api/matches", matchData);
//       return { success: true };
//     } catch (err: unknown) {
//       const msg = axios.isAxiosError(err) 
//         ? err.response?.data?.error || err.message 
//         : String(err);
//       return { success: false, error: msg };
//     }
//   };

//   const processBatch = async <T,>(
//     items: T[],
//     batchSize: number,
//     handler: (item: T, index: number) => Promise<{ success: boolean; error?: string }>,
//     onProgress: (done: number) => void
//   ): Promise<{ successes: number; failures: Array<{ index: number; error: string }> }> => {
//     let done = 0;
//     const failures: Array<{ index: number; error: string }> = [];
//     let successes = 0;

//     for (let i = 0; i < items.length; i += batchSize) {
//       const chunk = items.slice(i, i + batchSize);
//       const results = await Promise.all(
//         chunk.map(async (item, j) => {
//           const result = await handler(item, i + j);
//           return { index: i + j, result };
//         })
//       );

//       for (const { index, result } of results) {
//         if (result.success) {
//           successes++;
//         } else if (result.error) {
//           failures.push({ index: index + 2, error: result.error });
//         }
//         done++;
//         onProgress(done);
//       }

//       // Delay between batches
//       if (i + batchSize < items.length) {
//         await new Promise((res) => setTimeout(res, 500));
//       }
//     }

//     return { successes, failures };
//   };

//   const handleExcelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     setErrors([]);
//     setSuccessCount(0);
//     setProgress({ current: 0, total: 0 });

//     try {
//       const buffer = await file.arrayBuffer();
//       const wb = XLSX.read(buffer, { type: "array" });
//       const ws = wb.Sheets[wb.SheetNames[0]];
//       const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];

//       if (!data.length) {
//         alert("The uploaded file is empty.");
//         return;
//       }

//       setProgress({ current: 0, total: data.length });

//       const { successes, failures } = await processBatch(
//         data,
//         5,
//         processExcelRow,
//         (done) => setProgress((p) => ({ ...p, current: done }))
//       );

//       setSuccessCount(successes);
//       setErrors(failures.map((f) => `Row ${f.index}: ${f.error}`));

//       alert(
//         `Bulk import complete!\n✅ ${successes} succeeded\n❌ ${failures.length} failed` +
//         (failures.length ? "\n\nSee error log below the upload button." : "")
//       );
//     } catch (err) {
//       console.error(err);
//       alert("Failed to parse the Excel file. Make sure it is a valid .xlsx / .xls file.");
//     } finally {
//       if (fileInputRef.current) fileInputRef.current.value = "";
//       setTimeout(() => setProgress({ current: 0, total: 0 }), 2000);
//     }
//   };

//   const importInProgress = progress.total > 0 && progress.current < progress.total;

//   // ============================================
//   // RENDER INNING FORM
//   // ============================================

//   const renderInningForm = (inningNum: number, inning: InningStats) => (
//     <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/30">
//       <h3 className="text-md font-semibold text-gray-300 mb-3">Inning {inningNum}</h3>
//       <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
//         <InputField
//           label="Runs"
//           name={`inning${inningNum}.runs`}
//           value={inning.runs}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Wickets"
//           name={`inning${inningNum}.wickets`}
//           value={inning.wickets}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Powerplay"
//           name={`inning${inningNum}.powerplay`}
//           value={inning.powerplay}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Middle"
//           name={`inning${inningNum}.middle`}
//           value={inning.middle}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Death"
//           name={`inning${inningNum}.death`}
//           value={inning.death}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Dots"
//           name={`inning${inningNum}.dots`}
//           value={inning.dots}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Fours"
//           name={`inning${inningNum}.fours`}
//           value={inning.fours}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Sixes"
//           name={`inning${inningNum}.sixes`}
//           value={inning.sixes}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Extras"
//           name={`inning${inningNum}.extras`}
//           value={inning.extras}
//           onChange={handleChange}
//           type="number"
//         />
//         <InputField
//           label="Highest Over"
//           name={`inning${inningNum}.highestOver`}
//           value={inning.highestOver || 0}
//           onChange={handleChange}
//           type="number"
//         />
//       </div>
//     </div>
//   );

//   const isEditing = !!matchIdToEdit;

//   return (
//     <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6 space-y-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <h2 className="text-xl font-bold text-white">
//           {isEditing ? "Edit Match" : "Add New Match"}
//         </h2>
//         <button
//           type="button"
//           onClick={onCancelAction}
//           className="text-gray-400 hover:text-gray-300"
//         >
//           ✕
//         </button>
//       </div>

//       {/* ============================================ */}
//       {/* BULK IMPORT SECTION */}
//       {/* ============================================ */}
//       <div className="bg-blue-900/10 border border-blue-800/30 p-4 rounded-lg space-y-3">
//         <div className="flex items-center justify-between flex-wrap gap-3">
//           <div>
//             <h3 className="text-sm font-semibold text-blue-400">
//               Bulk Import from Excel
//             </h3>
//             <p className="text-xs text-gray-500 mt-1">
//               Upload a spreadsheet to import <strong>all matches at once</strong>.
//               Supports IPL, Mushtaq Ali, and T20I data.
//             </p>
//           </div>
//           <div>
//             <input
//               type="file"
//               accept=".xlsx,.xls,.csv"
//               className="hidden"
//               ref={fileInputRef}
//               onChange={handleExcelUpload}
//             />
//             <button
//               type="button"
//               disabled={importInProgress}
//               onClick={() => fileInputRef.current?.click()}
//               className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-4 py-2 rounded transition"
//             >
//               {importInProgress ? "Importing..." : "Upload Excel"}
//             </button>
//           </div>
//         </div>

//         {/* Progress Bar */}
//         {progress.total > 0 && (
//           <div className="space-y-1">
//             <div className="flex justify-between text-xs text-gray-400">
//               <span>
//                 {progress.current} / {progress.total} matches processed
//               </span>
//               <span>{Math.round((progress.current / progress.total) * 100)}%</span>
//             </div>
//             <div className="w-full bg-gray-800 rounded-full h-2">
//               <div
//                 className="bg-blue-500 h-2 rounded-full transition-all duration-300"
//                 style={{ width: `${(progress.current / progress.total) * 100}%` }}
//               />
//             </div>
//           </div>
//         )}

//         {/* Success Count */}
//         {successCount > 0 && !importInProgress && (
//           <div className="text-xs text-green-400">
//             ✅ Successfully imported {successCount} matches
//           </div>
//         )}

//         {/* Error Log */}
//         {errors.length > 0 && (
//           <details className="mt-2">
//             <summary className="text-xs text-red-400 cursor-pointer">
//               ❌ {errors.length} row(s) failed — click to expand
//             </summary>
//             <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
//               {errors.map((e, i) => (
//                 <p
//                   key={i}
//                   className="text-xs text-red-300 font-mono bg-red-900/10 px-2 py-1 rounded"
//                 >
//                   {e}
//                 </p>
//               ))}
//             </div>
//           </details>
//         )}
//       </div>

//       {/* ============================================ */}
//       {/* SINGLE MATCH FORM */}
//       {/* ============================================ */}
//       <div className="border-t border-gray-800 pt-4">
//         <h3 className="text-md font-semibold text-gray-400 mb-4">
//           {isEditing ? "Edit Match Details" : "Add Single Match"}
//         </h3>
//       </div>

//       {/* Basic Information */}
//       <div className="space-y-3">
//         <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
//           Basic Information
//         </h4>
//         <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//           <InputField
//             label="Match ID *"
//             name="matchId"
//             value={form.matchId}
//             onChange={handleChange}
//             type="number"
//             required
//           />
//           <InputField
//             label="Date *"
//             name="date"
//             value={form.date}
//             onChange={handleChange}
//             type="date"
//             required
//           />
//           <InputField
//             label="Season *"
//             name="season"
//             value={form.season}
//             onChange={handleChange}
//             placeholder="e.g., 2024 or 2020/21"
//             required
//           />
//           <SelectField
//             label="Toss Decision"
//             name="tossDecision"
//             value={form.tossDecision}
//             onChange={handleChange}
//             options={[
//               { value: "bat", label: "Bat First" },
//               { value: "field", label: "Field First" },
//             ]}
//           />
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//           <InputField
//             label="Team 1 *"
//             name="team1"
//             value={form.team1}
//             onChange={handleChange}
//             placeholder="e.g., Mumbai Indians"
//             required
//           />
//           <InputField
//             label="Team 2 *"
//             name="team2"
//             value={form.team2}
//             onChange={handleChange}
//             placeholder="e.g., Chennai Super Kings"
//             required
//           />
//           <InputField
//             label="Toss Winner"
//             name="tossWinner"
//             value={form.tossWinner}
//             onChange={handleChange}
//             placeholder="Team that won the toss"
//           />
//           <InputField
//             label="Winner"
//             name="winner"
//             value={form.winner}
//             onChange={handleChange}
//             placeholder="Winning team (or 'No Result')"
//           />
//           <InputField
//             label="Venue"
//             name="venue"
//             value={form.venue}
//             onChange={handleChange}
//             placeholder="Stadium name"
//           />
//           <InputField
//             label="City"
//             name="city"
//             value={form.city}
//             onChange={handleChange}
//             placeholder="City name"
//           />
//           <InputField
//             label="Player of the Match"
//             name="playerOfMatch"
//             value={form.playerOfMatch}
//             onChange={handleChange}
//             placeholder="Player name"
//           />
//         </div>
//       </div>

//       {/* Innings Stats */}
//       <div className="space-y-4">
//         <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
//           Match Stats
//         </h4>
//         {renderInningForm(1, form.inning1)}
//         {renderInningForm(2, form.inning2)}
//       </div>

//       {/* Result Details */}
//       <div className="space-y-3">
//         <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
//           Result Details
//         </h4>
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//           <InputField
//             label="Target"
//             name="target"
//             value={form.target}
//             onChange={handleChange}
//             type="number"
//           />
//           <CheckboxField
//             label="Chase Successful"
//             name="chaseSuccess"
//             checked={form.chaseSuccess}
//             onChange={(e) =>
//               setForm((prev) => ({ ...prev, chaseSuccess: e.target.checked }))
//             }
//           />
//           <CheckboxField
//             label="No Result"
//             name="isNoResult"
//             checked={form.isNoResult}
//             onChange={(e) =>
//               setForm((prev) => ({ ...prev, isNoResult: e.target.checked }))
//             }
//           />
//         </div>
//       </div>

//       {/* Form Actions */}
//       <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
//         <button
//           type="button"
//           onClick={onCancel}
//           className="px-4 py-2 text-gray-400 hover:text-gray-300 transition"
//         >
//           Cancel
//         </button>
//         <button
//           type="button"
//           onClick={handleSubmit}
//           disabled={loading}
//           className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition font-medium"
//         >
//           {loading ? "Saving..." : isEditing ? "Update Match" : "Create Match"}
//         </button>
//       </div>
//     </div>
//   );
// }

// // ============================================
// // REUSABLE FORM COMPONENTS
// // ============================================

// interface InputFieldProps {
//   label: string;
//   name: string;
//   value: string | number;
//   onChange: (e: ChangeEvent<HTMLInputElement>) => void;
//   type?: string;
//   placeholder?: string;
//   required?: boolean;
// }

// function InputField({
//   label,
//   name,
//   value,
//   onChange,
//   type = "text",
//   placeholder,
//   required = false,
// }: InputFieldProps) {
//   return (
//     <div className="flex flex-col gap-1">
//       <label className="text-xs font-medium text-gray-400">
//         {label} {required && <span className="text-red-500">*</span>}
//       </label>
//       <input
//         type={type}
//         name={name}
//         value={value}
//         onChange={onChange}
//         placeholder={placeholder}
//         required={required}
//         className="bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition"
//       />
//     </div>
//   );
// }

// interface SelectFieldProps {
//   label: string;
//   name: string;
//   value: string;
//   onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
//   options: { value: string; label: string }[];
// }

// function SelectField({ label, name, value, onChange, options }: SelectFieldProps) {
//   return (
//     <div className="flex flex-col gap-1">
//       <label className="text-xs font-medium text-gray-400">{label}</label>
//       <select
//         name={name}
//         value={value}
//         onChange={onChange}
//         className="bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition"
//       >
//         {options.map((opt) => (
//           <option key={opt.value} value={opt.value}>
//             {opt.label}
//           </option>
//         ))}
//       </select>
//     </div>
//   );
// }

// interface CheckboxFieldProps {
//   label: string;
//   name: string;
//   checked: boolean;
//   onChange: (e: ChangeEvent<HTMLInputElement>) => void;
// }

// function CheckboxField({ label, name, checked, onChange }: CheckboxFieldProps) {
//   return (
//     <label className="flex items-center gap-2 cursor-pointer">
//       <input
//         type="checkbox"
//         name={name}
//         checked={checked}
//         onChange={onChange}
//         className="w-4 h-4 accent-blue-500"
//       />
//       <span className="text-sm text-gray-300">{label}</span>
//     </label>
//   );
// }












// admin/cricket-matches-management/add-cricketmatches/page.tsx
"use client";

import { useState, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";

interface InningStats {
  runs: number;
  wickets: number;
  powerplay: number;
  middle: number;
  death: number;
  dots: number;
  fours: number;
  sixes: number;
  extras: number;
  highestOver?: number;
}

interface MatchFormData {
  matchId: number;
  date: string;
  season: string;
  team1: string;
  team2: string;
  venue: string;
  city: string;
  winner: string;
  tossWinner: string;
  tossDecision: "bat" | "field";
  playerOfMatch: string;
  inning1: InningStats;
  inning2: InningStats;
  target: number;
  chaseSuccess: boolean;
  isNoResult: boolean;
}

const defaultForm: MatchFormData = {
  matchId: 0,
  date: "",
  season: "",
  team1: "",
  team2: "",
  venue: "",
  city: "",
  winner: "",
  tossWinner: "",
  tossDecision: "field",
  playerOfMatch: "",
  inning1: { runs: 0, wickets: 0, powerplay: 0, middle: 0, death: 0, dots: 0, fours: 0, sixes: 0, extras: 0 },
  inning2: { runs: 0, wickets: 0, powerplay: 0, middle: 0, death: 0, dots: 0, fours: 0, sixes: 0, extras: 0 },
  target: 0,
  chaseSuccess: false,
  isNoResult: false,
};

export default function AddCricketMatchPage() {
  const [form, setForm] = useState<MatchFormData>(defaultForm);
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
        [parent]: { ...prev[parent as keyof MatchFormData] as InningStats, [child]: numValue }
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
      await axios.post("/api/matches", form);
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
        Object.entries(data[i]).forEach(([k, v]) => { lookup[normalizeKey(k)] = String(v ?? "").trim(); });

        const matchData: Partial<MatchFormData> = {
          matchId: parseInt(findValue(lookup, "match_id", "match id")) || 0,
          date: findValue(lookup, "date"),
          season: findValue(lookup, "season"),
          team1: findValue(lookup, "team1", "team 1"),
          team2: findValue(lookup, "team2", "team 2"),
          venue: findValue(lookup, "venue"),
          city: findValue(lookup, "city"),
          winner: findValue(lookup, "winner"),
          tossWinner: findValue(lookup, "toss_winner", "toss winner"),
          tossDecision: findValue(lookup, "toss_decision") as "bat" | "field",
          playerOfMatch: findValue(lookup, "player_of_match", "player of match"),
          chaseSuccess: findValue(lookup, "chase_success", "chase success").toLowerCase() === "true",
          isNoResult: findValue(lookup, "winner") === "No Result",
          inning1: {
            runs: parseInt(findValue(lookup, "runs_1", "runs 1")) || 0,
            wickets: parseInt(findValue(lookup, "wkts_1", "wickets 1")) || 0,
            powerplay: parseInt(findValue(lookup, "powerplay_1")) || 0,
            middle: parseInt(findValue(lookup, "middle_1")) || 0,
            death: parseInt(findValue(lookup, "death_1")) || 0,
            dots: parseInt(findValue(lookup, "dots_1")) || 0,
            fours: parseInt(findValue(lookup, "4s_1", "fours 1")) || 0,
            sixes: parseInt(findValue(lookup, "6s_1", "sixes 1")) || 0,
            extras: parseInt(findValue(lookup, "extras_1")) || 0,
          },
          inning2: {
            runs: parseInt(findValue(lookup, "runs_2", "runs 2")) || 0,
            wickets: parseInt(findValue(lookup, "wkts_2", "wickets 2")) || 0,
            powerplay: parseInt(findValue(lookup, "powerplay_2")) || 0,
            middle: parseInt(findValue(lookup, "middle_2")) || 0,
            death: parseInt(findValue(lookup, "death_2")) || 0,
            dots: parseInt(findValue(lookup, "dots_2")) || 0,
            fours: parseInt(findValue(lookup, "4s_2", "fours 2")) || 0,
            sixes: parseInt(findValue(lookup, "6s_2", "sixes 2")) || 0,
            extras: parseInt(findValue(lookup, "extras_2")) || 0,
          },
          target: parseInt(findValue(lookup, "target")) || 0,
        };

        if (!matchData.matchId || !matchData.date || !matchData.team1 || !matchData.team2) {
          errors.push(`Row ${i + 2}: Missing required fields`);
          setBulkProgress(p => ({ ...p, current: i + 1 }));
          continue;
        }

        try {
          await axios.post("/api/matches", matchData);
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
      <h1 className="text-2xl font-bold mb-6">Add Cricket Match</h1>

      {/* Bulk Upload Section */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">📊 Bulk Import from Excel</h2>
        <p className="text-sm text-gray-400 mb-3">
          Upload Excel file with cricket match data. Supports columns: match_id, date, season, team1, team2, venue, city, winner, 
          toss_winner, toss_decision, player_of_match, runs_1, runs_2, wickets_1, wickets_2, and other inning stats.
        </p>
        <input 
          type="file" 
          accept=".xlsx,.xls,.csv" 
          ref={fileInputRef} 
          onChange={handleBulkUpload} 
          className="mb-3" 
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Match ID *</label>
            <input type="number" name="matchId" value={form.matchId || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Season *</label>
            <input type="text" name="season" value={form.season} onChange={handleChange} placeholder="2024 or 2020/21" className="w-full p-2 bg-gray-800 border border-gray-700 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Toss Decision</label>
            <select name="tossDecision" value={form.tossDecision} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded">
              <option value="bat">Bat First</option>
              <option value="field">Field First</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Team 1 *</label>
            <input type="text" name="team1" value={form.team1} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Team 2 *</label>
            <input type="text" name="team2" value={form.team2} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Venue</label>
            <input type="text" name="venue" value={form.venue} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input type="text" name="city" value={form.city} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Toss Winner</label>
            <input type="text" name="tossWinner" value={form.tossWinner} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Winner</label>
            <input type="text" name="winner" value={form.winner} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Player of the Match</label>
            <input type="text" name="playerOfMatch" value={form.playerOfMatch} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target</label>
            <input type="number" name="target" value={form.target || ""} onChange={handleChange} className="w-full p-2 bg-gray-800 border border-gray-700 rounded" />
          </div>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="chaseSuccess" checked={form.chaseSuccess} onChange={handleCheckbox} />
            <span>Chase Successful</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isNoResult" checked={form.isNoResult} onChange={handleCheckbox} />
            <span>No Result</span>
          </label>
        </div>

        {/* Inning 1 */}
        <div className="border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Inning 1</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["runs", "wickets", "powerplay", "middle", "death", "dots", "fours", "sixes", "extras"].map(field => (
              <div key={field}>
                <label className="block text-xs text-gray-400 capitalize">{field}</label>
                <input
                  type="number"
                  name={`inning1.${field}`}
                  value={(form.inning1 as InningStats)[field as keyof InningStats] ?? ""}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Inning 2 */}
        <div className="border border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Inning 2</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["runs", "wickets", "powerplay", "middle", "death", "dots", "fours", "sixes", "extras"].map(field => (
              <div key={field}>
                <label className="block text-xs text-gray-400 capitalize">{field}</label>
                <input
                  type="number"
                  name={`inning2.${field}`}
                  value={(form.inning2 as InningStats)[field as keyof InningStats] ?? ""}
                  onChange={handleChange}
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
          {loading ? "Saving..." : "Add Match"}
        </button>
      </form>
    </div>
  );
}