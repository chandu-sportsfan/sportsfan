import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { PlaybookService } from '../../../../../modules/playbook/playbook.service';

const playbookService = new PlaybookService(db);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ params?: string[] }> }
) {
  try {
    const resolvedParams = await props.params;
    const pathParams = resolvedParams.params || [];

    if (pathParams.length === 0) {
      // GET /api/v2/playbook
      const weeks = await playbookService.getAllWeeks();
      return NextResponse.json(weeks);
    }

    const id = pathParams[0];

    if (pathParams.length === 1) {
      // GET /api/v2/playbook/:id
      const week = await playbookService.getWeek(id);
      if (!week) {
        return NextResponse.json({ error: `Playbook week ${id} not found` }, { status: 404 });
      }
      return NextResponse.json(week);
    }

    if (pathParams.length === 2 && pathParams[1] === 'drops') {
      // GET /api/v2/playbook/:id/drops
      const drops = await playbookService.getDrops(id);
      return NextResponse.json(drops);
    }

    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
