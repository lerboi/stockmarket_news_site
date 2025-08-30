// src/app/api/fda/all/route.js - Cleaned up, RSS only
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const hours = parseInt(searchParams.get('hours') || '24');
    const includeTypes = searchParams.get('types')?.split(',') || ['drug_approval', 'safety_alert', 'device_approval', 'regulatory'];

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching FDA RSS data for last ${hours} hours, limit ${limit}`);
    
    // Fetch from our RSS endpoint only
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit}&hours=${hours}`);
    
    if (!rssResponse.ok) {
      throw new Error(`RSS endpoint failed: ${rssResponse.status}`);
    }
    
    const rssResult = await rssResponse.json();
    
    if (!rssResult.success) {
      throw new Error(rssResult.error || 'RSS feed parsing failed');
    }

    let allData = rssResult.data || [];
    
    // Filter by announcement types if specified
    if (includeTypes.length > 0 && !includeTypes.includes('all')) {
      allData = allData.filter(item => includeTypes.includes(item.announcement_type));
    }

    // Sort by pub_date (most recent first)
    allData.sort((a, b) => {
      const dateA = new Date(a.pub_date || 0);
      const dateB = new Date(b.pub_date || 0);
      return dateB - dateA;
    });

    // Apply final limit
    allData = allData.slice(0, limit);

    console.log(`Returning ${allData.length} recent FDA RSS announcements`);

    return NextResponse.json({
      success: true,
      data: allData,
      count: allData.length,
      hours_filtered: hours,
      types_included: includeTypes,
      source: 'FDA RSS Feed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA RSS All API Error:', error);
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

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/all')[0];
}

// src/app/api/fda/drug-approvals/route.js - RSS filtered for drug approvals
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const hours = parseInt(searchParams.get('hours') || '1');

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching drug approvals from RSS feed for last ${hours} hours`);
    
    // Get RSS data and filter for drug approvals
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit * 2}&hours=${hours}`);
    
    if (!rssResponse.ok) {
      throw new Error(`RSS endpoint failed: ${rssResponse.status}`);
    }
    
    const rssResult = await rssResponse.json();
    
    if (!rssResult.success) {
      throw new Error(rssResult.error || 'RSS feed parsing failed');
    }

    // Filter for drug approvals only
    const drugApprovals = (rssResult.data || [])
      .filter(item => item.announcement_type === 'drug_approval')
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: drugApprovals,
      count: drugApprovals.length,
      hours_filtered: hours,
      source: 'FDA RSS Feed - Drug Approvals Only',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Drug Approvals RSS Error:', error);
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

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/drug-approvals')[0];
}

// src/app/api/fda/safety-alerts/route.js - RSS filtered for safety alerts
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const hours = parseInt(searchParams.get('hours') || '1');

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching safety alerts from RSS feed for last ${hours} hours`);
    
    // Get RSS data and filter for safety alerts
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit * 2}&hours=${hours}`);
    
    if (!rssResponse.ok) {
      throw new Error(`RSS endpoint failed: ${rssResponse.status}`);
    }
    
    const rssResult = await rssResponse.json();
    
    if (!rssResult.success) {
      throw new Error(rssResult.error || 'RSS feed parsing failed');
    }

    // Filter for safety alerts only
    const safetyAlerts = (rssResult.data || [])
      .filter(item => item.announcement_type === 'safety_alert')
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: safetyAlerts,
      count: safetyAlerts.length,
      hours_filtered: hours,
      source: 'FDA RSS Feed - Safety Alerts Only',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Safety Alerts RSS Error:', error);
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

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/safety-alerts')[0];
}

// src/app/api/fda/device-approvals/route.js - RSS filtered for device approvals
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');  
    const hours = parseInt(searchParams.get('hours') || '1');

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching device approvals from RSS feed for last ${hours} hours`);
    
    // Get RSS data and filter for device approvals
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit * 2}&hours=${hours}`);
    
    if (!rssResponse.ok) {
      throw new Error(`RSS endpoint failed: ${rssResponse.status}`);
    }
    
    const rssResult = await rssResponse.json();
    
    if (!rssResult.success) {
      throw new Error(rssResult.error || 'RSS feed parsing failed');
    }

    // Filter for device approvals only
    const deviceApprovals = (rssResult.data || [])
      .filter(item => item.announcement_type === 'device_approval')
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: deviceApprovals,
      count: deviceApprovals.length,
      hours_filtered: hours,
      source: 'FDA RSS Feed - Device Approvals Only',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Device Approvals RSS Error:', error);
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

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/device-approvals')[0];
}