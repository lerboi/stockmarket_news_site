// src/app/api/sec/all/route.js - Returns processed SEC filing data
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '40');
        const timeframe = searchParams.get('timeframe') || '1h'; // 1min, 10min, 1h
        const includeTypes = searchParams.get('types')?.split(',') || ['major_event', 'insider_trading', 'stock_offering', 'quarterly_report', 'annual_report'];

        const baseUrl = getBaseUrl(request);

        console.log(`Fetching SEC EDGAR data for timeframe: ${timeframe}, limit ${limit}`);

        // Fetch from SEC RSS endpoint
        const rssResponse = await fetch(`${baseUrl}/api/sec/rss-feed?limit=${limit}&timeframe=${timeframe}`);

        if (!rssResponse.ok) {
            throw new Error(`SEC RSS endpoint failed: ${rssResponse.status}`);
        }

        const rssResult = await rssResponse.json();

        if (!rssResult.success) {
            throw new Error(rssResult.error || 'SEC RSS feed parsing failed');
        }

        let allData = rssResult.data || [];

        // Filter by filing types if specified
        if (includeTypes.length > 0 && !includeTypes.includes('all')) {
            allData = allData.filter(item => includeTypes.includes(item.filing_type));
        }

        // Sort by filing date (most recent first)
        allData.sort((a, b) => {
            const dateA = new Date(a.filing_date_full || 0);
            const dateB = new Date(b.filing_date_full || 0);
            return dateB - dateA;
        });

        // Apply final limit
        allData = allData.slice(0, limit);

        // Generate filing type breakdown
        const filingBreakdown = getFilingBreakdown(allData);

        console.log(`Returning ${allData.length} recent SEC EDGAR filings`);

        return NextResponse.json({
            success: true,
            data: allData,
            count: allData.length,
            total_found: rssResult.count || allData.length,
            timeframe: timeframe,
            types_included: includeTypes,
            source: 'SEC EDGAR RSS Feed',
            filing_breakdown: filingBreakdown,
            cutoff_time: rssResult.cutoff_time,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('SEC EDGAR All API Error:', error);
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

// Get breakdown of items by filing type
function getFilingBreakdown(items) {
    const breakdown = {
        'major_event': 0,
        'merger_acquisition': 0,
        'leadership_change': 0,
        'insider_trading': 0,
        'stock_offering': 0,
        'quarterly_report': 0,
        'annual_report': 0,
        'proxy_statement': 0,
        'other_filing': 0
    };

    items.forEach(item => {
        if (item.filing_type && breakdown.hasOwnProperty(item.filing_type)) {
            breakdown[item.filing_type]++;
        } else {
            breakdown['other_filing']++;
        }
    });

    return breakdown;
}

function getBaseUrl(request) {
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }
    return request.url.split('/api/sec/all')[0];
}