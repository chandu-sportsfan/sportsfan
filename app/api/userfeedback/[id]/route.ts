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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, message: "ID required" }, { status: 400 });
    }

    const doc = await db.collection("userFeedback").doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, message: "Feedback not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback: { id: doc.id, ...doc.data() },
    });
  } catch (error) {
    console.error("Fetch user feedback by id error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Fetch failed: " + (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, message: "ID required" }, { status: 400 });
    }

    const docRef = db.collection("userFeedback").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json(
        { success: false, message: "Feedback not found" },
        { status: 404 }
      );
    }

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

    const updateData = {
      title,
      description,
      questions,
      updatedAt: Date.now(),
    };

    await docRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: "Feedback updated successfully",
      feedback: { id, ...(existing.data() || {}), ...updateData },
    });
  } catch (error) {
    console.error("Update user feedback error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Update failed: " + (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, message: "ID required" }, { status: 400 });
    }

    const docRef = db.collection("userFeedback").doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return NextResponse.json(
        { success: false, message: "Feedback not found" },
        { status: 404 }
      );
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: "Feedback deleted successfully",
    });
  } catch (error) {
    console.error("Delete user feedback error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Delete failed: " + (error as Error).message,
      },
      { status: 500 }
    );
  }
}