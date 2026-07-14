import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../lib/firebaseAdmin';
import { AthleteProfileService } from '../../../../../modules/athlete-profile/athlete-profile.service';

const athleteService = new AthleteProfileService(db);

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ params?: string[] }> }
) {
  try {
    const resolvedParams = await props.params;
    const pathParams = resolvedParams.params || [];

    if (pathParams.length === 0) {
      // GET /api/v2/athletes
      const athletes = await athleteService.getAllAthletes();
      return NextResponse.json(athletes);
    }

    const slug = pathParams[0];

    if (pathParams.length === 1) {
      // GET /api/v2/athletes/:slug
      const athlete = await athleteService.getAthleteBySlug(slug);
      if (!athlete) {
        return NextResponse.json({ error: `Athlete ${slug} not found` }, { status: 404 });
      }
      return NextResponse.json(athlete);
    }

    if (pathParams.length === 2) {
      const subpath = pathParams[1];
      switch (subpath) {
        case 'posts':
          // GET /api/v2/athletes/:slug/posts
          const posts = await athleteService.getPosts(slug);
          return NextResponse.json(posts);
        case 'videos':
          // GET /api/v2/athletes/:slug/videos
          const videos = await athleteService.getVideos(slug);
          return NextResponse.json(videos);
        case 'drops':
          // GET /api/v2/athletes/:slug/drops
          const drops = await athleteService.getDrops(slug);
          return NextResponse.json(drops);
        case 'highlights':
          // GET /api/v2/athletes/:slug/highlights
          const highlights = await athleteService.getHighlights(slug);
          return NextResponse.json(highlights);
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
