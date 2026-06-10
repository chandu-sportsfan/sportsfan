// app/admin/roar-management/posts-list/page.tsx
"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Trash2, MessageSquare, X } from "lucide-react";

export default function RoarPostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Comments modal state
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/roar/posts?limit=100");
      setPosts(res.data.posts || []);
    } catch (error) {
      console.error("Failed to fetch posts", error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleDeletePost = async (id: string) => {
    const confirmDelete = window.confirm("Delete this post and all its comments?");
    if (!confirmDelete) return;

    setDeletingId(id);
    try {
      await axios.delete(`/api/roar/posts/${id}`);
      setPosts((prev) => prev.filter((p) => p.postId !== id));
      if (selectedPost && selectedPost.postId === id) {
        setSelectedPost(null);
      }
    } catch (error) {
      console.error("Delete failed", error);
      alert("Failed to delete post");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenComments = async (post: any) => {
    setSelectedPost(post);
    setComments([]);
    setLoadingComments(true);
    try {
      const res = await axios.get(`/api/roar/posts/${post.postId}/comments`);
      setComments(res.data.comments || []);
    } catch (error) {
      console.error("Failed to fetch comments", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedPost) return;
    const confirmDelete = window.confirm("Delete this comment?");
    if (!confirmDelete) return;

    setDeletingCommentId(commentId);
    try {
      await axios.delete(`/api/roar/posts/${selectedPost.postId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.commentId !== commentId));
      
      // Update replies count in main list
      setPosts((prev) =>
        prev.map((p) =>
          p.postId === selectedPost.postId
            ? { ...p, replyCount: Math.max((p.replyCount || 0) - 1, 0) }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to delete comment", error);
      alert("Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">RoAR Community Posts & Comments</h1>
        <p className="text-sm text-gray-400">Moderate predictions, hot takes, and reply comments</p>
      </div>

      {/* Table Card */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[#1c2330] border-b border-[#21262d]">
              <tr>
                {["#", "Author", "Type", "Sport", "Take/Content", "Replies", "Actions"].map((head) => (
                  <th
                    key={head}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500"></div>
                      Loading posts...
                    </div>
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    No community posts found.
                  </td>
                </tr>
              ) : (
                posts.map((post, index) => (
                  <tr
                    key={post.postId}
                    className="border-b border-[#21262d] hover:bg-[#0d1117] transition"
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">
                      {post.authorUsername}
                      <span className="block text-xs font-normal text-gray-500">
                        {post.authorBadge}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          post.type === "hot_take"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : post.type === "prediction"
                            ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                            : post.type === "debate"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                            : post.type === "memory"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-green-500/10 text-green-400 border border-green-500/20"
                        }`}
                      >
                        {post.type === "hot_take"
                          ? "Hot Take"
                          : post.type === "prediction"
                          ? "Prediction"
                          : post.type === "debate"
                          ? "Debate"
                          : post.type === "memory"
                          ? "Memory"
                          : "Post"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 capitalize">
                      {post.sport}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-100 max-w-[320px] truncate" title={post.text}>
                      {post.text}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      💬 {post.replyCount || 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* View Comments button */}
                        <button
                          onClick={() => handleOpenComments(post)}
                          className="p-2 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition"
                          title="View Comments"
                        >
                          <MessageSquare size={16} />
                        </button>
                        {/* Delete Post button */}
                        <button
                          onClick={() => handleDeletePost(post.postId)}
                          disabled={deletingId === post.postId}
                          className="p-2 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                          title="Delete Post"
                        >
                          {deletingId === post.postId ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comments Drawer / Modal */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#161b22] border border-[#21262d] rounded-lg w-full max-w-[800px] overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-[#21262d] flex justify-between items-center bg-[#1c2330]">
              <div>
                <h2 className="text-lg font-bold text-white">Thread Moderation</h2>
                <p className="text-xs text-gray-400">Post by @{selectedPost.authorUsername}</p>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Post Detail Preview */}
            <div className="p-4 bg-[#0d1117] border-b border-[#21262d] text-sm text-gray-200">
              <p className="font-semibold mb-2">Original Post Content:</p>
              <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 italic">
                "{selectedPost.text}"
              </div>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Comments ({comments.length})
              </h3>
              
              {loadingComments ? (
                <div className="text-center py-6 text-gray-400">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pink-500 mx-auto mb-2"></div>
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center py-6 text-gray-500 text-sm">
                  No comments under this post.
                </p>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.commentId}
                      className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 flex justify-between items-start gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">
                            @{comment.authorUsername}
                          </span>
                          <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                            {comment.authorBadge}
                          </span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {new Date(comment.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300">{comment.text}</p>
                        <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
                          ❤️ {comment.heartCount || 0}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteComment(comment.commentId)}
                        disabled={deletingCommentId === comment.commentId}
                        className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                        title="Delete Comment"
                      >
                        {deletingCommentId === comment.commentId ? (
                          <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#21262d] bg-[#1c2330] flex justify-end">
              <button
                onClick={() => setSelectedPost(null)}
                className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] rounded-lg text-sm text-white font-semibold transition"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
