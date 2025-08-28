// src/app/api/admin/trigger-pipeline/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { action = 'full', limit = 25 } = await request.json();
    
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000'
      : request.url.split('/api/admin')[0];
    const results = [];

    console.log(`Triggering FDA pipeline: ${action}`);

    // Step 1: Ingest FDA data
    if (action === 'full' || action === 'ingest') {
      console.log('Step 1: Ingesting FDA data...');
      
      try {
        const ingestResponse = await fetch(`${baseUrl}/api/fda/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'all', limit })
        });
        
        // Check if response is ok before trying to parse JSON
        if (!ingestResponse.ok) {
          throw new Error(`Ingestion API returned ${ingestResponse.status}: ${ingestResponse.statusText}`);
        }

        const contentType = ingestResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await ingestResponse.text();
          throw new Error(`Ingestion API returned non-JSON response: ${text.substring(0, 200)}...`);
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
            error: `Failed at ingestion step: ${ingestResult.error}`,
            results
          });
        }

        console.log(`✓ Ingested ${ingestResult.ingested} FDA announcements`);
      } catch (ingestError) {
        console.error('Ingestion step failed:', ingestError);
        results.push({
          step: 'ingest',
          success: false,
          error: ingestError.message
        });
        
        return NextResponse.json({
          success: false,
          error: `Ingestion failed: ${ingestError.message}`,
          results
        });
      }
    }

    // Step 2: Process with AI (if ingestion succeeded or if processing only)
    if (action === 'full' || action === 'process') {
      console.log('Step 2: Processing with AI...');
      
      // Wait a moment for ingestion to complete
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
          throw new Error(`Processing API returned ${processResponse.status}: ${processResponse.statusText}`);
        }

        const contentType = processResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await processResponse.text();
          throw new Error(`Processing API returned non-JSON response: ${text.substring(0, 200)}...`);
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
        console.error('Processing step failed:', processError);
        results.push({
          step: 'process',
          success: false,
          error: processError.message
        });
        
        // Don't fail the entire pipeline if just AI processing fails
        console.log('AI processing failed, but ingestion may have succeeded');
      }
    }

    // Summary
    const summary = {
      ingested: results.find(r => r.step === 'ingest')?.data?.ingested || 0,
      processed: results.find(r => r.step === 'process')?.data?.processed || 0,
      failed: results.find(r => r.step === 'process')?.data?.failed || 0
    };

    return NextResponse.json({
      success: true,
      action,
      summary,
      results,
      message: `Pipeline completed: ${summary.ingested} ingested, ${summary.processed} processed`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Pipeline trigger error:', error);
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

// GET endpoint for pipeline status
export async function GET(request) {
  try {
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000'
      : request.url.split('/api/admin')[0];

    // Get current stats
    const statsResponse = await fetch(`${baseUrl}/api/stats`);
    
    let stats = null;
    if (statsResponse.ok) {
      const statsResult = await statsResponse.json();
      stats = statsResult.success ? statsResult.data : null;
    }

    return NextResponse.json({
      success: true,
      pipeline_status: 'ready',
      stats: stats,
      available_endpoints: [
        '/api/fda/drug-approvals',
        '/api/fda/safety-alerts', 
        '/api/fda/device-approvals',
        '/api/fda/all',
        '/api/fda/ingest',
        '/api/fda/process'
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