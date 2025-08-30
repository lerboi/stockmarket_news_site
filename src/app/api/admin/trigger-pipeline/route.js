// src/app/api/admin/trigger-pipeline/route.js - Simplified
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { action = 'full', limit = 25, hours = 24 } = await request.json();
    
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000'
      : request.url.split('/api/admin')[0];
    const results = [];

    console.log(`Triggering FDA RSS pipeline: ${action} (last ${hours} hours)`);

    // Step 1: Ingest RSS data (no type filtering)
    if (action === 'full' || action === 'ingest') {
      console.log(`Step 1: Ingesting FDA RSS data from last ${hours} hours...`);
      
      try {
        const ingestResponse = await fetch(`${baseUrl}/api/fda/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit, hours })
        });
        
        if (!ingestResponse.ok) {
          throw new Error(`RSS Ingestion failed: ${ingestResponse.status}`);
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
            error: `RSS ingestion failed: ${ingestResult.error}`,
            results
          });
        }

        console.log(`✓ Ingested ${ingestResult.ingested} FDA RSS announcements`);
      } catch (ingestError) {
        console.error('RSS Ingestion failed:', ingestError);
        results.push({
          step: 'ingest',
          success: false,
          error: ingestError.message
        });
        
        return NextResponse.json({
          success: false,
          error: `RSS Ingestion failed: ${ingestError.message}`,
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

    // Summary
    const summary = {
      ingested: results.find(r => r.step === 'ingest')?.data?.ingested || 0,
      processed: results.find(r => r.step === 'process')?.data?.processed || 0,
      failed: results.find(r => r.step === 'process')?.data?.failed || 0,
      hours_searched: hours,
      data_source: 'FDA RSS Feed'
    };

    return NextResponse.json({
      success: true,
      action,
      summary,
      results,
      message: `RSS Pipeline: ${summary.ingested} ingested, ${summary.processed} processed (${hours}h)`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('RSS Pipeline error:', error);
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

// GET endpoint
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
      pipeline_type: 'FDA RSS Feed Only',
      data_source: 'Real-time FDA Press Releases',
      stats: stats,
      available_endpoints: [
        '/api/fda/rss-feed (RSS parser)',
        '/api/fda/all (main endpoint)',
        '/api/fda/ingest (ingestion)', 
        '/api/fda/process (AI processing)'
      ],
      features: [
        'Single RSS data source',
        'Real-time processing (1-hour windows)', 
        'Client-side filtering by announcement_type',
        'AI public company filtering',
        'Breaking news detection'
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