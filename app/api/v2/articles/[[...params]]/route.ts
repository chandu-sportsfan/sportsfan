import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { ArticlesService } from '../../../../../modules/articles/articles.service';

const articlesService = new ArticlesService(db);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ params?: string[] }> }
) {
  try {
    const resolvedParams = await props.params;
    const pathParams = resolvedParams.params || [];

    if (pathParams.length === 0) {
      // GET /api/v2/articles
      const articles = await articlesService.getAllArticles();
      return NextResponse.json(articles);
    } else if (pathParams.length === 1) {
      // GET /api/v2/articles/:slug
      const slug = pathParams[0];
      const article = await articlesService.getArticleBySlug(slug);
      return NextResponse.json(article);
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
