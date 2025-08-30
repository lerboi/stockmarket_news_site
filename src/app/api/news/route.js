// src/app/api/news/route.js - Updated to support timeframe filtering
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const priority = searchParams.get('priority') || 'all';
    const category = searchParams.get('category') || 'all';
    const timeframe = searchParams.get('timeframe') || '24h'; // Changed from individual hours
    const sentiment = searchParams.get('sentiment') || 'all';

    // Build query using direct table queries
    let query = supabase
      .from('processed_news')
      .select(`
        id,
        stock_ticker,
        stock_exchange,
        relevance_score,
        priority_level,
        sentiment,
        sentiment_strength,
        ai_summary,
        market_impact_assessment,
        tags,
        published_at,
        fda_announcements!inner (
          title,
          description,
          sponsor_name,
          product_name,
          announcement_date,
          announcement_type
        )
      `)
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (priority !== 'all') {
      query = query.eq('priority_level', priority);
    }

    if (sentiment !== 'all') {
      query = query.eq('sentiment', sentiment);
    }

    if (category !== 'all') {
      query = query.eq('fda_announcements.announcement_type', category);
    }

    // Apply timeframe filter - now uses more flexible date range
    const cutoffTime = calculateTimeframeCutoff(timeframe);
    if (cutoffTime) {
      query = query.gte('published_at', cutoffTime.toISOString());
    }

    const { data: newsItems, error } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      throw error;
    }

    // Transform data for frontend
    const transformedNews = (newsItems || []).map(item => ({
      id: item.id,
      title: item.fda_announcements?.title || 'FDA Announcement',
      summary: item.ai_summary,
      priority: item.priority_level,
      category: mapCategoryForDisplay(item.fda_announcements?.announcement_type),
      timestamp: formatTimestamp(item.fda_announcements?.announcement_date), // Use RSS publication date, not our processing date
      ticker: item.stock_ticker,
      exchange: item.stock_exchange,
      sentiment: item.sentiment,
      sentimentStrength: item.sentiment_strength,
      source: 'FDA',
      marketImpact: item.market_impact_assessment,
      tags: item.tags || [],
      companyName: item.fda_announcements?.sponsor_name,
      announcementDate: item.fda_announcements?.announcement_date,
      publishedAt: item.published_at, // Keep our processing timestamp for reference
      rssPublicationDate: item.fda_announcements?.announcement_date // Explicit RSS date for clarity
    }));

    return NextResponse.json({
      success: true,
      data: transformedNews,
      count: transformedNews.length,
      offset: offset,
      limit: limit,
      hasMore: transformedNews.length === limit,
      filters: {
        priority,
        category,
        sentiment,
        timeframe
      },
      timeframe_cutoff: cutoffTime ? cutoffTime.toISOString() : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('News API Error:', error);
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

// Calculate cutoff time for timeframe filtering
function calculateTimeframeCutoff(timeframe) {
  const now = new Date();
  const cutoffTime = new Date(now);

  switch (timeframe) {
    case '24h':
      cutoffTime.setHours(cutoffTime.getHours() - 24);
      return cutoffTime;
    case '1w':
      cutoffTime.setDate(cutoffTime.getDate() - 7);
      return cutoffTime;
    case '1m':
      cutoffTime.setMonth(cutoffTime.getMonth() - 1);
      return cutoffTime;
    case 'all':
      return null; // No time filtering
    default:
      // Default to 24 hours for unknown timeframes
      cutoffTime.setHours(cutoffTime.getHours() - 24);
      return cutoffTime;
  }
}

// Map database categories to display-friendly names
function mapCategoryForDisplay(dbCategory) {
  const categoryMap = {
    'drug_approval': 'drug_approval',
    'safety_alert': 'safety_alert',
    'device_approval': 'device_approval',
    'regulatory': 'regulatory'
  };
  
  return categoryMap[dbCategory] || 'regulatory';
}

// Format timestamp for display with relative time
function formatTimestamp(isoString) {
  if (!isoString) return 'Unknown';
  
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch (error) {
    return 'Unknown';
  }
}