import { NextRequest, NextResponse } from 'next/server';

interface PageSpeedMetrics {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

interface FieldData {
  fcp?: number;
  fid?: number;
  lcp?: number;
  cls?: number;
}

interface AuditIssue {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
}

interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  scores: PageSpeedMetrics;
  fieldData: FieldData;
  issues: AuditIssue[];
}

export async function POST(request: NextRequest) {
  try {
    const { url, apiKey, strategy = 'mobile' } = await request.json();

    if (!url || !apiKey) {
      return NextResponse.json(
        { error: 'URL and API key are required' },
        { status: 400 }
      );
    }

    console.log(`[PageSpeed] Scanning ${url} (${strategy})...`);

    // Build PageSpeed Insights API URL
    const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
    const categoryParams = categories.map(c => `category=${c}`).join('&');
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&${categoryParams}&strategy=${strategy.toUpperCase()}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[PageSpeed] API Error:', errorData);
      return NextResponse.json(
        { error: errorData?.error?.message || `API request failed with status ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check for Lighthouse errors
    if (data.error) {
      return NextResponse.json(
        { error: data.error.message },
        { status: 500 }
      );
    }

    if (data.lighthouseResult?.runtimeError) {
      return NextResponse.json(
        { error: data.lighthouseResult.runtimeError.message },
        { status: 500 }
      );
    }

    const { lighthouseResult, loadingExperience } = data;
    const { categories: resultCategories, audits } = lighthouseResult;

    // Extract scores
    const scores: PageSpeedMetrics = {
      performance: Math.round((resultCategories.performance?.score || 0) * 100),
      accessibility: Math.round((resultCategories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((resultCategories['best-practices']?.score || 0) * 100),
      seo: Math.round((resultCategories.seo?.score || 0) * 100),
    };

    // Extract field data (Core Web Vitals)
    const fieldData: FieldData = {};
    
    if (loadingExperience?.metrics) {
      const metrics = loadingExperience.metrics;
      if (metrics.FIRST_CONTENTFUL_PAINT_MS) {
        fieldData.fcp = metrics.FIRST_CONTENTFUL_PAINT_MS.percentile;
      }
      if (metrics.FIRST_INPUT_DELAY_MS) {
        fieldData.fid = metrics.FIRST_INPUT_DELAY_MS.percentile;
      }
      if (metrics.LARGEST_CONTENTFUL_PAINT_MS) {
        fieldData.lcp = metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile;
      }
      if (metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE) {
        fieldData.cls = metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100;
      }
    }

    // If no field data from loadingExperience, try from audits
    if (!fieldData.fcp && audits['first-contentful-paint']) {
      fieldData.fcp = audits['first-contentful-paint'].numericValue;
    }
    if (!fieldData.lcp && audits['largest-contentful-paint']) {
      fieldData.lcp = audits['largest-contentful-paint'].numericValue;
    }
    if (!fieldData.cls && audits['cumulative-layout-shift']) {
      fieldData.cls = audits['cumulative-layout-shift'].numericValue;
    }

    // Extract issues (failed audits)
    const issues: AuditIssue[] = [];
    const relevantAuditIds = [
      'first-contentful-paint',
      'largest-contentful-paint',
      'cumulative-layout-shift',
      'total-blocking-time',
      'speed-index',
      'interactive',
      'server-response-time',
      'render-blocking-resources',
      'unminified-css',
      'unminified-javascript',
      'unused-css-rules',
      'unused-javascript',
      'uses-optimized-images',
      'uses-webp-images',
      'uses-responsive-images',
      'image-alt',
      'meta-description',
      'document-title',
      'crawlable-anchors',
    ];

    for (const auditId of relevantAuditIds) {
      const audit = audits[auditId];
      if (audit && (audit.score === null || audit.score < 0.9)) {
        issues.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: audit.displayValue,
        });
      }
    }

    const result: PageSpeedResult = {
      url,
      strategy,
      scores,
      fieldData,
      issues,
    };

    console.log(`[PageSpeed] Completed ${url} (${strategy})`);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[PageSpeed] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run PageSpeed test' },
      { status: 500 }
    );
  }
}
