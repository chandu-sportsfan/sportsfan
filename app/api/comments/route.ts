import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type CommentStatus = "pending" | "approved" | "rejected" | "spam";

interface Comment {
    contentId: string;
    contentType: string; // Dynamic - no validation, accepts any string
    userId: string;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    commentText: string;
    parentCommentId?: string;
    likes?: number;
    likedBy?: string[];
    status?: CommentStatus;
    timestamp?: number; // For video/audio: time in seconds when comment was made
    createdAt: number;
    updatedAt: number;
    metadata?: {
        contentTitle?: string;
        contentUrl?: string;
    };
}

// ─── GET: Fetch comments for a specific content or for admin ─────────────────
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const contentId = searchParams.get("contentId");
        const contentType = searchParams.get("contentType");
        const status = searchParams.get("status") as CommentStatus;
        const userId = searchParams.get("userId");
        const limit = parseInt(searchParams.get("limit") || "20");
        const lastDocId = searchParams.get("lastDocId");
        const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

        // Case 1: Admin fetching all comments (no contentId filter)
        if (!contentId && status) {
            let query = db.collection("comments").orderBy("createdAt", "desc");

            if (status) {
                query = query.where("status", "==", status);
            }

            if (contentType) {
                query = query.where("contentType", "==", contentType);
            }

            if (userId) {
                query = query.where("userId", "==", userId);
            }

            query = query.limit(limit);

            // Pagination
            if (lastDocId && lastDocCreatedAt) {
                const lastDocRef = db.collection("comments").doc(lastDocId);
                const lastDoc = await lastDocRef.get();
                if (lastDoc.exists) {
                    query = query.startAfter(lastDoc);
                }
            }

            const snapshot = await query.get();
            const comments = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            const lastDoc = snapshot.docs[snapshot.docs.length - 1];

            return NextResponse.json({
                success: true,
                comments,
                pagination: {
                    limit,
                    hasMore: comments.length === limit,
                    nextCursor: comments.length === limit
                        ? {
                            lastDocId: lastDoc?.id,
                            lastDocCreatedAt: lastDoc?.data()?.createdAt,
                        }
                        : null,
                },
            });
        }

        // Case 2: Fetch comments for specific content (public)
        if (!contentId) {
            return NextResponse.json(
                { error: "contentId is required" },
                { status: 400 }
            );
        }

        // Build query for public comments (only approved ones)
        let query = db.collection("comments")
            .where("contentId", "==", contentId)
            .where("status", "==", "approved")
            .orderBy("createdAt", "desc");

        if (contentType) {
            query = query.where("contentType", "==", contentType);
        }

        query = query.limit(limit);

        // Pagination
        if (lastDocId && lastDocCreatedAt) {
            const lastDocRef = db.collection("comments").doc(lastDocId);
            const lastDoc = await lastDocRef.get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const snapshot = await query.get();
        const comments = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        // Fetch replies for top-level comments
        const commentsWithReplies = await Promise.all(
            comments.map(async (comment) => {
                const repliesQuery = await db.collection("comments")
                    .where("parentCommentId", "==", comment.id)
                    .where("status", "==", "approved")
                    .orderBy("createdAt", "asc")
                    .limit(10)
                    .get();

                const replies = repliesQuery.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                return {
                    ...comment,
                    replies: replies,
                    replyCount: replies.length,
                };
            })
        );

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];

        return NextResponse.json({
            success: true,
            comments: commentsWithReplies,
            pagination: {
                limit,
                hasMore: comments.length === limit,
                nextCursor: comments.length === limit
                    ? {
                        lastDocId: lastDoc?.id,
                        lastDocCreatedAt: lastDoc?.data()?.createdAt,
                    }
                    : null,
            },
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error fetching comments:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST: Create a new comment ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const {
            contentId,
            contentType,
            commentText,
            userId,
            userName,
            userEmail,
            userAvatar,
            parentCommentId,
            timestamp,
            metadata,
        } = body;

        // Validation - only check required fields, NOT content type values
        if (!contentId || !contentType || !commentText || !userId || !userName) {
            return NextResponse.json(
                { error: "contentId, contentType, commentText, userId, and userName are required" },
                { status: 400 }
            );
        }

        // Optional: Check for spam (1 comment per minute)
        const recentCommentsQuery = await db.collection("comments")
            .where("userId", "==", userId)
            .where("contentId", "==", contentId)
            .where("createdAt", ">", Date.now() - 60000)
            .limit(1)
            .get();

        if (!recentCommentsQuery.empty) {
            return NextResponse.json(
                { error: "Please wait a minute before commenting again" },
                { status: 429 }
            );
        }

        const newComment: Comment = {
            contentId,
            contentType, // Dynamic - accepts any string
            userId,
            userName,
            userEmail: userEmail || "",
            userAvatar: userAvatar || "",
            commentText: commentText.trim(),
            parentCommentId: parentCommentId || null,
            likes: 0,
            likedBy: [],
            status: "pending", // All comments start as pending for moderation
            timestamp: timestamp || null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: metadata || {},
        };

        const docRef = await db.collection("comments").add(newComment);

        return NextResponse.json(
            {
                success: true,
                id: docRef.id,
                comment: { id: docRef.id, ...newComment },
            },
            { status: 201 }
        );

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error creating comment:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PUT: Update a comment (like/unlike, edit) ──────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { commentId, userId, action, commentText } = body;

        if (!commentId || !userId) {
            return NextResponse.json(
                { error: "commentId and userId are required" },
                { status: 400 }
            );
        }

        const commentRef = db.collection("comments").doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
            return NextResponse.json(
                { error: "Comment not found" },
                { status: 404 }
            );
        }

        // Handle like/unlike
        if (action === "like" || action === "unlike") {
            const commentData = commentDoc.data();
            const likedBy = commentData?.likedBy || [];
            const isLiked = likedBy.includes(userId);

            if (action === "like" && !isLiked) {
                await commentRef.update({
                    likes: (commentData?.likes || 0) + 1,
                    likedBy: [...likedBy, userId],
                    updatedAt: Date.now(),
                });
            } else if (action === "unlike" && isLiked) {
                await commentRef.update({
                    likes: (commentData?.likes || 0) - 1,
                    likedBy: likedBy.filter((id: string) => id !== userId),
                    updatedAt: Date.now(),
                });
            }

            const updatedDoc = await commentRef.get();
            return NextResponse.json({
                success: true,
                comment: { id: updatedDoc.id, ...updatedDoc.data() },
            });
        }

        // Handle edit comment
        if (commentText) {
            const commentData = commentDoc.data();
            if (commentData?.userId !== userId) {
                return NextResponse.json(
                    { error: "You can only edit your own comments" },
                    { status: 403 }
                );
            }

            await commentRef.update({
                commentText: commentText.trim(),
                updatedAt: Date.now(),
            });

            const updatedDoc = await commentRef.get();
            return NextResponse.json({
                success: true,
                comment: { id: updatedDoc.id, ...updatedDoc.data() },
            });
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        );

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error updating comment:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── DELETE: Delete a comment (admin only or owner) ──────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const commentId = searchParams.get("commentId");
        const userId = searchParams.get("userId");
        const isAdmin = searchParams.get("isAdmin") === "true";

        if (!commentId) {
            return NextResponse.json(
                { error: "commentId is required" },
                { status: 400 }
            );
        }

        const commentRef = db.collection("comments").doc(commentId);
        const commentDoc = await commentRef.get();

        if (!commentDoc.exists) {
            return NextResponse.json(
                { error: "Comment not found" },
                { status: 404 }
            );
        }

        const commentData = commentDoc.data();

        // Check permissions: admin OR comment owner
        if (!isAdmin && commentData?.userId !== userId) {
            return NextResponse.json(
                { error: "You don't have permission to delete this comment" },
                { status: 403 }
            );
        }

        // Soft delete for users, hard delete for admin
        if (!isAdmin) {
            await commentRef.update({
                status: "rejected",
                commentText: "[Comment deleted by user]",
                updatedAt: Date.now(),
            });
        } else {
            await commentRef.delete();
        }

        return NextResponse.json({
            success: true,
            message: "Comment deleted successfully",
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error deleting comment:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}