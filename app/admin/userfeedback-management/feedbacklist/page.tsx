"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface QuestionOption {
    id: string;
    label: string;
    value: string;
}

interface FeedbackQuestion {
    id: string;
    question: string;
    type: "multiple_choice" | "text" | "rating" | "file_upload";
    options?: QuestionOption[];
    required: boolean;
    order: number;
    isActive: boolean;
}

type AnswerValue = string | string[] | number | null;

interface AnswerMap {
    [questionId: string]: AnswerValue;
}

interface FileMap {
    [questionId: string]: File[];
}

export default function FeedbackForm() {
    const { user, getUserDisplayName, isAuthenticated, loading: authLoading } = useAuth();
    const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [answers, setAnswers] = useState<AnswerMap>({});
    const [files, setFiles] = useState<FileMap>({});
    const [textFeedback, setTextFeedback] = useState("");
    const [rating, setRating] = useState<number | null>(null);
    const [hoveredStar, setHoveredStar] = useState<number | null>(null);
    const [displayName, setDisplayName] = useState("");
    const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const router = useRouter();

    // Get or create user name for display (same logic as FullPlaylist)
    useEffect(() => {
        if (!authLoading) {
            if (isAuthenticated && user) {
                const name = getUserDisplayName();
                setDisplayName(name);
                localStorage.setItem("feedback_user_name", name);
            } else {
                let storedName = localStorage.getItem("feedback_user_name");
                if (!storedName) {
                    storedName = `Fan_${Math.random().toString(36).substr(2, 5)}`;
                    localStorage.setItem("feedback_user_name", storedName);
                }
                setDisplayName(storedName);
            }
        }
    }, [user, isAuthenticated, authLoading, getUserDisplayName]);

    // Get user name for API
    const getUserNameForFeedback = () => {
        if (isAuthenticated && user) {
            return getUserDisplayName();
        }
        const stored = localStorage.getItem("feedback_user_name");
        if (stored) return stored;
        return `Fan_${Math.random().toString(36).substr(2, 5)}`;
    };

    useEffect(() => {
        fetchQuestions();
    }, []);

    const fetchQuestions = async () => {
        try {
            const res = await axios.get("/api/feedback/questions");
            const active = (res.data.questions as FeedbackQuestion[]).filter(
                (q) => q.isActive !== false
            );
            setQuestions(active);
        } catch {
            setError("Failed to load feedback form");
        } finally {
            setLoading(false);
        }
    };

    const setAnswer = (questionId: string, value: AnswerValue) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    };

    const toggleMultiChoice = (questionId: string, value: string) => {
        setAnswers((prev) => {
            const current = (prev[questionId] as string[]) || [];
            const exists = current.includes(value);
            return {
                ...prev,
                [questionId]: exists
                    ? current.filter((v) => v !== value)
                    : [...current, value],
            };
        });
    };

    const handleFileChange = (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = Array.from(e.target.files || []);
        setFiles((prev) => ({ ...prev, [questionId]: selected }));
    };

    const uploadFiles = async (questionId: string): Promise<string[]> => {
        const questionFiles = files[questionId];
        if (!questionFiles || questionFiles.length === 0) return [];

        const uploaded: string[] = [];
        for (const file of questionFiles) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "");
            try {
                const res = await axios.post(
                    `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/auto/upload`,
                    formData
                );
                uploaded.push(res.data.secure_url);
            } catch {
                console.error("File upload failed for", file.name);
            }
        }
        return uploaded;
    };

    const validate = (): string | null => {
        for (const q of questions) {
            if (!q.required) continue;
            if (q.type === "multiple_choice") {
                const val = answers[q.id] as string[];
                if (!val || val.length === 0) return `Please answer: "${q.question}"`;
            } else if (q.type === "text") {
                const val = answers[q.id] as string;
                if (!val?.trim()) return `Please answer: "${q.question}"`;
            } else if (q.type === "rating") {
                if (rating === null) return `Please provide a rating for: "${q.question}"`;
            } else if (q.type === "file_upload") {
                if (!files[q.id] || files[q.id].length === 0)
                    return `Please upload a file for: "${q.question}"`;
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        const validationError = validate();
        if (validationError) { 
            setError(validationError); 
            return; 
        }

        setSubmitting(true);
        setError(null);

        try {
            const answersArray = await Promise.all(
                questions.map(async (q) => {
                    if (q.type === "file_upload") {
                        const fileUrls = await uploadFiles(q.id);
                        return {
                            questionId: q.id,
                            question: q.question,
                            type: q.type,
                            answer: null,
                            fileUrls,
                        };
                    }
                    return {
                        questionId: q.id,
                        question: q.question,
                        type: q.type,
                        answer: answers[q.id] ?? null,
                    };
                })
            );

            const screenshotUrls = await uploadFiles("__screenshots__");

            // Get the proper user name
            const userName = getUserNameForFeedback();
            
            await axios.post("/api/feedback/submissions", {
                userId: user?.userId || localStorage.getItem("feedback_user_id") || "anonymous",
                userName: userName,
                userEmail: user?.email || "",
                answers: answersArray,
                textFeedback,
                rating,
                attachments: screenshotUrls,
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
            });

            setSubmitted(true);
        } catch (err) {
            console.error("Submit error:", err);
            setError("Failed to submit feedback. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const getRatingLabel = (r: number) => {
        switch (r) {
            case 1: return "Poor";
            case 2: return "Fair";
            case 3: return "Good";
            case 4: return "Very Good";
            case 5: return "Excellent";
            default: return "";
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <path d="M7 16l6 6 12-12" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-white">Thank you!</h2>
                <p className="text-gray-400 text-sm text-center">Your feedback has been submitted successfully.</p>
                <button
                    onClick={() => {
                        setSubmitted(false);
                        setAnswers({});
                        setFiles({});
                        setTextFeedback("");
                        setRating(null);
                        setHoveredStar(null);
                    }}
                    className="mt-2 px-6 py-2 bg-pink-600 hover:bg-pink-700 rounded-xl text-white text-sm font-semibold transition"
                >
                    Submit Another
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d0d10] text-white pb-16">
            <div className="max-w-2xl mx-auto px-4 py-8">

                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm">Back</span>
                </button>

                <div className="mb-8">
                    <h1 className="text-2xl font-bold">Share Your Feedback</h1>
                    <p className="text-gray-400 text-sm mt-1">Help us improve your experience</p>
                </div>

                {/* Show user info (same as FullPlaylist) */}
                <div className="mb-4 p-3 bg-[#1a1a1a] rounded-lg border border-white/5">
                    <p className="text-gray-500 text-xs">Submitting as:</p>
                    <p className="text-[#C9115F] text-sm font-medium">
                        {authLoading ? "Loading..." : displayName}
                        {isAuthenticated && user && (
                            <span className="ml-2 text-xs text-green-400">(Verified)</span>
                        )}
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-6">
                    {questions.map((q) => (
                        <div key={q.id} className="bg-[#141414] border border-white/5 rounded-2xl p-5">
                            <p className="text-white font-medium mb-1">
                                {q.question}
                                {q.required && <span className="text-pink-500 ml-1">*</span>}
                            </p>

                            {/* Multiple Choice */}
                            {q.type === "multiple_choice" && (
                                <div className="mt-3 space-y-2">
                                    {q.options?.map((opt) => {
                                        const selected = ((answers[q.id] as string[]) || []).includes(opt.value);
                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => toggleMultiChoice(q.id, opt.value)}
                                                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition ${
                                                    selected
                                                        ? "border-pink-500 bg-pink-500/10 text-pink-300"
                                                        : "border-white/10 bg-[#1e1e1e] text-gray-300 hover:border-white/20"
                                                }`}
                                            >
                                                <span className={`inline-block w-4 h-4 rounded border mr-3 flex-shrink-0 transition ${selected ? "bg-pink-500 border-pink-500" : "border-gray-600"}`} />
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Text Area */}
                            {q.type === "text" && (
                                <textarea
                                    value={(answers[q.id] as string) || ""}
                                    onChange={(e) => setAnswer(q.id, e.target.value)}
                                    placeholder="Type your answer here..."
                                    rows={4}
                                    className="mt-3 w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-pink-500/50 resize-none transition"
                                />
                            )}

                            {/* Rating — 5 stars */}
                            {q.type === "rating" && (
                                <div className="mt-4">
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((n) => {
                                            const filled = hoveredStar !== null
                                                ? n <= hoveredStar
                                                : rating !== null && n <= rating;
                                            return (
                                                <button
                                                    key={n}
                                                    onClick={() => setRating(n)}
                                                    onMouseEnter={() => setHoveredStar(n)}
                                                    onMouseLeave={() => setHoveredStar(null)}
                                                    className="transition-transform hover:scale-110 active:scale-95 p-1"
                                                >
                                                    <svg
                                                        width="36"
                                                        height="36"
                                                        viewBox="0 0 24 24"
                                                        fill={filled ? "#f59e0b" : "none"}
                                                        stroke={filled ? "#f59e0b" : "#374151"}
                                                        strokeWidth="1.5"
                                                        className="transition-all duration-100"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                                        />
                                                    </svg>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Rating label */}
                                    <div className="mt-2 h-5">
                                        {(hoveredStar !== null || rating !== null) && (
                                            <p className="text-sm text-amber-400 font-medium">
                                                {getRatingLabel(hoveredStar ?? rating ?? 0)}
                                            </p>
                                        )}
                                        {hoveredStar === null && rating === null && (
                                            <p className="text-xs text-gray-600">Tap a star to rate</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* File Upload */}
                            {q.type === "file_upload" && (
                                <div className="mt-3">
                                    <input
                                        type="file"
                                        multiple
                                        ref={(el) => { fileRefs.current[q.id] = el; }}
                                        onChange={(e) => handleFileChange(q.id, e)}
                                        className="hidden"
                                        accept="image/*,video/*,.pdf,.doc,.docx"
                                    />
                                    <button
                                        onClick={() => fileRefs.current[q.id]?.click()}
                                        className="w-full py-8 border-2 border-dashed border-white/10 rounded-xl text-gray-400 text-sm hover:border-pink-500/40 hover:text-gray-300 transition flex flex-col items-center gap-2"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Click to upload files
                                    </button>
                                    {files[q.id] && files[q.id].length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {files[q.id].map((f, i) => (
                                                <div key={i} className="flex items-center gap-2 text-xs text-gray-400 bg-[#1e1e1e] px-3 py-2 rounded-lg">
                                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                        <rect x="1" y="0.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                                                    </svg>
                                                    {f.name}
                                                    <span className="text-gray-600">({(f.size / 1024).toFixed(1)}KB)</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* General text feedback */}
                    <div className="bg-[#141414] border border-white/5 rounded-2xl p-5">
                        <p className="text-white font-medium mb-3">Any additional comments?</p>
                        <textarea
                            value={textFeedback}
                            onChange={(e) => setTextFeedback(e.target.value)}
                            placeholder="Share any other thoughts..."
                            rows={4}
                            className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-pink-500/50 resize-none transition"
                        />
                        <div className="flex justify-end mt-1">
                            <span className="text-gray-600 text-xs">{textFeedback.length}/1000</span>
                        </div>
                    </div>

                    {/* Screenshot Upload */}
                    <div className="bg-[#141414] border border-white/5 rounded-2xl p-5">
                        <p className="text-white font-medium mb-1">
                            Upload Screenshots
                            <span className="text-gray-500 text-xs font-normal ml-2">(optional)</span>
                        </p>
                        <p className="text-gray-500 text-xs mb-3">
                            Attach any screenshots or images that help describe your feedback
                        </p>

                        <input
                            type="file"
                            multiple
                            ref={(el) => { fileRefs.current["__screenshots__"] = el; }}
                            onChange={(e) => handleFileChange("__screenshots__", e)}
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx"
                        />

                        <button
                            onClick={() => fileRefs.current["__screenshots__"]?.click()}
                            className="w-full py-6 border-2 border-dashed border-white/10 rounded-xl text-gray-400 text-sm hover:border-pink-500/40 hover:text-gray-300 transition flex flex-col items-center gap-2"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Click to upload files</span>
                            <span className="text-xs text-gray-600">PNG, JPG, PDF up to 10MB each</span>
                        </button>

                        {files["__screenshots__"] && files["__screenshots__"].length > 0 && (
                            <div className="mt-3 space-y-2">
                                {files["__screenshots__"].map((f, i) => (
                                    <div key={i} className="flex items-center justify-between bg-[#1e1e1e] px-3 py-2 rounded-lg">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {f.type.startsWith("image/") ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={URL.createObjectURL(f)}
                                                    alt={f.name}
                                                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center flex-shrink-0">
                                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                        <rect x="1.5" y="0.5" width="11" height="13" rx="1.5" stroke="#6b7280" strokeWidth="1.2" />
                                                        <path d="M4 4h6M4 7h6M4 10h4" stroke="#6b7280" strokeWidth="1.2" strokeLinecap="round" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-xs text-gray-300 truncate">{f.name}</p>
                                                <p className="text-xs text-gray-600">{(f.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setFiles((prev) => ({
                                                    ...prev,
                                                    "__screenshots__": prev["__screenshots__"].filter((_, fi) => fi !== i),
                                                }));
                                            }}
                                            className="text-gray-600 hover:text-red-400 transition text-lg leading-none ml-2 flex-shrink-0"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full mt-6 py-4 rounded-2xl bg-gradient-to-r from-pink-600 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                    {submitting ? "Submitting..." : "Submit Feedback"}
                </button>

                {!isAuthenticated && !authLoading && (
                    <p className="text-gray-600 text-xs text-center mt-4">
                        Not signed in? Your feedback will appear as {displayName}
                    </p>
                )}
            </div>
        </div>
    );
}