"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type BadgeType = "FEATURE" | "ANALYSIS" | "OPINION" | "NEWS";

type FormState = {
    badge: BadgeType;
    title: string;
    readTime: string;
    views: string;
};

export default function CricketArticleForm({
    articleIdToEdit,
}: {
    articleIdToEdit?: string;
}) {
    const [form, setForm] = useState<FormState>({
        badge: "NEWS",
        title: "",
        readTime: "5 min read",
        views: "0 views",
    });

    const [image, setImage] = useState<File | null>(null);
    const [existingImage, setExistingImage] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    /*  FETCH SINGLE ARTICLE  */
    useEffect(() => {
        if (!articleIdToEdit) return;

        const fetchArticle = async () => {
            try {
                const res = await axios.get(
                    `/api/cricket-articles/${articleIdToEdit}`
                );

                const article = res.data.article;

                setForm({
                    badge: article.badge || "NEWS",
                    title: article.title || "",
                    readTime: article.readTime || "5 min read",
                    views: article.views || "0 views",
                });

                setExistingImage(article.image || "");
            } catch (error) {
                console.error("Failed to fetch article", error);
            }
        };

        fetchArticle();
    }, [articleIdToEdit]);

    const handleCancel = () => {
        setForm({
            badge: "NEWS",
            title: "",
            readTime: "0 min read",
            views: "0 views",
        });

        setImage(null);
        setExistingImage("");
    };

    /*  INPUT CHANGE  */
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        setForm((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    /*  FILE UPLOAD  */
    const uploadFile = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "Images");

        const res = await axios.post("/api/upload", formData);
        return res.data.url;
    };

    /*  SUBMIT  */
    const handleSubmit = async () => {
        if (!form.title) {
            alert("Title is required");
            return;
        }

        setLoading(true);

        try {
            let imageUrl = existingImage;

            if (image) {
                imageUrl = await uploadFile(image);
            }

            const payload = {
                ...form,
                image: imageUrl,
            };

            let res;

            if (articleIdToEdit) {
                res = await axios.put(
                    `/api/cricket-articles/${articleIdToEdit}`,
                    payload
                );
            } else {
                res = await axios.post("/api/cricket-articles", payload);
            }

            if (res.data.success) {
                alert(
                    articleIdToEdit
                        ? "Article updated successfully"
                        : "Article created successfully"
                );
              router.push("/admin/cricketarticles-management/cricketarticles-list");  

                if (!articleIdToEdit) {
                    setForm({
                        badge: "NEWS",
                        title: "",
                        readTime: "5 min read",
                        views: "0 views",
                    });
                    setImage(null);
                    setExistingImage("");
                }
            }
        } catch (error) {
            console.error("Save failed", error);
            alert("Error saving article");
        } finally {
            setLoading(false);
        }
    };

    const preview = image
        ? URL.createObjectURL(image)
        : existingImage;

    return (
        <div className="max-w-[1440px] mx-auto p-6 text-white">
            <h1 className="text-xl font-bold mb-6">
                {articleIdToEdit ? "Edit Article" : "Create Cricket Article"}
            </h1>

            <div className="bg-[#161b22] rounded-lg p-6 space-y-6">
                {/* INPUTS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-400">Badge</label>
                        <select
                            name="badge"
                            value={form.badge}
                            onChange={handleChange}
                            className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-2"
                        >
                            <option value="FEATURE">FEATURE</option>
                            <option value="ANALYSIS">ANALYSIS</option>
                            <option value="OPINION">OPINION</option>
                            <option value="NEWS">NEWS</option>
                        </select>
                    </div>

                    <Input
                        label="Title"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                    />

                    <Input
                        label="Read Time"
                        name="readTime"
                        value={form.readTime}
                        onChange={handleChange}
                    />

                    <Input
                        label="Views"
                        name="views"
                        value={form.views}
                        onChange={handleChange}
                    />
                </div>

                {/* IMAGE */}
                <div>
                    <label className="text-xs text-gray-400">Article Image</label>
                    <input
                        type="file"
                        onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                        className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-2"
                    />

                    {preview && (
                        <img
                            src={preview}
                            alt="preview"
                            className="w-32 h-32 object-cover rounded mt-3 border"
                        />
                    )}
                </div>

                {/* ACTION */}
                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full bg-blue-600 py-3 rounded font-semibold"
                >
                    {loading
                        ? articleIdToEdit
                            ? "Updating..."
                            : "Creating..."
                        : articleIdToEdit
                            ? "Update Article"
                            : "Create Article"}
                </button>

                <button
                    onClick={handleCancel}
                    className="flex-1 bg-gray-700 py-3 rounded font-semibold"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

function Input({
    label,
    ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
    label: string;
}) {
    return (
        <div>
            <label className="text-xs text-gray-400">{label}</label>
            <input
                {...props}
                className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-white"
            />
        </div>
    );
}