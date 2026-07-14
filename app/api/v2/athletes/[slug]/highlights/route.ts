import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { AthleteProfileService } from '../../../../../modules/athlete-profile/athlete-profile.service';

const athleteService = new AthleteProfileService(db);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await props.params;
    const slug = resolvedParams.slug;
    const highlights = await athleteService.getHighlights(slug);
    return NextResponse.json(highlights);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
