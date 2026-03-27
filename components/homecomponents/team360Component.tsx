"use client";

import axios from "axios";
import { useState, ChangeEvent, InputHTMLAttributes } from "react";

/* ---------------- TYPES ---------------- */

type FormState = {
    teamName: string;
    title: string;
    likes: string;
    comments: string;
    live: string;
    shares: string;
    hasVideo: boolean;
};

type CatLogo = {
    label: string;
    file: File | null;
};

type Category = {
    title: string;
    file: File | null;
};

type CategoryKey = "title" | "file";
type CatLogoKey = "label" | "file";

/* ---------------- COMPONENT ---------------- */

export default function CreateTeam360Post() {
    const [form, setForm] = useState<FormState>({
        teamName: "",
        title: "",
        likes: "",
        comments: "",
        live: "",
        shares: "",
        hasVideo: false,
    });

    const [image, setImage] = useState<File | null>(null);
    const [logo, setLogo] = useState<File | null>(null);

    const [categories, setCategories] = useState<Category[]>([]);
    const [catlogos, setCatlogos] = useState<CatLogo[]>([]);

    const [loading, setLoading] = useState(false);

    /* ---------------- INPUT ---------------- */
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    /* ---------------- CATEGORY ---------------- */
    const addCategory = () => {
        setCategories((prev) => [...prev, { title: "", file: null }]);
    };

    const updateCategory = (
        i: number,
        key: CategoryKey,
        value: string | File | null
    ) => {
        const updated = [...categories];
        updated[i][key] = value as never;
        setCategories(updated);
    };

    const removeCategory = (i: number) => {
        setCategories((prev) => prev.filter((_, idx) => idx !== i));
    };

    /* ---------------- CATLOGO ---------------- */
    const addCatLogo = () => {
        setCatlogos((prev) => [...prev, { label: "", file: null }]);
    };

    const updateCatLogo = (
        i: number,
        key: CatLogoKey,
        value: string | File | null
    ) => {
        const updated = [...catlogos];
        updated[i][key] = value as never;
        setCatlogos(updated);
    };

    const removeCatLogo = (i: number) => {
        setCatlogos((prev) => prev.filter((_, idx) => idx !== i));
    };

    /* ---------------- RESET ---------------- */
    const handleCancel = () => {
        setForm({
            teamName: "",
            title: "",
            likes: "",
            comments: "",
            live: "",
            shares: "",
            hasVideo: false,
        });
        setImage(null);
        setLogo(null);
        setCategories([]);
        setCatlogos([]);
    };

    /* ---------------- SUBMIT ---------------- */
    const handleSubmit = async () => {
        if (!form.teamName || !form.title || !image || !logo) {
            alert("Required fields missing");
            return;
        }

        setLoading(true);

        try {
            const payload = {
                ...form,
                image: "uploaded-image-url",
                logo: "uploaded-logo-url",

                category: categories.map((c) => ({
                    title: c.title,
                    image: "uploaded-category-url",
                })),

                catlogo: catlogos.map((c) => ({
                    label: c.label,
                    logo: "uploaded-catlogo-url",
                })),

                likes: Number(form.likes),
                comments: Number(form.comments),
                live: Number(form.live),
                shares: Number(form.shares),
            };

            try {
                const res = await axios.post("/api/team360", payload);

                const data: { success?: boolean } = res.data;

                if (data.success) {
                    alert("Post created ✅");
                    handleCancel();
                }
            } catch (error: unknown) {
                if (axios.isAxiosError(error)) {
                    alert(error.response?.data?.error || "API Error");
                } else if (error instanceof Error) {
                    alert(error.message);
                } else {
                    alert("Unexpected error");
                }
            }
        } catch {
            alert("Error creating post");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-[1440px] mx-auto p-6">
            <div className="mb-6">
                <h1 className="text-lg font-semibold text-white">
                    Create Team360 Post
                </h1>
            </div>

            <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 space-y-6">

                {/* Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Team Name" name="teamName" value={form.teamName} onChange={handleChange} />
                    <Input label="Title" name="title" value={form.title} onChange={handleChange} />
                    <Input label="Likes" name="likes" value={form.likes} onChange={handleChange} />
                    <Input label="Comments" name="comments" value={form.comments} onChange={handleChange} />
                    <Input label="Live" name="live" value={form.live} onChange={handleChange} />
                    <Input label="Shares" name="shares" value={form.shares} onChange={handleChange} />
                </div>

                {/* FILES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FileInput label="Main Image" onChange={setImage} />
                    <FileInput label="Logo" onChange={setLogo} />
                </div>

                {/* CATEGORY */}
                <div>
                    <h2 className="text-sm text-gray-300 mb-2">Categories</h2>

                    {categories.map((cat, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                            <input
                                placeholder="Title"
                                value={cat.title}
                                onChange={(e) =>
                                    updateCategory(i, "title", e.target.value)
                                }
                                className="flex-1 bg-[#0d1117] border border-gray-700 px-3 py-2 rounded text-sm text-white"
                            />
                            <input
                                type="file"
                                onChange={(e) =>
                                    updateCategory(i, "file", e.target.files?.[0] ?? null)
                                }
                                className="flex-1 bg-[#0d1117] border border-gray-700 px-3 py-2 rounded"
                            />
                            <button onClick={() => removeCategory(i)}>✕</button>
                        </div>
                    ))}

                    <button onClick={addCategory} className="text-blue-400 text-sm">
                        + Add Category
                    </button>
                </div>

                {/* CATLOGO */}
                <div>
                    <h2 className="text-sm text-gray-300 mb-2">Stats Icons</h2>

                    {catlogos.map((item, i) => (
                        <div key={i} className="flex gap-2 mb-2">
                            <input
                                placeholder="Label"
                                value={item.label}
                                onChange={(e) =>
                                    updateCatLogo(i, "label", e.target.value)
                                }
                                className="flex-1 bg-[#0d1117] border border-gray-700 px-3 py-2 rounded text-sm text-white"
                            />
                            <input
                                type="file"
                                onChange={(e) =>
                                    updateCatLogo(i, "file", e.target.files?.[0] ?? null)
                                }
                                className="flex-1 bg-[#0d1117] border border-gray-700 px-3 py-2 rounded"
                            />
                            <button onClick={() => removeCatLogo(i)}>✕</button>
                        </div>
                    ))}

                    <button onClick={addCatLogo} className="text-blue-400 text-sm">
                        + Add Stat
                    </button>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 bg-blue-600 py-3 rounded font-semibold"
                    >
                        {loading ? "Creating..." : "Create Post"}
                    </button>

                    <button
                        onClick={handleCancel}
                        className="flex-1 bg-gray-700 py-3 rounded font-semibold"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

/*  REUSABLE INPUTS  */

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
};

function Input({ label, ...props }: InputProps) {
    return (
        <div>
            <label className="text-xs text-gray-400">{label}</label>
            <input
                {...props}
                className="w-full bg-[#0d1117] border border-gray-700 px-3 py-2 rounded text-sm text-white"
            />
        </div>
    );
}

type FileInputProps = {
    label: string;
    onChange: (file: File | null) => void;
};

function FileInput({ label, onChange }: FileInputProps) {
    return (
        <div>
            <label className="text-xs text-gray-400">{label}</label>
            <input
                type="file"
                onChange={(e) => onChange(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-white"
            />
        </div>
    );
}