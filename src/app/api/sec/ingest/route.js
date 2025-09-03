// src/app/api/sec/ingest/route.js - SEC Filing Ingestion with AI public company filtering
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
    try {
        const { limit = 40, timeframe = '1h' } = await request.json();

        console.log(`Starting SEC EDGAR ingestion: ${timeframe} timeframe`);

        // Get or create SEC data source
        const dataSource = await ensureSECDataSource();
        if (!dataSource) {
            throw new Error('Failed to initialize SEC EDGAR data source');
        }

        // Fetch SEC RSS data
        const response = await fetch(`${getBaseUrl(request)}/api/sec/rss-feed?limit=${limit}&timeframe=${timeframe}`);
        if (!response.ok) {
            throw new Error(`SEC RSS endpoint failed: ${response.status}`);
        }

        const result = await response.json();
        const secData = result.success ? result.data : [];

        if (secData.length === 0) {
            return NextResponse.json({
                success: true,
                message: `No SEC filings found in the last ${timeframe}`,
                ingested: 0,
                timeframe: timeframe,
                data_source: 'SEC EDGAR RSS'
            });
        }

        console.log(`Retrieved ${secData.length} SEC filings, filtering for public companies...`);

        // AI Pre-Filter for Public Companies Only
        const publicCompanies = await filterPublicCompanies(secData);

        if (publicCompanies.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No public companies found in SEC filing batch',
                ingested: 0,
                filtered_out: secData.length,
                total_processed: secData.length,
                timeframe: timeframe
            });
        }

        console.log(`Filtered to ${publicCompanies.length} public companies from SEC filings`);

        // Ingest public companies
        const ingestResults = await Promise.allSettled(
            publicCompanies.map(item => ingestSECFiling(item, dataSource.id))
        );

        // Count results
        let successful = 0;
        let failed = 0;
        const errors = [];

        ingestResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                successful++;
            } else {
                failed++;
                errors.push({
                    item_id: publicCompanies[index].id,
                    company: publicCompanies[index].company_name,
                    form_type: publicCompanies[index].form_type,
                    error: result.status === 'fulfilled' ? result.value.error : result.reason.message
                });
            }
        });

        console.log(`SEC ingestion complete: ${successful} successful, ${failed} failed`);

        return NextResponse.json({
            success: true,
            ingested: successful,
            failed: failed,
            filtered_out: secData.length - publicCompanies.length,
            total_processed: secData.length,
            public_companies_found: publicCompanies.length,
            timeframe: timeframe,
            data_source: 'SEC EDGAR RSS',
            errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('SEC EDGAR Ingestion Error:', error);
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

// Ensure SEC data source exists
async function ensureSECDataSource() {
    try {
        const { data: existingSource } = await supabase
            .from('data_sources')
            .select('*')
            .eq('source_name', 'SEC EDGAR RSS')
            .single();

        if (existingSource) return existingSource;

        const { data: newSource, error } = await supabase
            .from('data_sources')
            .insert({
                source_name: 'SEC EDGAR RSS',
                source_type: 'rss',
                api_config: {
                    rss_url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&CIK=&type=&company=&dateb=&owner=include&start=0&count=40&output=atom',
                    feed_type: 'sec_edgar',
                    update_frequency: '1min',
                    real_time: true
                },
                is_active: true,
                processing_config: {
                    ai_filtering: true,
                    public_companies_only: true,
                    min_relevance_score: 40,
                    batch_size: 4,
                    real_time_processing: true
                }
            })
            .select()
            .single();

        if (error) throw error;
        console.log('Created SEC EDGAR data source');
        return newSource;
    } catch (error) {
        console.error('Error ensuring SEC data source:', error);
        return null;
    }
}

// Enhanced public company filtering for SEC filings
async function filterPublicCompanies(secData) {
    try {
        const companiesToCheck = secData
            .filter(item => item.company_name)
            .map(item => ({
                sec_id: item.id,
                company_name: item.company_name,
                form_type: item.form_type,
                filing_type: item.filing_type,
                ticker: item.ticker,
                cik: item.cik,
                title: item.title
            }));

        if (companiesToCheck.length === 0) return [];

        const batchSize = 15;
        const filteredCompanies = [];

        for (let i = 0; i < companiesToCheck.length; i += batchSize) {
            const batch = companiesToCheck.slice(i, i + batchSize);
            const batchResults = await aiFilterCompanyBatch(batch);
            filteredCompanies.push(...batchResults);

            if (i + batchSize < companiesToCheck.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        const publicCompanyMap = new Map();
        filteredCompanies
            .filter(result => result.is_public)
            .forEach(result => {
                publicCompanyMap.set(result.sec_id, {
                    ticker: result.ticker,
                    company_name: result.company_name,
                    exchange: result.exchange
                });
            });

        const publicSECData = secData.filter(item =>
            publicCompanyMap.has(item.id)
        );

        publicSECData.forEach(item => {
            const publicInfo = publicCompanyMap.get(item.id);
            if (publicInfo) {
                item.detected_ticker = publicInfo.ticker;
                item.verified_company_name = publicInfo.company_name;
                item.detected_exchange = publicInfo.exchange;
            }
        });

        return publicSECData;
    } catch (error) {
        console.error('Error in SEC public company filtering:', error);
        return secData; // Fallback
    }
}

// AI filtering for SEC companies
async function aiFilterCompanyBatch(companyBatch) {
    try {
        const companyList = companyBatch.map((company, index) =>
            `${index + 1}. SEC_ID: "${company.sec_id}", Company: "${company.company_name}", Form: ${company.form_type}, Type: ${company.filing_type}, CIK: ${company.cik}, Ticker: ${company.ticker || 'Unknown'}, Title: "${company.title}"`
        ).join('\n');

        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1500,
            temperature: 0.1,
            system: `I analyze companies from SEC EDGAR filings for public trading status.

CRITICAL: I will return ONLY a valid JSON array with exactly the requested number of objects.

Format: {"sec_id": "exact-id", "company_name": "name", "is_public": true/false, "ticker": "SYMBOL"/null, "exchange": "NYSE"/"NASDAQ"/"OTC"/null}

Special considerations:
- SEC filings are from public companies, but some may be subsidiaries
- Look for major publicly traded companies and their known tickers
- Include penny stocks (OTC markets)
- Many SEC filings will have ticker symbols already provided

I return JSON array only without any additional text or formatting.`,
            messages: [{
                role: "user",
                content: `Analyze these ${companyBatch.length} companies from SEC filings for public trading status:

${companyList}`
            }]
        });

        const response = message.content[0].text.trim();
        const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
        const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
        const results = JSON.parse(jsonMatch ? jsonMatch[0] : cleanResponse);

        return results.map((result, index) => ({
            sec_id: result.sec_id || companyBatch[index]?.sec_id,
            company_name: result.company_name || companyBatch[index]?.company_name,
            is_public: Boolean(result.is_public),
            ticker: result.ticker && result.ticker !== 'null' ? result.ticker.toUpperCase() : null,
            exchange: result.exchange && result.exchange !== 'null' ? result.exchange.toUpperCase() : null
        }));

    } catch (error) {
        console.error('SEC AI filtering error:', error);
        return companyBatch.map(company => ({
            sec_id: company.sec_id,
            company_name: company.company_name,
            is_public: true,
            ticker: company.ticker || null,
            exchange: null
        }));
    }
}

// Ingest SEC filing into database
async function ingestSECFiling(secItem, sourceId) {
    try {
        const filingData = {
            sec_id: secItem.id,
            filing_type: secItem.filing_type,
            form_type: secItem.form_type,
            title: secItem.title,
            summary: secItem.summary,
            description: secItem.description,
            company_name: secItem.company_name,
            ticker: secItem.ticker,
            cik: secItem.cik,
            accession_number: secItem.accession_number,
            filing_date: secItem.filing_date,
            priority: secItem.priority,
            link: secItem.link,
            source_id: sourceId,
            raw_data: {
                ...secItem.raw_data,
                detected_ticker: secItem.detected_ticker,
                verified_company_name: secItem.verified_company_name,
                detected_exchange: secItem.detected_exchange,
                filing_date_full: secItem.filing_date_full
            }
        };

        const { data: existing } = await supabase
            .from('sec_filings')
            .select('id')
            .eq('sec_id', secItem.id)
            .single();

        let filingId;

        if (existing) {
            const { data } = await supabase
                .from('sec_filings')
                .update(filingData)
                .eq('sec_id', secItem.id)
                .select('id')
                .single();
            filingId = data.id;
            console.log(`Updated existing SEC filing: ${secItem.id}`);
        } else {
            const { data } = await supabase
                .from('sec_filings')
                .insert(filingData)
                .select('id')
                .single();
            filingId = data.id;
            console.log(`Created new SEC filing: ${secItem.id} (${secItem.form_type} from ${secItem.company_name})`);
        }

        // Add to processing queue
        await supabase
            .from('processing_queue')
            .insert({
                sec_filing_id: filingId,
                source_id: sourceId,
                status: 'pending'
            });

        return { success: true, id: filingId };
    } catch (error) {
        console.error(`Error ingesting SEC filing ${secItem.id}:`, error);
        return { success: false, error: error.message };
    }
}

function getBaseUrl(request) {
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }
    return request.url.split('/api/sec/ingest')[0];
}