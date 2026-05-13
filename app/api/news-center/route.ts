import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cdnUrl = "https://res.cloudinary.com/dflnsufit/raw/upload/sf360/articles/articles_2026_05_13.json";
    
    const response = await fetch(cdnUrl, {
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from CDN');
    }

    const data = await response.json();
    
    // Return data with CORS headers allowing your frontend to read it
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Allows requests from any origin (like your frontend on 3001)
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
        }
      }
    );
  }
}

// Handle preflight OPTIONS requests for CORS
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