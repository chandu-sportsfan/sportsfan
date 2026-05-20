import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    // Default to a fallback date if none provided
    const dateParam = searchParams.get('date') || '2026-05-19'; 
    
    // Split the date string into an array (handles single dates or comma-separated lists)
    const dates = dateParam.split(',');
    
    // Fetch all requested date files in parallel
    const fetchPromises = dates.map(async (dateStr) => {
      const formattedDate = dateStr.trim().replace(/-/g, '_');
      const cdnUrl = `https://res.cloudinary.com/dflnsufit/raw/upload/sf360/articles/articles_${formattedDate}.json`;
      const cacheBustUrl = `${cdnUrl}?t=${Date.now()}`;
      
      try {
        const response = await fetch(cacheBustUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          }
        });
        
        if (!response.ok) return null; // If a day is missing, skip it gracefully
        return await response.json();
      } catch (err) {
        console.warn(`Failed to fetch news for ${formattedDate}`, err);
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    
    // Merge all successful article arrays together
    const allArticles: Record<string, unknown>[] = [];
    
    results.forEach((data) => {
      if (data && data.articles && Array.isArray(data.articles)) {
        // Extract the feed_date and attach it to each article for sorting
        const feedDateTimestamp = data.feed_date ? new Date(data.feed_date).getTime() : Date.now();
        const mappedArticles = data.articles.map((article: Record<string, unknown>) => ({
          ...article,
          createdAt: feedDateTimestamp
        }));
        allArticles.push(...mappedArticles);
      }
    });
    
    return NextResponse.json({ articles: allArticles }, {
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
