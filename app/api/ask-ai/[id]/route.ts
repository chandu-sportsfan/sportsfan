// app/api/ask-ai/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from "@/lib/firebaseAdmin";

// GET: Get a specific session by ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = req.headers.get('X-User-Id');
    const sessionId = params.id;
    
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
    console.error('[ask-ai GET session] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a specific session
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = req.headers.get('X-User-Id');
    const sessionId = params.id;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    
    // Clear cache for this user (cache is in main route)
    // We'll let it expire naturally or clear on next request
    
    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('[ask-ai DELETE session] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}