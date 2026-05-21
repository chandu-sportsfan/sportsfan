// // app/api/ask-ai/route.ts
// import { NextRequest, NextResponse } from 'next/server'
// import { db } from "@/lib/firebaseAdmin";
// import { FieldValue } from 'firebase-admin/firestore'

// export async function POST(req: NextRequest) {
//   try {
//     // Parse the request body
//     const body = await req.json();
    
//     // Get user ID from the body (sent by frontend)
//     const userId = body.userId;
    
//     if (!userId) {
//       return NextResponse.json({ error: 'Unauthorized - User ID missing' }, { status: 401 });
//     }

//     const query = body.query?.trim();
//     const sessionId = body.sessionId || crypto.randomUUID();
//     const history = Array.isArray(body.history) ? body.history : [];
//     const userEmail = body.userEmail || '';
//     const userName = body.userName || '';

//     if (!query) {
//       return NextResponse.json({ error: 'Empty query' }, { status: 400 });
//     }

//     // Call Python AI service
//     const PYTHON_AI_URL = process.env.PYTHON_AI_URL;
//     if (!PYTHON_AI_URL) {
//       console.error("[ask-ai] PYTHON_AI_URL not configured");
//       return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
//     }

//     let answer = '';
//     let sources: string[] = [];
//     let metadata: Record<string, unknown> = {};

//     try {
//       const aiRes = await fetch(`${PYTHON_AI_URL}/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           query,
//           conversation_history: history,
//           user_id: userId,
//           session_id: sessionId,
//         }),
//       });

//       if (!aiRes.ok) {
//         throw new Error(`Python service returned ${aiRes.status}`);
//       }

//       const data = await aiRes.json();
//       answer = data.answer ?? '';
//       sources = data.sources ?? [];
//       metadata = data.metadata ?? {};

//     } catch (err) {
//       console.error('[ask-ai] Python call failed:', err);
//       return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 });
//     }

//     // Save to Firestore (optional - non-blocking)
//     try {
//       const sessionRef = db
//         .collection('askaiConversations')
//         .doc(userId)
//         .collection('sessions')
//         .doc(sessionId);

//       await sessionRef.set(
//         { updatedAt: FieldValue.serverTimestamp(), userId, userEmail, userName },
//         { merge: true }
//       );

//       const msgCol = sessionRef.collection('messages');

//       await msgCol.add({
//         role: 'user',
//         content: query,
//         timestamp: FieldValue.serverTimestamp(),
//       });

//       await msgCol.add({
//         role: 'assistant',
//         content: answer,
//         sources,
//         metadata,
//         timestamp: FieldValue.serverTimestamp(),
//       });

//     } catch (err) {
//       console.error('[ask-ai] Firestore write failed:', err);
//       // Don't fail the request if Firestore write fails
//     }

//     return NextResponse.json({ answer, sources, sessionId });

//   } catch (error) {
//     console.error('[ask-ai] Error:', error);
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }





// export async function GET(req: NextRequest) {
//   try {
//     const userId = req.headers.get('X-User-Id')
 
//     if (!userId) {
//       return NextResponse.json({ error: 'Unauthorized - User ID missing' }, { status: 401 })
//     }
 
//     // Get the most recently updated session for this user
//     const sessionsSnap = await db
//       .collection('askaiConversations')
//       .doc(userId)
//       .collection('sessions')
//       .orderBy('updatedAt', 'desc')
//       .limit(1)
//       .get()
 
//     if (sessionsSnap.empty) {
//       return NextResponse.json({ messages: [], sessionId: null })
//     }
 
//     const sessionDoc = sessionsSnap.docs[0]
//     const sessionId = sessionDoc.id
 
//     // Fetch messages for that session, ordered by timestamp
//     const messagesSnap = await db
//       .collection('askaiConversations')
//       .doc(userId)
//       .collection('sessions')
//       .doc(sessionId)
//       .collection('messages')
//       .orderBy('timestamp', 'asc')
//       .get()
 
//     const messages = messagesSnap.docs.map(doc => ({
//       id:      doc.id,
//       role:    doc.data().role as 'user' | 'assistant',
//       content: doc.data().content as string,
//     }))
 
//     return NextResponse.json({ messages, sessionId })
 
//   } catch (error) {
//     console.error('[ask-ai GET] Error:', error)
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
//   }
// }





// app/api/ask-ai/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from "@/lib/firebaseAdmin";
import { FieldValue } from 'firebase-admin/firestore'

// Cache for session data
const sessionCache = new Map<string, { data: Record<string, unknown>; timestamp: number }>();
const CACHE_DURATION = 5000; // 5 seconds

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    // Save to Firestore - UNDER THE SPECIFIC USER'S PATH
    try {
      // This ensures data is ONLY stored under this userId
      const sessionRef = db
        .collection('askaiConversations')
        .doc(userId)  // ← Only this user's document
        .collection('sessions')
        .doc(sessionId);

      const batch = db.batch();
      
      batch.set(sessionRef, {
        updatedAt: FieldValue.serverTimestamp(),
        userId,
        userEmail,
        userName,
      }, { merge: true });

      const msgCol = sessionRef.collection('messages');
      
      const userMsgRef = msgCol.doc();
      batch.set(userMsgRef, {
        role: 'user',
        content: query,
        timestamp: FieldValue.serverTimestamp(),
      });

      const assistantMsgRef = msgCol.doc();
      batch.set(assistantMsgRef, {
        role: 'assistant',
        content: answer,
        sources,
        metadata,
        timestamp: FieldValue.serverTimestamp(),
      });

      await batch.commit();
      
      // Clear cache for this user
      sessionCache.delete(userId);

    } catch (err) {
      console.error('[ask-ai] Firestore write failed:', err);
    }

    return NextResponse.json({ answer, sources, sessionId });

  } catch (error) {
    console.error('[ask-ai] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get userId from header (sent by frontend)
    const userId = req.headers.get('X-User-Id');
 
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - User ID missing' }, { status: 401 });
    }

    // Check cache first
    const cached = sessionCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Get sessions ONLY for this specific userId
    const sessionsSnap = await db
      .collection('askaiConversations')
      .doc(userId)  // ← ONLY this user's document
      .collection('sessions')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
 
    if (sessionsSnap.empty) {
      return NextResponse.json({ messages: [], sessionId: null });
    }
 
    const sessionDoc = sessionsSnap.docs[0];
    const sessionId = sessionDoc.id;
 
    // Fetch messages ONLY from this user's session
    const messagesSnap = await db
      .collection('askaiConversations')
      .doc(userId)  // ← ONLY this user's document
      .collection('sessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();
 
    const messages = messagesSnap.docs.map(doc => ({
      id:      doc.id,
      role:    doc.data().role as 'user' | 'assistant',
      content: doc.data().content as string,
    }));
 
    const responseData = { messages, sessionId };
    
    // Store in cache
    sessionCache.set(userId, { data: responseData, timestamp: Date.now() });
    
    // Clean old cache entries
    if (sessionCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of sessionCache.entries()) {
        if (now - value.timestamp > 30000) {
          sessionCache.delete(key);
        }
      }
    }
 
    return NextResponse.json(responseData);
 
  } catch (error) {
    console.error('[ask-ai GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get all sessions for a user (list of past conversations)
export async function getUserSessions(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-Id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const sessionsSnap = await db
      .collection('askaiConversations')
      .doc(userId)
      .collection('sessions')
      .orderBy('updatedAt', 'desc')
      .get();
    
    const sessions = sessionsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[ask-ai] Get sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get a specific session by ID for a user
export async function getSessionById(req: NextRequest, sessionId: string) {
  try {
    const userId = req.headers.get('X-User-Id');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Verify this session belongs to this user
    const sessionRef = db
      .collection('askaiConversations')
      .doc(userId)
      .collection('sessions')
      .doc(sessionId);
    
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    // Get messages for this session
    const messagesSnap = await sessionRef
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    
    const messages = messagesSnap.docs.map(doc => ({
      id: doc.id,
      role: doc.data().role,
      content: doc.data().content,
    }));
    
    return NextResponse.json({
      session: { id: sessionDoc.id, ...sessionDoc.data() },
      messages
    });
  } catch (error) {
    console.error('[ask-ai] Get session error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = req.headers.get('X-User-Id');
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (sessionId) {
      // Delete ONLY this user's specific session
      const sessionRef = db
        .collection('askaiConversations')
        .doc(userId)
        .collection('sessions')
        .doc(sessionId);
      
      // Verify session exists before deleting
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      
      // Delete all messages in the session first
      const messagesSnap = await sessionRef.collection('messages').get();
      const batch = db.batch();
      messagesSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      batch.delete(sessionRef);
      await batch.commit();
      
      sessionCache.delete(userId);
      
      return NextResponse.json({ success: true, message: 'Session deleted' });
    } else {
      // Delete ALL sessions for this user (be careful - only for cleanup)
      const sessionsSnap = await db
        .collection('askaiConversations')
        .doc(userId)
        .collection('sessions')
        .get();
        
      const batch = db.batch();
      for (const sessionDoc of sessionsSnap.docs) {
        // Delete messages in each session
        const messagesSnap = await sessionDoc.ref.collection('messages').get();
        messagesSnap.docs.forEach(msgDoc => {
          batch.delete(msgDoc.ref);
        });
        batch.delete(sessionDoc.ref);
      }
      await batch.commit();
      
      sessionCache.delete(userId);
      
      return NextResponse.json({ success: true, message: 'All sessions deleted' });
    }
  } catch (error) {
    console.error('[ask-ai DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}