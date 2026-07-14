import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/firebaseAdmin';
import { AthleteProfileService } from '../../../../modules/athlete-profile/athlete-profile.service';

const athleteService = new AthleteProfileService(db);

export async function GET(request: NextRequest) {
  try {
    const athletes = await athleteService.getAllAthletes();
    return NextResponse.json(athletes);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
