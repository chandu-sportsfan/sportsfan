import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { RecordsRepository } from '../../../../../modules/records/records.repository';
import { RecordsService } from '../../../../../modules/records/records.service';

const recordsRepository = new RecordsRepository(db);
const recordsService = new RecordsService(recordsRepository);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const event = searchParams.get('event') || '';
    const trends = await recordsService.getTrends(event);
    return NextResponse.json(trends);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
