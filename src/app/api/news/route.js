// src/app/api/news/route.js - Returns processed news from database (RSS-sourced)
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
    const timeframe = searchParams.get('timeframe') || '24h';

    console.log(`Fetching processed RSS news: limit=${limit}, offset=${offset}, priority=${priority}, category=${category}, timeframe=${timeframe}`);

    // Calculate time cutoff
    const cutoffTime = calculateTimeframe(timeframe);

    // Build query for processed RSS news
    let query = supabase
      .from('processed_news')
      .select(`
        id,
        fda_announcement_id,
        stock_ticker,
        stock_exchange,
        relevance_score,
        priority_level,
        sentiment,
        sentiment_strength,
        ai_summary,
        market_impact_assessment,
        tags,
        is_published,
        published_at,
        created_at,
        fda_announcements!inner (
          id,
          fda_id,
          title,
          description,
          sponsor_name,
          product_name,
          announcement_date,
          announcement_type,
          classification,
          raw_data
        )
      `)
      .eq('is_published', true)
      .gte('published_at', cutoffTime.toISOString())
      .order('published_at', { ascending: false });

    // Apply priority filter
    if (priority !== 'all') {
      query = query.eq('priority_level', priority);
    }

    // Apply category filter
    if (category !== 'all') {
      query = query.eq('fda_announcements.announcement_type', category);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: processedNews, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }

    if (!processedNews || processedNews.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: `No processed RSS news found for timeframe: ${timeframe}`,
        timeframe: timeframe,
        cutoff_time: cutoffTime.toISOString(),
        filters: {
          priority: priority,
          category: category,
          limit: limit,
          offset: offset
        },
        timestamp: new Date().toISOString()
      });
    }

    // Transform processed RSS data for frontend
    const transformedNews = processedNews.map(item => {
      const announcement = item.fda_announcements;
      const rawData = announcement.raw_data || {};

      return {
        // Core identification
        id: item.id,
        fdaId: announcement.fda_id,
        fdaAnnouncementId: item.fda_announcement_id,

        // Display content
        title: announcement.title,
        summary: item.ai_summary || announcement.description?.substring(0, 200) + '...' || 'No summary available',
        description: announcement.description,

        // Classification
        priority: item.priority_level,
        category: announcement.announcement_type,
        classification: announcement.classification,

        // Timing
        timestamp: new Date(rawData.pub_date_full || announcement.announcement_date || item.published_at).toLocaleString(), announcementDate: announcement.announcement_date,
        publishedAt: item.published_at,

        // Stock information
        ticker: item.stock_ticker,
        exchange: item.stock_exchange,
        companyName: announcement.sponsor_name ||
          rawData.verified_company_name ||
          'Unknown Company',

        // AI Analysis
        sentiment: item.sentiment,
        sentimentStrength: item.sentiment_strength,
        relevanceScore: item.relevance_score,
        marketImpact: item.market_impact_assessment,

        // Source information
        source: rawData.rss_source === 'press_releases' ? 'FDA Press Releases' :
          rawData.rss_source === 'medwatch_alerts' ? 'FDA MedWatch Alerts' :
            rawData.rss_source || 'FDA RSS',
        feedType: rawData.feed_type,

        // Additional data
        productName: announcement.product_name,
        tags: item.tags || [announcement.announcement_type, 'fda', 'rss'],

        // RSS metadata
        pubDateFull: rawData.pub_date_full,
        rssLink: rawData.link,

        // Detected information
        detectedTicker: rawData.detected_ticker,
        detectedExchange: rawData.detected_exchange,
        verifiedCompanyName: rawData.verified_company_name
      };
    });

    console.log(`Returning ${transformedNews.length} processed RSS news items`);

    // Calculate stats for response
    const stats = calculateNewsStats(transformedNews);

    return NextResponse.json({
      success: true,
      data: transformedNews,
      count: transformedNews.length,
      timeframe: timeframe,
      cutoff_time: cutoffTime.toISOString(),
      filters: {
        priority: priority,
        category: category,
        limit: limit,
        offset: offset
      },
      stats: stats,
      source: 'Processed RSS News (FDA Press Releases + MedWatch Alerts)',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Processed RSS News API Error:', error);
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

// Calculate cutoff time based on timeframe
function calculateTimeframe(timeframe) {
  const now = new Date();
  const cutoffTime = new Date(now);

  switch (timeframe) {
    case '24h':
      cutoffTime.setHours(cutoffTime.getHours() - 24);
      break;
    case '1w':
      cutoffTime.setDate(cutoffTime.getDate() - 7);
      break;
    case '1m':
      cutoffTime.setMonth(cutoffTime.getMonth() - 1);
      break;
    case '3m':
      cutoffTime.setMonth(cutoffTime.getMonth() - 3);
      break;
    default:
      // Default to 24 hours
      cutoffTime.setHours(cutoffTime.getHours() - 24);
  }

  return cutoffTime;
}

// Calculate news statistics
function calculateNewsStats(newsItems) {
  if (newsItems.length === 0) {
    return {
      total: 0,
      sentiment: { bullish: 0, bearish: 0, neutral: 0 },
      priority: { high: 0, medium: 0, low: 0 },
      categories: {},
      sources: {}
    };
  }

  const stats = {
    total: newsItems.length,
    sentiment: { bullish: 0, bearish: 0, neutral: 0 },
    priority: { high: 0, medium: 0, low: 0 },
    categories: {},
    sources: {},
    averageRelevance: 0,
    averageSentimentStrength: 0,
    withTickers: 0
  };

  let totalRelevance = 0;
  let totalSentimentStrength = 0;

  newsItems.forEach(item => {
    // Sentiment
    if (item.sentiment && stats.sentiment[item.sentiment] !== undefined) {
      stats.sentiment[item.sentiment]++;
    }

    // Priority
    if (item.priority && stats.priority[item.priority] !== undefined) {
      stats.priority[item.priority]++;
    }

    // Categories
    if (item.category) {
      stats.categories[item.category] = (stats.categories[item.category] || 0) + 1;
    }

    // Sources
    if (item.source) {
      stats.sources[item.source] = (stats.sources[item.source] || 0) + 1;
    }

    // Averages
    totalRelevance += item.relevanceScore || 0;
    totalSentimentStrength += item.sentimentStrength || 0;

    // Tickers
    if (item.ticker) {
      stats.withTickers++;
    }
  });

  // Calculate averages
  stats.averageRelevance = Math.round(totalRelevance / newsItems.length);
  stats.averageSentimentStrength = Math.round(totalSentimentStrength / newsItems.length);

  return stats;
}