import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // 1. Get requested date or default to the newest one
    const searchParams = req.nextUrl.searchParams;
    const dateParam = searchParams.get('date') || '2026-05-17'; 
    
    // Convert '2026-05-17' into '2026_05_17' for the CDN filename
    const formattedDate = dateParam.replace(/-/g, '_');
    
    // Cloudinary raw URLs work without the version (v1779...) number!
    const cdnUrl = `https://res.cloudinary.com/dflnsufit/raw/upload/sf360/articles/articles_${formattedDate}.json`;
    
    // Add cache-busting query parameter with current timestamp
    const cacheBustUrl = `${cdnUrl}?t=${Date.now()}`;
    
    const response = await fetch(cacheBustUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from CDN');
    }

    const data = await response.json();
    
    // 2. FIX THE DATES: Extract the feed_date and attach it to each article
    const feedDateTimestamp = data.feed_date ? new Date(data.feed_date).getTime() : Date.now();
    
    if (data.articles && Array.isArray(data.articles)) {
      data.articles = data.articles.map((article: Record<string, unknown>) => ({
        ...article,
        createdAt: feedDateTimestamp // Frontend uses this to format the date!
      }));
    }
    
    // Return data with strong cache-busting headers
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Error fetching news center data:", error);
    return NextResponse.json(
      { error: 'Failed to load news articles' }, 
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
