// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/lib/firebaseAdmin";

// // ─── Types ────────────────────────────────────────────────────────────────────

// interface QuizQuestion {
//   questionNumber: number;
//   correctAnswer: string;
//   points: number;
// }

// interface QuizDoc {
//   questions: QuizQuestion[];
//   totalQuestions: number;
// }

// // ─── GET /api/fanbattle/response ──────────────────────────────────────────────
// // Query params:
// //   sessionId           → return single session doc
// //   userId + quizId     → return all responses for that user/quiz combo

// export async function GET(req: NextRequest) {
//   try {
//     const { searchParams } = new URL(req.url);
//     const sessionId = searchParams.get("sessionId");
//     const userId = searchParams.get("userId");
//     const quizId = searchParams.get("quizId");

//     // ── Single session lookup ────────────────────────────────────────────────
//     if (sessionId) {
//       const doc = await db.collection("fanBattleSessions").doc(sessionId).get();

//       if (!doc.exists) {
//         return NextResponse.json(
//           { error: `Session "${sessionId}" not found` },
//           { status: 404 }
//         );
//       }

//       return NextResponse.json(
//         { success: true, data: { id: doc.id, ...doc.data() } },
//         { status: 200 }
//       );
//     }

//     // ── Filter responses by userId / quizId ──────────────────────────────────
//     let query = db
//       .collection("fanBattleResponses")
//       .orderBy("answeredAt", "desc") as FirebaseFirestore.Query;

//     if (userId) query = query.where("userId", "==", userId);
//     if (quizId) query = query.where("quizId", "==", quizId);

//     const snapshot = await query.get();
//     const responses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

//     return NextResponse.json(
//       { success: true, count: responses.length, data: responses },
//       { status: 200 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("Error fetching responses:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }

// // ─── POST /api/fanbattle/response ────────────────────────────────────────────
// // User submits a single answer. Server fetches the quiz from Firestore to score it.
// //
// // Body:
// // {
// //   quizId, questionNumber, selectedAnswer,
// //   userId, userName, userEmail, userAvatar,
// //   sessionId?   ← pass on Q2+ to continue existing session
// // }

// export async function POST(req: NextRequest) {
//   try {
//     const body = await req.json();

//     // ── Validate required fields ─────────────────────────────────────────────
//     const required = [
//       "quizId",
//       "questionNumber",
//       "selectedAnswer",
//       "userId",
//       "userName",
//       "userEmail",
//     ];
//     const missing = required.filter((f) => !body[f]);
//     if (missing.length) {
//       return NextResponse.json(
//         { error: `Missing required fields: ${missing.join(", ")}` },
//         { status: 400 }
//       );
//     }

//     // ── Fetch quiz from Firestore to score the answer ────────────────────────
//     const quizDoc = await db.collection("fanBattleQuizzes").doc(body.quizId).get();

//     if (!quizDoc.exists) {
//       return NextResponse.json(
//         { error: `Quiz "${body.quizId}" not found` },
//         { status: 404 }
//       );
//     }

//     const quiz = quizDoc.data() as QuizDoc;

//     const quizQuestion = quiz.questions.find(
//       (q) => q.questionNumber === Number(body.questionNumber)
//     );

//     if (!quizQuestion) {
//       return NextResponse.json(
//         { error: `Question ${body.questionNumber} not found in quiz "${body.quizId}"` },
//         { status: 404 }
//       );
//     }

//     // ── Score ────────────────────────────────────────────────────────────────
//     const isCorrect =
//       body.selectedAnswer.trim() === quizQuestion.correctAnswer.trim();
//     const pointsEarned = isCorrect ? quizQuestion.points : 0;
//     const now = Date.now();

//     // ── Save individual response ─────────────────────────────────────────────
//     const responsePayload = {
//       quizId: body.quizId,
//       questionNumber: Number(body.questionNumber),
//       userId: body.userId,
//       userName: body.userName,
//       userEmail: body.userEmail,
//       userAvatar: body?.userAvatar,
//       selectedAnswer: body.selectedAnswer,
//       isCorrect,
//       pointsEarned,
//       answeredAt: now,
//     };

//     const responseRef = await db
//       .collection("fanBattleResponses")
//       .add(responsePayload);

//     // ── Create or update session ─────────────────────────────────────────────
//     const sessionsRef = db.collection("fanBattleSessions");
//     let sessionId: string;
//     let sessionData: FirebaseFirestore.DocumentData;

//     if (body.sessionId) {
//       // Continue existing session
//       const sessionDoc = await sessionsRef.doc(body.sessionId).get();

//       if (!sessionDoc.exists) {
//         return NextResponse.json(
//           { error: `Session "${body.sessionId}" not found` },
//           { status: 404 }
//         );
//       }

//       const existing = sessionDoc.data()!;

//       // Guard: don't allow re-answering the same question
//       const alreadyAnswered = (existing.responseIds as string[])?.some(
//         async (id) => {
//           const r = await db.collection("fanBattleResponses").doc(id).get();
//           return r.data()?.questionNumber === Number(body.questionNumber);
//         }
//       );

//       if (alreadyAnswered) {
//         return NextResponse.json(
//           {
//             error: `Question ${body.questionNumber} already answered in this session`,
//           },
//           { status: 409 }
//         );
//       }

//       const newAnsweredCount = (existing.answeredCount as number) + 1;
//       const isComplete = newAnsweredCount >= quiz.totalQuestions;

//       const updates = {
//         totalPointsEarned: (existing.totalPointsEarned as number) + pointsEarned,
//         correctCount: (existing.correctCount as number) + (isCorrect ? 1 : 0),
//         incorrectCount: (existing.incorrectCount as number) + (isCorrect ? 0 : 1),
//         answeredCount: newAnsweredCount,
//         responseIds: [
//           ...((existing.responseIds as string[]) || []),
//           responseRef.id,
//         ],
//         status: isComplete ? "completed" : "in_progress",
//         completedAt: isComplete ? now : null,
//         updatedAt: now,
//       };

//       await sessionsRef.doc(body.sessionId).update(updates);

//       sessionId = body.sessionId;
//       sessionData = { ...existing, ...updates };
//     } else {
//       // Create new session
//       const isComplete = quiz.totalQuestions === 1;

//       const newSession = {
//         quizId: body.quizId,
//         userId: body.userId,
//         userName: body.userName,
//         userEmail: body.userEmail,
//         userAvatar: body?.userAvatar,
//         totalPointsEarned: pointsEarned,
//         correctCount: isCorrect ? 1 : 0,
//         incorrectCount: isCorrect ? 0 : 1,
//         answeredCount: 1,
//         totalQuestions: quiz.totalQuestions,
//         responseIds: [responseRef.id],
//         status: isComplete ? "completed" : "in_progress",
//         startedAt: now,
//         completedAt: isComplete ? now : null,
//         updatedAt: now,
//       };

//       const sessionRef = await sessionsRef.add(newSession);
//       sessionId = sessionRef.id;
//       sessionData = newSession;
//     }

//     return NextResponse.json(
//       {
//         success: true,
//         data: {
//           response: { id: responseRef.id, ...responsePayload },
//           session: {
//             id: sessionId,
//             status: sessionData.status,
//             totalPointsEarned: sessionData.totalPointsEarned,
//             correctCount: sessionData.correctCount,
//             incorrectCount: sessionData.incorrectCount,
//             answeredCount: sessionData.answeredCount,
//             totalQuestions: quiz.totalQuestions,
//             completedAt: sessionData.completedAt,
//           },
//         },
//       },
//       { status: 201 }
//     );
//   } catch (error: unknown) {
//     const msg = error instanceof Error ? error.message : "Unexpected error";
//     console.error("Error submitting response:", error);
//     return NextResponse.json({ error: msg }, { status: 500 });
//   }
// }




import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  questionNumber: number;
  correctAnswer: string;
  points: number;
}

interface QuizDoc {
  questions: QuizQuestion[];
  totalQuestions: number;
}

// ─── GET /api/fanbattle/response ──────────────────────────────────────────────
// Query params:
//   sessionId           → return single session doc
//   userId + quizId     → return all responses for that user/quiz combo

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");
    const quizId = searchParams.get("quizId");

    // ── Single session lookup ────────────────────────────────────────────────
    if (sessionId) {
      const doc = await db.collection("fanBattleSessions").doc(sessionId).get();

      if (!doc.exists) {
        return NextResponse.json(
          { error: `Session "${sessionId}" not found` },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { success: true, data: { id: doc.id, ...doc.data() } },
        { status: 200 }
      );
    }

    // ── Filter responses by userId / quizId ──────────────────────────────────
    let query = db
      .collection("fanBattleResponses")
      .orderBy("answeredAt", "desc") as FirebaseFirestore.Query;

    if (userId) query = query.where("userId", "==", userId);
    if (quizId) query = query.where("quizId", "==", quizId);

    const snapshot = await query.get();
    const responses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json(
      { success: true, count: responses.length, data: responses },
      { status: 200 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error fetching responses:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── POST /api/fanbattle/response ────────────────────────────────────────────
// User submits a single answer. Server fetches the quiz from Firestore to score it.
//
// Body:
// {
//   quizId, questionNumber, selectedAnswer,
//   userId, userName, userEmail, userAvatar,
//   sessionId?   ← pass on Q2+ to continue existing session
// }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Validate required fields ─────────────────────────────────────────────
    const required = [
      "quizId",
      "questionNumber",
      "selectedAnswer",
      "userId",
      "userName",
      "userEmail",
    ];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // ── Fetch quiz from Firestore to score the answer ────────────────────────
    const quizDoc = await db.collection("fanBattleQuizzes").doc(body.quizId).get();

    if (!quizDoc.exists) {
      return NextResponse.json(
        { error: `Quiz "${body.quizId}" not found` },
        { status: 404 }
      );
    }

    const quiz = quizDoc.data() as QuizDoc;

    const quizQuestion = quiz.questions.find(
      (q) => q.questionNumber === Number(body.questionNumber)
    );

    if (!quizQuestion) {
      return NextResponse.json(
        { error: `Question ${body.questionNumber} not found in quiz "${body.quizId}"` },
        { status: 404 }
      );
    }

    // ── Score ────────────────────────────────────────────────────────────────
    const isCorrect =
      body.selectedAnswer.trim() === quizQuestion.correctAnswer.trim();
    const pointsEarned = isCorrect ? quizQuestion.points : 0;
    const now = Date.now();

    // ── Save individual response ─────────────────────────────────────────────
    const responsePayload = {
      quizId: body.quizId,
      questionNumber: Number(body.questionNumber),
      userId: body.userId,
      userName: body.userName,
      userEmail: body.userEmail,
      userAvatar: body?.userAvatar,
      selectedAnswer: body.selectedAnswer,
      isCorrect,
      pointsEarned,
      answeredAt: now,
      correctAnswer: quizQuestion.correctAnswer, // Store correct answer for restoration
    };

    const responseRef = await db
      .collection("fanBattleResponses")
      .add(responsePayload);

    // ── Create or update session ─────────────────────────────────────────────
    const sessionsRef = db.collection("fanBattleSessions");
    let sessionId: string;
    let sessionData: FirebaseFirestore.DocumentData;

    if (body.sessionId) {
      // Continue existing session
      const sessionDoc = await sessionsRef.doc(body.sessionId).get();

      if (!sessionDoc.exists) {
        return NextResponse.json(
          { error: `Session "${body.sessionId}" not found` },
          { status: 404 }
        );
      }

      const existing = sessionDoc.data()!;

      // ── FIX: Properly check if question already answered ───────────────────
      // Get all response IDs from the session and check each one
      const responseIds = (existing.responseIds as string[]) || [];
      let alreadyAnswered = false;

      for (const respId of responseIds) {
        const respDoc = await db.collection("fanBattleResponses").doc(respId).get();
        const respData = respDoc.data();
        if (respData?.questionNumber === Number(body.questionNumber)) {
          alreadyAnswered = true;
          break;
        }
      }

      if (alreadyAnswered) {
        return NextResponse.json(
          {
            error: `Question ${body.questionNumber} already answered in this session`,
            alreadyAnswered: true,
          },
          { status: 409 }
        );
      }

      const newAnsweredCount = (existing.answeredCount as number) + 1;
      const isComplete = newAnsweredCount >= quiz.totalQuestions;

      const updates = {
        totalPointsEarned: (existing.totalPointsEarned as number) + pointsEarned,
        correctCount: (existing.correctCount as number) + (isCorrect ? 1 : 0),
        incorrectCount: (existing.incorrectCount as number) + (isCorrect ? 0 : 1),
        answeredCount: newAnsweredCount,
        responseIds: [...responseIds, responseRef.id],
        status: isComplete ? "completed" : "in_progress",
        completedAt: isComplete ? now : null,
        updatedAt: now,
      };

      await sessionsRef.doc(body.sessionId).update(updates);

      sessionId = body.sessionId;
      sessionData = { ...existing, ...updates };
    } else {
      // Create new session
      const isComplete = quiz.totalQuestions === 1;

      const newSession = {
        quizId: body.quizId,
        userId: body.userId,
        userName: body.userName,
        userEmail: body.userEmail,
        userAvatar: body?.userAvatar,
        totalPointsEarned: pointsEarned,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        answeredCount: 1,
        totalQuestions: quiz.totalQuestions,
        responseIds: [responseRef.id],
        status: isComplete ? "completed" : "in_progress",
        startedAt: now,
        completedAt: isComplete ? now : null,
        updatedAt: now,
      };

      const sessionRef = await sessionsRef.add(newSession);
      sessionId = sessionRef.id;
      sessionData = newSession;
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          response: { id: responseRef.id, ...responsePayload },
          session: {
            id: sessionId,
            status: sessionData.status,
            totalPointsEarned: sessionData.totalPointsEarned,
            correctCount: sessionData.correctCount,
            incorrectCount: sessionData.incorrectCount,
            answeredCount: sessionData.answeredCount,
            totalQuestions: quiz.totalQuestions,
            completedAt: sessionData.completedAt,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unexpected error";
    console.error("Error submitting response:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}