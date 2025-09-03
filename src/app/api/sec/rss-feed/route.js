// src/app/api/sec/rss-feed/route.js - SEC EDGAR RSS Parser with ultra-short timeframes
import { NextResponse } from 'next/server';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

// SEC EDGAR RSS Feed URL
const SEC_EDGAR_RSS_URL = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=40&output=atom';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '40');
        const timeframe = searchParams.get('timeframe') || '1h'; // 1min, 10min, 1h

        console.log(`Fetching SEC EDGAR RSS feed for timeframe: ${timeframe}...`);

        // Calculate time cutoff based on ultra-short timeframes
        const cutoffTime = calculateTimeframe(timeframe);

        // Fetch SEC RSS feed with proper headers
        const response = await fetch(SEC_EDGAR_RSS_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/atom+xml, application/xml, text/xml, */*',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            },
            timeout: 30000,
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`SEC RSS feed returned ${response.status}: ${response.statusText}`);
        }

        const rssText = await response.text();

        if (!rssText || rssText.trim().length === 0) {
            throw new Error('Empty response from SEC RSS feed');
        }

        // Parse ATOM feed (SEC uses ATOM format, not RSS)
        const parsedFeed = await parseXML(rssText);

        if (!parsedFeed.feed || !parsedFeed.feed.entry) {
            throw new Error('Invalid SEC EDGAR feed structure');
        }

        const entries = parsedFeed.feed.entry;

        // Filter by time and transform entries
        const recentFilings = entries
            .filter(entry => {
                const updatedDate = new Date(entry.updated?.[0] || 0);
                return updatedDate > cutoffTime;
            })
            .slice(0, limit)
            .map((entry, index) => transformSECEntry(entry, index));

        console.log(`Found ${recentFilings.length} recent SEC filings`);

        if (recentFilings.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                count: 0,
                message: `No SEC filings found in the last ${timeframe}`,
                timeframe: timeframe,
                cutoff_time: cutoffTime.toISOString(),
                timestamp: new Date().toISOString()
            });
        }

        // Sort by filing date (most recent first)
        recentFilings.sort((a, b) => {
            const dateA = new Date(a.filing_date_full || 0);
            const dateB = new Date(b.filing_date_full || 0);
            return dateB - dateA;
        });

        console.log(`Returning ${recentFilings.length} SEC EDGAR filings`);

        return NextResponse.json({
            success: true,
            data: recentFilings,
            count: recentFilings.length,
            total_found: recentFilings.length,
            timeframe: timeframe,
            cutoff_time: cutoffTime.toISOString(),
            source: 'SEC EDGAR RSS Feed',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('SEC EDGAR RSS Feed Error:', error);
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
        default:
            // Default to 1 hour
            cutoffTime.setHours(cutoffTime.getHours() - 1);
    }

    return cutoffTime;
}

// Transform SEC ATOM entry to our format
function transformSECEntry(entry, index) {
    const title = entry.title?.[0] || 'SEC Filing';
    const summary = entry.summary?.[0] || '';
    const link = entry.link?.[0]?.$.href || '';
    const updated = entry.updated?.[0];
    const category = entry.category?.[0]?.$.term || '';

    // Parse the full filing timestamp
    const filingDateFull = updated ? new Date(updated) : new Date();

    // Extract company info from title (format: "Company Name - Form Type")
    const { companyName, formType, ticker, cik } = parseCompanyInfo(title, summary, link);

    // Determine filing type and priority
    const filingType = categorizeFilingType(formType, title, summary);
    const priority = determinePriority(formType, filingType);

    return {
        id: `sec-${Date.now()}-${index}`,
        title: title,
        summary: String(summary || '').substring(0, 500), // Truncate long summaries
        description: summary,
        link: link,
        updated: updated,
        filing_date_full: filingDateFull.toISOString(),
        filing_date: filingDateFull.toISOString(),
        filing_type: filingType,
        form_type: formType,
        priority: priority,
        source: 'SEC EDGAR',
        category: filingType,
        company_name: companyName,
        ticker: ticker,
        cik: cik,
        accession_number: extractAccessionNumber(link),
        raw_data: {
            original_title: title,
            original_summary: summary,
            link: link,
            updated: updated,
            filing_date_full: filingDateFull.toISOString(),
            category: category,
            form_type: formType,
            parsed_company: companyName,
            parsed_ticker: ticker,
            parsed_cik: cik
        }
    };
}

// Parse company information from SEC filing title and content
function parseCompanyInfo(title, summary, link) {
    let companyName = null;
    let formType = null;
    let ticker = null;
    let cik = null;

    // Ensure title and summary are strings
    const titleStr = String(title || '');
    const summaryStr = String(summary || '');

    // Extract form type from title (e.g., "APPLE INC - Form 8-K")
    const formMatch = titleStr.match(/- Form ([A-Z0-9-\/]+)/i);
    if (formMatch) {
        formType = formMatch[1];
        companyName = titleStr.split(' - Form')[0].trim();
    }

    // Extract ticker if present (often in parentheses)
    const tickerMatch = titleStr.match(/\(([A-Z]{1,5})\)/);
    if (tickerMatch) {
        ticker = tickerMatch[1];
    }

    // Extract CIK from link
    const cikMatch = link.match(/CIK=(\d+)/i);
    if (cikMatch) {
        cik = cikMatch[1];
    }

    // Fallback: try to extract company name from beginning of title
    if (!companyName) {
        const parts = titleStr.split(' - ');
        if (parts.length > 0) {
            companyName = parts[0].trim();
        }
    }

    return {
        companyName: companyName || null,
        formType: formType || 'UNKNOWN',
        ticker: ticker || null,
        cik: cik || null
    };
}

// Categorize SEC filing types
function categorizeFilingType(formType, title, summary) {
    if (!formType) return 'other_filing';

    // Ensure title and summary are strings
    const form = String(formType || '').toLowerCase();
    const content = (String(title || '') + ' ' + String(summary || '')).toLowerCase();

    // Major event filings
    if (form.includes('8-k')) {
        if (content.includes('merger') || content.includes('acquisition')) {
            return 'merger_acquisition';
        }
        if (content.includes('ceo') || content.includes('cfo') || content.includes('leadership')) {
            return 'leadership_change';
        }
        return 'major_event';
    }

    // Insider trading
    if (form.includes('4')) {
        return 'insider_trading';
    }

    // Stock offerings
    if (form.includes('s-1') || form.includes('s-3')) {
        return 'stock_offering';
    }

    // Financial reports
    if (form.includes('10-q')) {
        return 'quarterly_report';
    }
    if (form.includes('10-k')) {
        return 'annual_report';
    }

    // Proxy statements
    if (form.includes('def 14a') || form.includes('proxy')) {
        return 'proxy_statement';
    }

    return 'other_filing';
}

// Determine priority based on filing type
function determinePriority(formType, filingType) {
    const form = String(formType || '').toLowerCase();

    // High priority filings
    if (form.includes('8-k') ||
        form.includes('4') ||
        form.includes('s-1') ||
        form.includes('s-3') ||
        filingType === 'merger_acquisition' ||
        filingType === 'leadership_change' ||
        filingType === 'insider_trading' ||
        filingType === 'stock_offering') {
        return 'high';
    }

    // Medium priority filings
    if (form.includes('10-q') ||
        form.includes('10-k') ||
        filingType === 'quarterly_report' ||
        filingType === 'annual_report') {
        return 'medium';
    }

    return 'low';
}

// Extract accession number from SEC link
function extractAccessionNumber(link) {
    const accessionMatch = link.match(/AccessionNumber=([0-9-]+)/i);
    return accessionMatch ? accessionMatch[1] : null;
}