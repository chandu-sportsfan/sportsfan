"use client";

import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

type Article = {
    id: string;
    badge: "FEATURE" | "ANALYSIS" | "OPINION" | "NEWS";
    title: string;
    readTime: string;
    views: string;
    image: string;
    createdAt: number;
    updatedAt: number;
};

export default function CricketArticleViewPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [article, setArticle] = useState<Article | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (!id) return;

        const fetchArticle = async () => {
            const res = await axios.get(`/api/cricket-articles/${id}`);
            setArticle(res.data.article);
        };

        fetchArticle();
    }, [id]);

    const handleEdit = () => {
        router.push(
            `/admin/cricket-articles-management/add-cricket-article?id=${id}`
        );
    };

    const handleDelete = async () => {
        const confirmDelete = window.confirm("Delete this article?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`/api/cricket-articles/${id}`);
            alert("Article deleted successfully");

            router.push(
                "/admin/cricket-articles-management/cricket-articles-list"
            );
        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete article");
        }
    };

    if (!article) {
        return <p className="text-white p-6">Loading...</p>;
    }

    return (
        <div className="max-w-[1200px] mx-auto p-6 text-white">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold">Article Details</h1>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleEdit}
                        className="p-2 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition"
                    >
                        <Pencil size={18} />
                    </button>

                    <button
                        onClick={handleDelete}
                        className="p-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* SIDE BY SIDE LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT: TEXT DATA */}
                <div className="bg-[#161b22] rounded-lg p-6 space-y-3">
                    <p><b>Badge:</b> {article.badge}</p>
                    <p><b>Title:</b> {article.title}</p>
                    <p><b>Read Time:</b> {article.readTime}</p>
                    <p><b>Views:</b> {article.views}</p>
                    {/* <p>
                        <b>Created At:</b>{" "}
                        {new Date(article.createdAt).toLocaleString()}
                    </p>
                    <p>
                        <b>Updated At:</b>{" "}
                        {new Date(article.updatedAt).toLocaleString()}
                    </p> */}
                </div>

                {/* RIGHT: IMAGE */}
                <div className="bg-[#161b22] rounded-lg p-6">
                    <h2 className="mb-4 font-semibold">Article Image</h2>
                    <img
                        src={article.image}
                        alt={article.title}
                        className="w-50 h-50 object-fit rounded border"
                    />
                </div>
            </div>
        </div>
    );

}