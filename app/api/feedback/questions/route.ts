import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type QuestionType = 'rating' | 'radio' | 'checkbox' | 'text';

interface FeedbackQuestion {
    id: string;
    question: string;
    type: QuestionType;
    options?: string[];
    required: boolean;
    order: number;
    isActive: boolean;
    createdAt: number;
    updatedAt: number;
}

// GET - Fetch all questions (with optional filtering)
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const isActive = searchParams.get("isActive");
        const limit = parseInt(searchParams.get("limit") || "50");

        let query = db.collection("feedbackQuestions")
            .orderBy("order", "asc")
            .limit(limit);

        if (isActive === "true") {
            query = query.where("isActive", "==", true);
        }

        const snapshot = await query.get();
        
        const questions = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({
            success: true,
            questions,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error fetching feedback questions:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// POST - Create a new question
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            question,
            type,
            options,
            required,
            order,
            isActive,
        } = body;

        // Validation
        const validTypes: QuestionType[] = ['rating', 'radio', 'checkbox', 'text'];
        
        if (!question || !type) {
            return NextResponse.json(
                { error: "question and type are required" },
                { status: 400 }
            );
        }

        if (!validTypes.includes(type)) {
            return NextResponse.json(
                { error: "Invalid type. Must be rating, radio, checkbox, or text" },
                { status: 400 }
            );
        }

        // For rating type, provide default options if not provided
        let finalOptions = options;
        if (type === 'rating' && (!options || options.length === 0)) {
            finalOptions = ['1', '2', '3', '4', '5'];
        }

        // Generate unique ID
        const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newQuestion: FeedbackQuestion = {
            id: questionId,
            question,
            type,
            options: finalOptions || [],
            required: required !== undefined ? required : true,
            order: order || 0,
            isActive: isActive !== undefined ? isActive : true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await db.collection("feedbackQuestions").doc(questionId).set(newQuestion);

        return NextResponse.json(
            {
                success: true,
                message: "Question created successfully",
                question: newQuestion,
            },
            { status: 201 }
        );

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error creating feedback question:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// PUT - Update a question
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, question, type, options, required, order, isActive } = body;

        if (!id) {
            return NextResponse.json(
                { error: "Question ID is required" },
                { status: 400 }
            );
        }

        // Check if question exists
        const questionRef = db.collection("feedbackQuestions").doc(id);
        const questionDoc = await questionRef.get();

        if (!questionDoc.exists) {
            return NextResponse.json(
                { error: "Question not found" },
                { status: 404 }
            );
        }

        const updateData: Partial<FeedbackQuestion> = {
            updatedAt: Date.now(),
        };

        if (question !== undefined) updateData.question = question;
        if (type !== undefined) updateData.type = type;
        if (options !== undefined) updateData.options = options;
        if (required !== undefined) updateData.required = required;
        if (order !== undefined) updateData.order = order;
        if (isActive !== undefined) updateData.isActive = isActive;

        await questionRef.update(updateData);

        const updatedDoc = await questionRef.get();
        const updatedQuestion = { id: updatedDoc.id, ...updatedDoc.data() };

        return NextResponse.json({
            success: true,
            message: "Question updated successfully",
            question: updatedQuestion,
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error updating feedback question:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// DELETE - Delete a question
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Question ID is required" },
                { status: 400 }
            );
        }

        const questionRef = db.collection("feedbackQuestions").doc(id);
        const questionDoc = await questionRef.get();

        if (!questionDoc.exists) {
            return NextResponse.json(
                { error: "Question not found" },
                { status: 404 }
            );
        }

        await questionRef.delete();

        return NextResponse.json({
            success: true,
            message: "Question deleted successfully",
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unexpected error";
        console.error("Error deleting feedback question:", error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}