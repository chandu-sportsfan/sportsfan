// app/api/ask-ai/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    
    // Get user ID from the body (sent by frontend)
    const userId = body.userId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - User ID missing' }, { status: 401 });
    }

    const query = body.query?.trim();
    const sessionId = body.sessionId || crypto.randomUUID();
    const history = Array.isArray(body.history) ? body.history : [];
    const userEmail = body.userEmail || '';
    const userName = body.userName || '';

    if (!query) {
      return NextResponse.json({ error: 'Empty query' }, { status: 400 });
    }

    // Call Python AI service
    const PYTHON_AI_URL = process.env.PYTHON_AI_URL;
    if (!PYTHON_AI_URL) {
      console.error("[ask-ai] PYTHON_AI_URL not configured");
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    let answer = '';
    let sources: string[] = [];
    let metadata: Record<string, unknown> = {};

    try {
      const aiRes = await fetch(`${PYTHON_AI_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          conversation_history: history,
          user_id: userId,
          session_id: sessionId,
        }),
      });

      if (!aiRes.ok) {
        throw new Error(`Python service returned ${aiRes.status}`);
      }

      const data = await aiRes.json();
      answer = data.answer ?? '';
      sources = data.sources ?? [];
      metadata = data.metadata ?? {};

    } catch (err) {
      console.error('[ask-ai] Python call failed:', err);
      return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
    }

    // Save to Firestore (optional - non-blocking)
    try {
      const sessionRef = db
        .collection('askaiConversations')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);

      await sessionRef.set(
        { updatedAt: FieldValue.serverTimestamp(), userId, userEmail, userName },
        { merge: true }
      );

      const msgCol = sessionRef.collection('messages');

      await msgCol.add({
        role: 'user',
        content: query,
        timestamp: FieldValue.serverTimestamp(),
      });

      await msgCol.add({
        role: 'assistant',
        content: answer,
        sources,
        metadata,
        timestamp: FieldValue.serverTimestamp(),
      });

    } catch (err) {
      console.error('[ask-ai] Firestore write failed:', err);
      // Don't fail the request if Firestore write fails
    }

    return NextResponse.json({ answer, sources, sessionId });

  } catch (error) {
    console.error('[ask-ai] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}