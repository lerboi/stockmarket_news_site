// src/app/api/sec-news/route.js - Returns processed SEC news from database
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
        const timeframe = searchParams.get('timeframe') || '1h';

        console.log(`Fetching processed SEC news: limit=${limit}, offset=${offset}, priority=${priority}, category=${category}, timeframe=${timeframe}`);

        // Calculate time cutoff
        const cutoffTime = calculateTimeframe(timeframe);

        // Build query for processed SEC news
        let query = supabase
            .from('processed_news')
            .select(`
        id,
        sec_filing_id,
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
        sec_filings!inner (
          id,
          sec_id,
          filing_type,
          form_type,
          title,
          summary,
          description,
          company_name,
          ticker,
          cik,
          accession_number,
          filing_date,
          priority,
          link,
          raw_data
        )
      `)
            .eq('is_published', true)
            .not('sec_filing_id', 'is', null)
            .gte('published_at', cutoffTime.toISOString())
            .order('published_at', { ascending: false });

        // Apply priority filter
        if (priority !== 'all') {
            query = query.eq('priority_level', priority);
        }

        // Apply category filter
        if (category !== 'all') {
            query = query.eq('sec_filings.filing_type', category);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data: processedNews, error } = await query;

        if (error) {
            console.error('SEC Database query error:', error);
            throw error;
        }

        if (!processedNews || processedNews.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                count: 0,
                message: `No processed SEC news found for timeframe: ${timeframe}`,
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

        // Transform processed SEC data for frontend
        const transformedNews = processedNews.map(item => {
            const filing = item.sec_filings;
            const rawData = filing.raw_data || {};

            return {
                // Core identification
                id: item.id,
                secId: filing.sec_id,
                secFilingId: item.sec_filing_id,

                // Display content
                title: filing.title,
                summary: item.ai_summary || filing.summary?.substring(0, 200) + '...' || 'No summary available',
                description: filing.description || filing.summary,

                // Classification
                priority: item.priority_level,
                category: filing.filing_type,
                formType: filing.form_type,

                // Timing - Use RSS filing date, not processing date
                timestamp: new Date(rawData.filing_date_full || filing.filing_date || item.published_at).toLocaleTimeString(),
                filingDate: filing.filing_date,
                publishedAt: item.published_at,

                // Stock information
                ticker: item.stock_ticker || filing.ticker,
                exchange: item.stock_exchange,
                companyName: filing.company_name ||
                    rawData.verified_company_name ||
                    'Unknown Company',

                // SEC specific data
                cik: filing.cik,
                accessionNumber: filing.accession_number,
                filingLink: filing.link,

                // AI Analysis
                sentiment: item.sentiment,
                sentimentStrength: item.sentiment_strength,
                relevanceScore: item.relevance_score,
                marketImpact: item.market_impact_assessment,

                // Source information
                source: 'SEC EDGAR',

                // Additional data
                tags: item.tags || [filing.filing_type, 'sec', filing.form_type.toLowerCase()],

                // Detected information
                detectedTicker: rawData.detected_ticker,
                detectedExchange: rawData.detected_exchange,
                verifiedCompanyName: rawData.verified_company_name
            };
        });

        console.log(`Returning ${transformedNews.length} processed SEC news items`);

        // Calculate stats for response
        const stats = calculateSECNewsStats(transformedNews);

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
            source: 'Processed SEC News (EDGAR RSS Feed)',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Processed SEC News API Error:', error);
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

// Calculate cutoff time based on ultra-short timeframes
function calculateTimeframe(timeframe) {
    const now = new Date();
    const cutoffTime = new Date(now);

    switch (timeframe) {
        case '1min':
            cutoffTime.setMinutes(cutoffTime.getMinutes() - 1);
            break;
        case '10min':
            cutoffTime.setMinutes(cutoffTime.getMinutes() - 10);
            break;
        case '1h':
            cutoffTime.setHours(cutoffTime.getHours() - 1);
            break;
        case '6h':
            cutoffTime.setHours(cutoffTime.getHours() - 6);
            break;
        case '24h':
            cutoffTime.setHours(cutoffTime.getHours() - 24);
            break;
        default:
            // Default to 1 hour
            cutoffTime.setHours(cutoffTime.getHours() - 1);
    }

    return cutoffTime;
}

// Calculate SEC news statistics
function calculateSECNewsStats(newsItems) {
    if (newsItems.length === 0) {
        return {
            total: 0,
            sentiment: { bullish: 0, bearish: 0, neutral: 0 },
            priority: { high: 0, medium: 0, low: 0 },
            filingTypes: {},
            formTypes: {}
        };
    }

    const stats = {
        total: newsItems.length,
        sentiment: { bullish: 0, bearish: 0, neutral: 0 },
        priority: { high: 0, medium: 0, low: 0 },
        filingTypes: {},
        formTypes: {},
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

        // Filing Types
        if (item.category) {
            stats.filingTypes[item.category] = (stats.filingTypes[item.category] || 0) + 1;
        }

        // Form Types
        if (item.formType) {
            stats.formTypes[item.formType] = (stats.formTypes[item.formType] || 0) + 1;
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