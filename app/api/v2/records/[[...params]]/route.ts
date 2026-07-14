import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { RecordsRepository } from '../../../../../modules/records/records.repository';
import { RecordsService } from '../../../../../modules/records/records.service';

const recordsRepository = new RecordsRepository(db);
const recordsService = new RecordsService(recordsRepository);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ params?: string[] }> }
) {
  try {
    const resolvedParams = await props.params;
    const pathParams = resolvedParams.params || [];
    const { searchParams } = request.nextUrl;

    if (pathParams.length === 0) {
      // GET /api/v2/records?event=100m&category=Men
      const event = searchParams.get('event') || '';
      const category = searchParams.get('category') || '';
      const records = await recordsService.getRecords(event, category);
      return NextResponse.json(records);
    }

    const subpath = pathParams[0];

    if (pathParams.length === 1) {
      switch (subpath) {
        case 'insight': {
          // GET /api/v2/records/insight?event=100m&category=Men
          const event = searchParams.get('event') || '';
          const category = searchParams.get('category') || '';
          const insight = await recordsService.getInsight(event, category);
          return NextResponse.json(insight);
        }
        case 'trends': {
          // GET /api/v2/records/trends?event=100m
          const event = searchParams.get('event') || '';
          const trends = await recordsService.getTrends(event);
          return NextResponse.json(trends);
        }
        case 'progress': {
          // GET /api/v2/records/progress?event=100m
          const event = searchParams.get('event') || '';
          const progress = await recordsService.getProgress(event);
          return NextResponse.json(progress);
        }
        case 'stories': {
          // GET /api/v2/records/stories
          const stories = await recordsService.getStories();
          return NextResponse.json(stories);
        }
        default:
          break;
      }
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
