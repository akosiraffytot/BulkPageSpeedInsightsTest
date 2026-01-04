import { NextRequest, NextResponse } from 'next/server';
import Sitemapper from 'sitemapper';

export async function POST(request: NextRequest) {
  try {
    const { sitemapUrl, allowInsecure } = await request.json();

    console.log('[Sitemap Parser] Starting with:', { sitemapUrl, allowInsecure });

    if (!sitemapUrl) {
      return NextResponse.json(
        { error: 'Sitemap URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(sitemapUrl);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid Sitemap URL format' },
        { status: 400 }
      );
    }

    // Create Sitemapper instance with the same config as actions.ts
    const sitemapper = new Sitemapper({
      url: sitemapUrl,
      timeout: 30000,
      rejectUnauthorized: !allowInsecure,
    });

    console.log('[Sitemap Parser] Fetching sitemap with rejectUnauthorized:', !allowInsecure);

    const { sites } = await sitemapper.fetch();

    console.log('[Sitemap Parser] Fetched sites:', sites?.length || 0);

    if (!sites || sites.length === 0) {
      console.error('[Sitemap Parser] No URLs found in sitemap');
      return NextResponse.json(
        { 
          error: 'No URLs found in the sitemap',
          debug: {
            sitemapUrl,
            allowInsecure,
            sitesFound: 0,
          }
        },
        { status: 404 }
      );
    }

    console.log(`[Sitemap Parser] Successfully extracted ${sites.length} URLs`);

    return NextResponse.json({
      urls: sites,
      count: sites.length,
    });
  } catch (error: any) {
    console.error('[Sitemap Parser] Error:', error);
    
    // Capture detailed error information like in actions.ts
    const nerdyError = error.cause ? JSON.stringify(error.cause) : String(error);
    const errorDetails = {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      stack: error.stack,
      cause: error.cause,
      raw: nerdyError,
    };

    console.error('[Sitemap Parser] Error details:', errorDetails);

    return NextResponse.json(
      {
        error: error.message || 'Failed to parse sitemap',
        debug: errorDetails,
      },
      { status: 500 }
    );
  }
}
