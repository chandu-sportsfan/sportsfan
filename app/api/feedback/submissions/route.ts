import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

interface FeedbackAnswer {
    questionId: string;
    answer: string | string[] | number;
}

interface FeedbackSubmission {
    userId?: string;
    userName?: string;
    userEmail?: string;
    answers: FeedbackAnswer[];
    textFeedback?: string;
    attachments?: string[];
    pageUrl?: string;
    userAgent?: string;
    status: 'pending' | 'reviewed' | 'resolved';
    createdAt: number;
    reviewedAt?: number;
    reviewedBy?: string;
    notes?: string;
}

interface EnrichedSubmission extends FeedbackSubmission {
    id: string;
    enrichedAnswers: {
        questionId: string;
        answer: string | string[] | number;
        questionDetails: Record<string, unknown> | null;
    }[];
}

// GET - Fetch feedback submissions (admin only)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "20");
        const status = searchParams.get("status");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const lastDocId = searchParams.get("lastDocId");
        const lastDocCreatedAt = searchParams.get("lastDocCreatedAt");

        let query = db.collection("feedbackSubmissions")
            .orderBy("createdAt", "desc")
            .limit(limit);

        if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
            query = query.where("status", "==", status);
        }

        if (startDate && endDate) {
            const start = parseInt(startDate);
            const end = parseInt(endDate);
            query = query.where("createdAt", ">=", start)
                       .where("createdAt", "<=", end);
        }

        if (lastDocId && lastDocCreatedAt) {
            const lastDocRef = db.collection("feedbackSubmissions").doc(lastDocId);
            const lastDoc = await lastDocRef.get();
            if (lastDoc.exists) {
                query = query.startAfter(lastDoc);
            }
        }

        const snapshot = await query.get();

        // ← Cast doc.data() to FeedbackSubmission so TypeScript knows the shape
        const submissions: (FeedbackSubmission & { id: string })[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as FeedbackSubmission),
        }));

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];

        const questionsSnapshot = await db.collection("feedbackQuestions")
            .where("isActive", "==", true)
            .orderBy("order", "asc")
            .get();

        const questionsMap = new Map<string, Record<string, unknown>>();
        questionsSnapshot.docs.forEach((doc) => {
            questionsMap.set(doc.id, doc.data() as Record<string, unknown>);
        });

        // ← Now TypeScript knows submission.answers exists
        const enrichedSubmissions: EnrichedSubmission[] = submissions.map((submission) => ({
            ...submission,
            enrichedAnswers: submission.answers.map((answer: FeedbackAnswer) => ({
                ...answer,
                questionDetails: questionsMap.get(answer.questionId) ?? null,
            })),
        }));

        return NextResponse.json({
            success: true,
            submissions: enrichedSubmissions,
            pagination: {
                limit,
                hasMore: submissions.length === limit,
                nextCursor: submissions.length === limit
                    ? {
                        lastDocId: lastDoc?.id,
                        lastDocCreatedAt: (lastDoc?.data() as FeedbackSubmission)?.createdAt,
                    }
                    : null,
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error fetching feedback submissions:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// POST - Submit feedback (public)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            userId,
            userName,
            userEmail,
            answers,
            textFeedback,
            attachments,
            pageUrl,
            userAgent,
        } = body;

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json(
                { error: "Answers are required" },
                { status: 400 }
            );
        }

        const submission: FeedbackSubmission = {
            userId: userId || 'anonymous',
            userName: userName || 'Anonymous User',
            userEmail: userEmail || '',
            answers,
            textFeedback: textFeedback || '',
            attachments: attachments || [],
            pageUrl: pageUrl || '',
            userAgent: userAgent || '',
            status: 'pending',
            createdAt: Date.now(),
        };

        const docRef = await db.collection("feedbackSubmissions").add(submission);

        return NextResponse.json(
            {
                success: true,
                message: "Feedback submitted successfully",
                submissionId: docRef.id,
            },
            { status: 201 }
        );
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error submitting feedback:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// PUT - Update submission status (admin only)
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status, reviewedBy, notes } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Submission ID is required" },
                { status: 400 }
            );
        }

        const submissionRef = db.collection("feedbackSubmissions").doc(id);
        const submissionDoc = await submissionRef.get();

        if (!submissionDoc.exists) {
            return NextResponse.json(
                { error: "Submission not found" },
                { status: 404 }
            );
        }

        const updateData: Partial<FeedbackSubmission> = {
            status,
            reviewedAt: Date.now(),
            reviewedBy,
            notes,
        };

        await submissionRef.update(updateData);

        const updatedDoc = await submissionRef.get();
        const updatedSubmission = {
            id: updatedDoc.id,
            ...(updatedDoc.data() as FeedbackSubmission),
        };

        return NextResponse.json({
            success: true,
            message: "Submission updated successfully",
            submission: updatedSubmission,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error updating submission:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// DELETE - Delete submission (admin only)
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Submission ID is required" },
                { status: 400 }
            );
        }

        const submissionRef = db.collection("feedbackSubmissions").doc(id);
        const submissionDoc = await submissionRef.get();

        if (!submissionDoc.exists) {
            return NextResponse.json(
                { error: "Submission not found" },
                { status: 404 }
            );
        }

        await submissionRef.delete();

        return NextResponse.json({
            success: true,
            message: "Submission deleted successfully",
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error deleting submission:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}