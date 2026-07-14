import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { PlaybookService } from '../../../../../modules/playbook/playbook.service';

const playbookService = new PlaybookService(db);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await props.params;
    const id = resolvedParams.id;
    const drops = await playbookService.getDrops(id);
    return NextResponse.json(drops);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
