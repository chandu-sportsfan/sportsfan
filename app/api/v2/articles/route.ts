import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const snapshot = await db.collection('articles').get();
    const articles = snapshot.docs.map((doc) => ({
      slug: doc.id,
      heroImage: doc.data().heroImage,
      title: doc.data().title,
      author: doc.data().author,
      readTime: doc.data().readTime,
      date: doc.data().date,
      likeCount: doc.data().likeCount,
      commentCount: doc.data().commentCount,
    }));
    return NextResponse.json(articles);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
