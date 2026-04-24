import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { Query, DocumentData, CollectionReference } from "firebase-admin/firestore";

interface FeedbackAnswer {
    questionId: string;
    question: string;
    type: string;
    answer: string | string[] | number | null;
    fileUrls?: string[];
}

interface FeedbackSubmission {
    userId?: string;
    userName?: string;
    userEmail?: string;
    answers: FeedbackAnswer[];
    textFeedback?: string;
    rating?: number;
    attachments?: string[];
    status: "pending" | "reviewed" | "resolved";
    createdAt: number;
    reviewedAt?: number;
    reviewedBy?: string;
    notes?: string;
}

// GET — fetch submissions
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get("limit") || "20");
        const status = searchParams.get("status");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const lastDocId = searchParams.get("lastDocId");

        let query: Query<DocumentData> | CollectionReference<DocumentData> =
            db.collection("feedbackSubmissions").orderBy("createdAt", "desc").limit(limit);

        if (status && ["pending", "reviewed", "resolved"].includes(status)) {
            query = query.where("status", "==", status);
        }

        if (startDate && endDate) {
            query = query
                .where("createdAt", ">=", parseInt(startDate))
                .where("createdAt", "<=", parseInt(endDate));
        }

        if (lastDocId) {
            const lastDoc = await db.collection("feedbackSubmissions").doc(lastDocId).get();
            if (lastDoc.exists) query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        const submissions = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as FeedbackSubmission),
        }));

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];

        return NextResponse.json({
            success: true,
            submissions,
            pagination: {
                hasMore: submissions.length === limit,
                nextCursor: submissions.length === limit ? { lastDocId: lastDoc?.id } : null,
            },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// POST — submit feedback (called from main frontend via proxy)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, userName, userEmail, answers, textFeedback, rating, attachments } = body;

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json({ error: "Answers are required" }, { status: 400 });
        }

        const submission: FeedbackSubmission = {
            userId: userId || "anonymous",
            userName: userName || "Anonymous User",
            userEmail: userEmail || "",
            answers,
            textFeedback: textFeedback || "",
            rating: rating ?? null,
            attachments: attachments || [],
            status: "pending",
            createdAt: Date.now(),
        };

        const docRef = await db.collection("feedbackSubmissions").add(submission);

        return NextResponse.json(
            { success: true, message: "Feedback submitted successfully", submissionId: docRef.id },
            { status: 201 }
        );
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// PUT — update submission status
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, status, reviewedBy, notes } = body;

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const ref = db.collection("feedbackSubmissions").doc(id);
        if (!(await ref.get()).exists) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        await ref.update({
            status,
            reviewedAt: Date.now(),
            reviewedBy,
            notes,
        } as Partial<FeedbackSubmission>);

        const updated = await ref.get();
        return NextResponse.json({
            success: true,
            submission: { id: updated.id, ...(updated.data() as FeedbackSubmission) },
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// DELETE — delete submission
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        const ref = db.collection("feedbackSubmissions").doc(id);
        if (!(await ref.get()).exists) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        await ref.delete();
        return NextResponse.json({ success: true, message: "Deleted successfully" });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}