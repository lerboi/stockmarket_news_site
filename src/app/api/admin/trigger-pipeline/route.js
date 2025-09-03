// src/app/api/admin/trigger-pipeline/route.js - Updated for multi-source RSS with timeframe options
import { NextResponse } from 'next/server';

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/admin/trigger-pipeline')[0];
}

export async function POST(request) {
  try {
    const { action = 'full', limit = 15, timeframe = '24h', source = 'both' } = await request.json();

    console.log(`Triggering Multi-Source pipeline: ${action} (source: ${source}, timeframe: ${timeframe})`);

    const results = {
      fda: { success: false, summary: null, error: null },
      sec: { success: false, summary: null, error: null }
    };

    const baseUrl = getBaseUrl(request);

    // Run FDA pipeline if source is 'fda' or 'both'
    if (source === 'fda' || source === 'both') {
      try {
        console.log('Step 1: Ingesting FDA Multi-RSS data...');

        const fdaIngestResponse = await fetch(`${baseUrl}/api/fda/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit, timeframe })
        });

        const fdaIngestResult = await fdaIngestResponse.json();

        if (fdaIngestResult.success && fdaIngestResult.ingested > 0) {
          console.log('Step 2: Processing FDA announcements with AI...');

          await new Promise(resolve => setTimeout(resolve, 2000));

          const fdaProcessResponse = await fetch(`${baseUrl}/api/fda/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchSize: fdaIngestResult.ingested })
          });

          const fdaProcessResult = await fdaProcessResponse.json();

          results.fda = {
            success: true,
            summary: {
              ingested: fdaIngestResult.ingested,
              processed: fdaProcessResult.processed || 0,
              failed: fdaProcessResult.failed || 0,
              source_breakdown: fdaIngestResult.source_breakdown,
              timeframe: timeframe
            }
          };
        } else {
          results.fda = {
            success: true,
            summary: {
              ingested: 0,
              processed: 0,
              failed: 0,
              message: fdaIngestResult.message || 'No FDA announcements found',
              timeframe: timeframe
            }
          };
        }
      } catch (error) {
        console.error('FDA pipeline error:', error);
        results.fda = {
          success: false,
          error: error.message
        };
      }
    }

    // Run SEC pipeline if source is 'sec' or 'both'
    if (source === 'sec' || source === 'both') {
      try {
        console.log('Step 1: Ingesting SEC EDGAR data...');

        const secIngestResponse = await fetch(`${baseUrl}/api/sec/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit, timeframe })
        });

        const secIngestResult = await secIngestResponse.json();

        if (secIngestResult.success && secIngestResult.ingested > 0) {
          console.log('Step 2: Processing SEC filings with AI...');

          await new Promise(resolve => setTimeout(resolve, 2000));

          const secProcessResponse = await fetch(`${baseUrl}/api/sec/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchSize: secIngestResult.ingested })
          });

          const secProcessResult = await secProcessResponse.json();

          results.sec = {
            success: true,
            summary: {
              ingested: secIngestResult.ingested,
              processed: secProcessResult.processed || 0,
              failed: secProcessResult.failed || 0,
              timeframe: timeframe
            }
          };
        } else {
          results.sec = {
            success: true,
            summary: {
              ingested: 0,
              processed: 0,
              failed: 0,
              message: secIngestResult.message || 'No SEC filings found',
              timeframe: timeframe
            }
          };
        }
      } catch (error) {
        console.error('SEC pipeline error:', error);
        results.sec = {
          success: false,
          error: error.message
        };
      }
    }

    // Determine overall success
    const overallSuccess = (source === 'both') ?
      (results.fda.success && results.sec.success) :
      (source === 'fda' ? results.fda.success : results.sec.success);

    // Create combined summary
    const combinedSummary = {
      source: source,
      timeframe: timeframe,
      fda: results.fda.success ? results.fda.summary : { error: results.fda.error },
      sec: results.sec.success ? results.sec.summary : { error: results.sec.error },
      total_ingested: (results.fda.summary?.ingested || 0) + (results.sec.summary?.ingested || 0),
      total_processed: (results.fda.summary?.processed || 0) + (results.sec.summary?.processed || 0),
      total_failed: (results.fda.summary?.failed || 0) + (results.sec.summary?.failed || 0)
    };

    console.log(`Multi-Source Pipeline Complete:`, combinedSummary);

    return NextResponse.json({
      success: overallSuccess,
      action: action,
      summary: combinedSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Multi-Source Pipeline Error:', error);
    return NextResponse.json(
      {
        success: false,
        action: action || 'unknown',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : request.url.split('/api/admin')[0];

    const statsResponse = await fetch(`${baseUrl}/api/stats`);
    let stats = null;

    if (statsResponse.ok) {
      const statsResult = await statsResponse.json();
      stats = statsResult.success ? statsResult.data : null;
    }

    return NextResponse.json({
      success: true,
      pipeline_status: 'ready',
      pipeline_type: 'FDA Multi-RSS Feed',
      data_sources: [
        {
          name: 'FDA Press Releases',
          url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
          types: ['drug_approval', 'device_approval', 'regulatory']
        },
        {
          name: 'FDA MedWatch Alerts',
          url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml',
          types: ['safety_alert', 'recall']
        }
      ],
      timeframe_options: [
        { value: '24h', label: '24 Hours', description: 'Real-time breaking news' },
        { value: '1w', label: '1 Week', description: 'Weekly market analysis' },
        { value: '1m', label: '1 Month', description: 'Monthly trend analysis' }
      ],
      stats: stats,
      available_endpoints: [
        '/api/fda/rss-feed (Multi-RSS parser)',
        '/api/fda/all (Combined endpoint)',
        '/api/fda/ingest (Multi-source ingestion)',
        '/api/fda/process (AI processing)'
      ],
      features: [
        'Dual RSS data sources (Press Releases + MedWatch)',
        'Flexible timeframe processing (24h/1w/1m)',
        'Client-side filtering by announcement_type',
        'AI public company filtering',
        'Enhanced breaking news detection',
        'Source-specific categorization'
      ],
      processing_flow: [
        '1. Fetch both RSS feeds concurrently',
        '2. Parse and categorize by source type',
        '3. Time-based filtering (24h/1w/1m)',
        '4. AI filter for public companies only',
        '5. Real-time sentiment analysis',
        '6. Relevance scoring and prioritization'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Pipeline status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}