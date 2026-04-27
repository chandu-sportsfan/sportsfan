import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

type UserFeedbackPayload = {
  title?: unknown;
  description?: unknown;
  questions?: unknown;
};

function normalizeQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function buildFeedbackPayload(body: UserFeedbackPayload) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const questions = normalizeQuestions(body.questions);

  return { title, description, questions };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UserFeedbackPayload;
    const { title, description, questions } = buildFeedbackPayload(body);

    if (!title || !description) {
      return NextResponse.json(
        { success: false, message: "title and description are required" },
        { status: 400 }
      );
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one question is required" },
        { status: 400 }
      );
    }

    const payload = {
      title,
      description,
      questions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const docRef = await db.collection("userFeedback").add(payload);

    return NextResponse.json(
      {
        success: true,
        message: "Feedback created successfully",
        feedback: { id: docRef.id, ...payload },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create user feedback error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Create failed: " + (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));

    const snapshot = await db
      .collection("userFeedback")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const feedback = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      feedback,
      count: feedback.length,
    });
  } catch (error) {
    console.error("Fetch user feedback error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Fetch failed: " + (error as Error).message,
      },
      { status: 500 }
    );
  }
}