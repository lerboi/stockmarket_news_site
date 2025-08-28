// src/app/api/news/route.js
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
    const offset = parseInt(searchParams.get('offset') || '0'); // Changed from 'skip' to 'offset'
    const priority = searchParams.get('priority') || 'all';
    const category = searchParams.get('category') || 'all';
    const timeframe = searchParams.get('timeframe') || '24h';

    // Build query using direct table queries instead of the view for now
    let query = supabase
      .from('processed_news')
      .select(`
        id,
        stock_ticker,
        relevance_score,
        priority_level,
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
      .range(offset, offset + limit - 1); // Use range instead of limit for proper pagination

    // Apply filters
    if (priority !== 'all') {
      query = query.eq('priority_level', priority);
    }

    if (category !== 'all') {
      query = query.eq('fda_announcements.announcement_type', category);
    }

    // Apply timeframe filter
    const timeframeHours = {
      '1h': 1,
      '24h': 24,
      '3d': 72,
      '1w': 168
    };

    if (timeframeHours[timeframe]) {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - timeframeHours[timeframe]);
      query = query.gte('published_at', hoursAgo.toISOString());
    }

    const { data: newsItems, error, count } = await query;

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
      timestamp: formatTimestamp(item.published_at),
      ticker: item.stock_ticker,
      relevanceScore: item.relevance_score,
      source: 'FDA',
      marketImpact: item.market_impact_assessment,
      tags: item.tags || [],
      companyName: item.fda_announcements?.sponsor_name,
      announcementDate: item.fda_announcements?.announcement_date
    }));

    return NextResponse.json({
      success: true,
      data: transformedNews,
      count: transformedNews.length,
      offset: offset,
      limit: limit,
      hasMore: transformedNews.length === limit, // If we got full limit, there might be more
      filters: {
        priority,
        category, 
        timeframe
      },
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

// Format timestamp for display
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