// src/app/api/fda/all/route.js - Updated for multiple RSS sources and time options
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeframe = searchParams.get('timeframe') || '24h'; // 24h, 1w, 1m
    const includeTypes = searchParams.get('types')?.split(',') || ['drug_approval', 'safety_alert', 'device_approval', 'regulatory'];

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching FDA Multi-RSS data for timeframe: ${timeframe}, limit ${limit}`);
    
    // Fetch from our enhanced RSS endpoint (both sources)
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit}&timeframe=${timeframe}`);
    
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

    // Generate source breakdown
    const sourceBreakdown = getSourceBreakdown(allData);

    console.log(`Returning ${allData.length} recent FDA Multi-RSS announcements`);

    return NextResponse.json({
      success: true,
      data: allData,
      count: allData.length,
      total_found: rssResult.total_found || allData.length,
      timeframe: timeframe,
      types_included: includeTypes,
      sources: rssResult.sources || ['FDA Press Releases', 'FDA MedWatch Alerts'],
      source_breakdown: sourceBreakdown,
      cutoff_time: rssResult.cutoff_time,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Multi-RSS All API Error:', error);
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

// Get breakdown of items by source
function getSourceBreakdown(items) {
  const breakdown = {
    'FDA Press Releases': 0,
    'FDA MedWatch Alerts': 0,
    'Other': 0
  };

  items.forEach(item => {
    if (item.source) {
      if (item.source.includes('Press Releases')) {
        breakdown['FDA Press Releases']++;
      } else if (item.source.includes('MedWatch')) {
        breakdown['FDA MedWatch Alerts']++;
      } else {
        breakdown['Other']++;
      }
    } else {
      breakdown['Other']++;
    }
  });

  return breakdown;
}

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/all')[0];
}

// Enhanced endpoint variations for specific feed types

// FDA Press Releases Only
export async function GET_PRESS_RELEASES(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const timeframe = searchParams.get('timeframe') || '24h';

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching FDA Press Releases only for timeframe: ${timeframe}`);
    
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit * 2}&timeframe=${timeframe}`);
    
    if (!rssResponse.ok) {
      throw new Error(`RSS endpoint failed: ${rssResponse.status}`);
    }
    
    const rssResult = await rssResponse.json();
    
    if (!rssResult.success) {
      throw new Error(rssResult.error || 'RSS feed parsing failed');
    }

    // Filter for press releases only
    const pressReleases = (rssResult.data || [])
      .filter(item => item.source && item.source.includes('Press Releases'))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: pressReleases,
      count: pressReleases.length,
      timeframe: timeframe,
      source: 'FDA Press Releases Only',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Press Releases Error:', error);
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

// FDA MedWatch Alerts Only
export async function GET_MEDWATCH_ALERTS(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const timeframe = searchParams.get('timeframe') || '24h';

    const baseUrl = getBaseUrl(request);
    
    console.log(`Fetching FDA MedWatch Alerts only for timeframe: ${timeframe}`);
    
    const rssResponse = await fetch(`${baseUrl}/api/fda/rss-feed?limit=${limit * 2}&timeframe=${timeframe}`);
    
    if (!rssResponse.ok) {
      throw new Error(`RSS endpoint failed: ${rssResponse.status}`);
    }
    
    const rssResult = await rssResponse.json();
    
    if (!rssResult.success) {
      throw new Error(rssResult.error || 'RSS feed parsing failed');
    }

    // Filter for MedWatch alerts only
    const medWatchAlerts = (rssResult.data || [])
      .filter(item => item.source && item.source.includes('MedWatch'))
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: medWatchAlerts,
      count: medWatchAlerts.length,
      timeframe: timeframe,
      source: 'FDA MedWatch Alerts Only',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA MedWatch Alerts Error:', error);
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