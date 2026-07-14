import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';
import { PlaybookService } from '../../../../modules/playbook/playbook.service';

const playbookService = new PlaybookService(db);

export async function GET(request: NextRequest) {
  try {
    const weeks = await playbookService.getAllWeeks();
    return NextResponse.json(weeks);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
