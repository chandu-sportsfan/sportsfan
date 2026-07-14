import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';
import { ArticlesService } from '../../../../modules/articles/articles.service';

const articlesService = new ArticlesService(db);

export async function GET(request: NextRequest) {
  try {
    const articles = await articlesService.getAllArticles();
    return NextResponse.json(articles);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
