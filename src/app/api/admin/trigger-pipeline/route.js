// src/app/api/admin/trigger-pipeline/route.js - Updated for multi-source RSS with timeframe options
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { action = 'full', limit = 25, timeframe = '24h' } = await request.json(); // Changed from hours to timeframe
    
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000'
      : request.url.split('/api/admin')[0];
    const results = [];

    console.log(`Triggering FDA Multi-RSS pipeline: ${action} (timeframe: ${timeframe})`);

    // Step 1: Ingest RSS data from both sources
    if (action === 'full' || action === 'ingest') {
      console.log(`Step 1: Ingesting FDA Multi-RSS data for timeframe ${timeframe}...`);
      
      try {
        const ingestResponse = await fetch(`${baseUrl}/api/fda/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit, timeframe }) // Use timeframe instead of hours
        });
        
        if (!ingestResponse.ok) {
          throw new Error(`Multi-RSS Ingestion failed: ${ingestResponse.status}`);
        }

        const ingestResult = await ingestResponse.json();
        results.push({
          step: 'ingest',
          success: ingestResult.success,
          data: ingestResult
        });

        if (!ingestResult.success) {
          return NextResponse.json({
            success: false,
            error: `Multi-RSS ingestion failed: ${ingestResult.error}`,
            results
          });
        }

        const sourceBreakdownText = ingestResult.source_breakdown ? 
          `Press Releases: ${ingestResult.source_breakdown['FDA Press Releases'] || 0}, MedWatch: ${ingestResult.source_breakdown['FDA MedWatch Alerts'] || 0}` : 
          'Mixed sources';
        
        console.log(`✓ Ingested ${ingestResult.ingested} FDA announcements (${sourceBreakdownText})`);
      } catch (ingestError) {
        console.error('Multi-RSS Ingestion failed:', ingestError);
        results.push({
          step: 'ingest',
          success: false,
          error: ingestError.message
        });
        
        return NextResponse.json({
          success: false,
          error: `Multi-RSS Ingestion failed: ${ingestError.message}`,
          results
        });
      }
    }

    // Step 2: AI Processing
    if (action === 'full' || action === 'process') {
      console.log('Step 2: AI processing...');
      
      if (action === 'full') {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      try {
        const processResponse = await fetch(`${baseUrl}/api/fda/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchSize: Math.min(limit, 10) })
        });
        
        if (!processResponse.ok) {
          throw new Error(`AI Processing failed: ${processResponse.status}`);
        }

        const processResult = await processResponse.json();
        results.push({
          step: 'process',
          success: processResult.success,
          data: processResult
        });

        if (processResult.success) {
          console.log(`✓ AI processed ${processResult.processed} announcements`);
        }
      } catch (processError) {
        console.error('AI Processing failed:', processError);
        results.push({
          step: 'process',
          success: false,
          error: processError.message
        });
      }
    }

    // Summary with enhanced details
    const ingestData = results.find(r => r.step === 'ingest')?.data;
    const processData = results.find(r => r.step === 'process')?.data;

    const summary = {
      ingested: ingestData?.ingested || 0,
      processed: processData?.processed || 0,
      failed: processData?.failed || 0,
      timeframe: timeframe,
      data_sources: ['FDA Press Releases', 'FDA MedWatch Alerts'],
      source_breakdown: ingestData?.source_breakdown || null,
      filtered_out: ingestData?.filtered_out || 0,
      public_companies_found: ingestData?.public_companies_found || 0
    };

    // Generate descriptive message
    let message = `Multi-RSS Pipeline: ${summary.ingested} ingested`;
    if (summary.processed > 0) {
      message += `, ${summary.processed} processed`;
    }
    message += ` (${timeframe})`;

    if (summary.source_breakdown) {
      const pressCount = summary.source_breakdown['FDA Press Releases'] || 0;
      const medwatchCount = summary.source_breakdown['FDA MedWatch Alerts'] || 0;
      message += ` - PR: ${pressCount}, MW: ${medwatchCount}`;
    }

    return NextResponse.json({
      success: true,
      action,
      summary,
      results,
      message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Multi-RSS Pipeline error:', error);
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

// GET endpoint with enhanced status
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