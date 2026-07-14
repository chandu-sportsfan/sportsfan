import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const event = searchParams.get('event') || '';
    const category = searchParams.get('category') || '';

    const key = `${event}_${category}`;
    const doc = await db.collection('records').doc(key).get();
    const records = doc.exists ? (doc.data()?.records || []) : [];

    return NextResponse.json(records);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
