// src/app/api/test/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const tests = [];
  
  try {
    // Test 1: Environment variables
    tests.push({
      name: 'Environment Variables',
      supabase_url: process.env.SUPABASE_URL ? 'Set' : 'Missing',
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing',
      anthropic_key: process.env.ANTHROPIC_API_KEY ? 'Set' : 'Missing'
    });

    // Test 2: FDA API direct call
    try {
      const fdaResponse = await fetch('https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_status:"AP"&sort=submissions.submission_status_date:desc&limit=1');
      tests.push({
        name: 'FDA API Direct',
        status: fdaResponse.ok ? 'Success' : 'Failed',
        status_code: fdaResponse.status
      });
    } catch (fdaError) {
      tests.push({
        name: 'FDA API Direct',
        status: 'Error',
        error: fdaError.message
      });
    }

    // Test 3: Supabase connection
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const { error } = await supabase.from('fda_announcements').select('count').limit(1);
      tests.push({
        name: 'Supabase Connection',
        status: error ? 'Failed' : 'Success',
        error: error?.message
      });
    } catch (supabaseError) {
      tests.push({
        name: 'Supabase Connection', 
        status: 'Error',
        error: supabaseError.message
      });
    }

    // Test 4: Database tables exist
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      const tableTests = {};
      const tables = ['fda_announcements', 'processed_news', 'processing_queue', 'stock_mappings'];
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('count').limit(1);
          tableTests[table] = error ? `Error: ${error.message}` : 'Exists';
        } catch (e) {
          tableTests[table] = `Error: ${e.message}`;
        }
      }
      
      tests.push({
        name: 'Database Tables',
        ...tableTests
      });
    } catch (dbError) {
      tests.push({
        name: 'Database Tables',
        status: 'Error',
        error: dbError.message
      });
    }

    return NextResponse.json({
      success: true,
      tests,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      tests,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}