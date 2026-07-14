import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const snapshot = await db.collection('athletesProfile').get();
    const athletes = snapshot.docs.map((doc) => ({
      slug: doc.id,
      ...doc.data(),
    }));
    return NextResponse.json(athletes);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
