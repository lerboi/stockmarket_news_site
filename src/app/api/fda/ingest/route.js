// src/app/api/fda/ingest/route.js - Updated with full timestamp support
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
    const { limit = 50, timeframe = '24h' } = await request.json();

    console.log(`Starting FDA Multi-RSS ingestion: ${timeframe} timeframe`);

    // Get or create RSS data sources
    const dataSources = await ensureRSSDataSources();
    if (!dataSources || dataSources.length === 0) {
      throw new Error('Failed to initialize FDA RSS data sources');
    }

    // Fetch ALL RSS data from both sources
    const response = await fetch(`${getBaseUrl(request)}/api/fda/rss-feed?limit=${limit}&timeframe=${timeframe}`);
    if (!response.ok) {
      throw new Error(`FDA RSS endpoint failed: ${response.status}`);
    }
    
    const result = await response.json();
    const rssData = result.success ? result.data : [];

    if (rssData.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No FDA RSS announcements found in the last ${timeframe}`,
        ingested: 0,
        timeframe: timeframe,
        data_sources: ['FDA Press Releases', 'FDA MedWatch Alerts']
      });
    }

    console.log(`Retrieved ${rssData.length} FDA RSS announcements from both sources, filtering for public companies...`);

    // AI Pre-Filter for Public Companies Only
    const publicCompanies = await filterPublicCompanies(rssData);
    
    if (publicCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No public companies found in RSS batch',
        ingested: 0,
        filtered_out: rssData.length,
        total_processed: rssData.length,
        timeframe: timeframe,
        breakdown: getSourceBreakdown(rssData)
      });
    }

    console.log(`Filtered to ${publicCompanies.length} public companies from both RSS sources`);

    // Group by source for tracking
    const sourceBreakdown = getSourceBreakdown(publicCompanies);

    // Ingest public companies
    const ingestResults = await Promise.allSettled(
      publicCompanies.map(item => ingestRSSItem(item, getDataSourceId(dataSources, item.feed_type)))
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
          company: publicCompanies[index].sponsor_name,
          source: publicCompanies[index].source,
          error: result.status === 'fulfilled' ? result.value.error : result.reason.message
        });
      }
    });

    console.log(`Multi-RSS ingestion complete: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      ingested: successful,
      failed: failed,
      filtered_out: rssData.length - publicCompanies.length,
      total_processed: rssData.length,
      public_companies_found: publicCompanies.length,
      timeframe: timeframe,
      data_sources: ['FDA Press Releases', 'FDA MedWatch Alerts'],
      source_breakdown: sourceBreakdown,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Multi-RSS Ingestion Error:', error);
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

// Ensure both RSS data sources exist
async function ensureRSSDataSources() {
  try {
    const sources = [];

    // Press Releases Source
    const pressReleaseSource = await ensureSingleDataSource({
      source_name: 'FDA Press Releases',
      source_type: 'rss',
      api_config: {
        rss_url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
        feed_type: 'press_releases',
        update_frequency: '1h',
        real_time: true
      }
    });

    if (pressReleaseSource) sources.push(pressReleaseSource);

    // MedWatch Alerts Source
    const medWatchSource = await ensureSingleDataSource({
      source_name: 'FDA MedWatch Alerts',
      source_type: 'rss',
      api_config: {
        rss_url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml',
        feed_type: 'medwatch_alerts',
        update_frequency: '1h',
        real_time: true
      }
    });

    if (medWatchSource) sources.push(medWatchSource);

    return sources;
  } catch (error) {
    console.error('Error ensuring RSS data sources:', error);
    return null;
  }
}

// Helper to ensure single data source exists
async function ensureSingleDataSource(sourceConfig) {
  try {
    const { data: existingSource } = await supabase
      .from('data_sources')
      .select('*')
      .eq('source_name', sourceConfig.source_name)
      .single();

    if (existingSource) return existingSource;

    const { data: newSource, error } = await supabase
      .from('data_sources')
      .insert({
        ...sourceConfig,
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

    if (error) return null;
    console.log(`Created data source: ${sourceConfig.source_name}`);
    return newSource;
  } catch (error) {
    console.error(`Error with data source ${sourceConfig.source_name}:`, error);
    return null;
  }
}

// Get data source ID by feed type
function getDataSourceId(dataSources, feedType) {
  const sourceMap = {
    'press_releases': 'FDA Press Releases',
    'medwatch_alerts': 'FDA MedWatch Alerts'
  };

  const sourceName = sourceMap[feedType] || 'FDA Press Releases';
  const source = dataSources.find(s => s.source_name === sourceName);
  return source ? source.id : dataSources[0]?.id;
}

// Get breakdown of items by source
function getSourceBreakdown(items) {
  const breakdown = {
    press_releases: 0,
    medwatch_alerts: 0
  };

  items.forEach(item => {
    if (item.feed_type) {
      breakdown[item.feed_type] = (breakdown[item.feed_type] || 0) + 1;
    }
  });

  return {
    'FDA Press Releases': breakdown.press_releases,
    'FDA MedWatch Alerts': breakdown.medwatch_alerts
  };
}

// Enhanced public company filtering with feed-specific logic
async function filterPublicCompanies(rssData) {
  try {
    const companiesToCheck = rssData
      .filter(item => item.sponsor_name)
      .map(item => ({
        fda_id: item.id,
        company_name: item.sponsor_name,
        announcement_type: item.category || 'unknown',
        feed_type: item.feed_type,
        source: item.source,
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
        publicCompanyMap.set(result.fda_id, {
          ticker: result.ticker,
          company_name: result.company_name,
          exchange: result.exchange
        });
      });

    const publicRSSData = rssData.filter(item => 
      publicCompanyMap.has(item.id)
    );

    publicRSSData.forEach(item => {
      const publicInfo = publicCompanyMap.get(item.id);
      if (publicInfo) {
        item.detected_ticker = publicInfo.ticker;
        item.verified_company_name = publicInfo.company_name;
        item.detected_exchange = publicInfo.exchange;
      }
    });

    return publicRSSData;
  } catch (error) {
    console.error('Error in public company filtering:', error);
    return rssData; // Fallback
  }
}

// Enhanced AI filtering with feed-type context
async function aiFilterCompanyBatch(companyBatch) {
  try {
    const companyList = companyBatch.map((company, index) => 
      `${index + 1}. RSS_ID: "${company.fda_id}", Company: "${company.company_name}", Type: ${company.announcement_type}, Source: ${company.source}, Title: "${company.title}"`
    ).join('\n');

    const prompt = `Analyze these companies from FDA RSS feeds (Press Releases + MedWatch Alerts) for public trading status.

CRITICAL: Return ONLY a valid JSON array with exactly ${companyBatch.length} objects.

Format: {"fda_id": "exact-id", "company_name": "name", "is_public": true/false, "ticker": "SYMBOL"/null, "exchange": "NYSE"/"NASDAQ"/"OTC"/null}

Special considerations:
- MedWatch alerts often mention smaller/generic manufacturers
- Press releases typically feature larger pharma companies
- Look for subsidiaries of major pharma companies
- Include penny stocks (OTC markets)

Companies:
${companyList}

Return JSON array only:`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    });

    const response = message.content[0].text.trim();
    const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
    const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch ? jsonMatch[0] : cleanResponse);

    return results.map((result, index) => ({
      fda_id: result.fda_id || companyBatch[index]?.fda_id,
      company_name: result.company_name || companyBatch[index]?.company_name,
      is_public: Boolean(result.is_public),
      ticker: result.ticker && result.ticker !== 'null' ? result.ticker.toUpperCase() : null,
      exchange: result.exchange && result.exchange !== 'null' ? result.exchange.toUpperCase() : null
    }));

  } catch (error) {
    console.error('AI filtering error:', error);
    return companyBatch.map(company => ({
      fda_id: company.fda_id,
      company_name: company.company_name,
      is_public: true,
      ticker: null,
      exchange: null
    }));
  }
}

// Enhanced ingestion with RSS timestamp support
async function ingestRSSItem(rssItem, sourceId) {
  try {
    const announcementData = {
      fda_id: rssItem.id,
      announcement_type: rssItem.announcement_type,
      title: rssItem.title,
      description: rssItem.description,
      sponsor_name: rssItem.sponsor_name,
      product_name: rssItem.product_name,
      announcement_date: rssItem.announcement_date, // Now uses RSS publication timestamp
      classification: rssItem.classification,
      status: 'published',
      source_id: sourceId,
      raw_data: {
        ...rssItem.raw_data,
        detected_ticker: rssItem.detected_ticker,
        verified_company_name: rssItem.verified_company_name,
        detected_exchange: rssItem.detected_exchange,
        feed_type: rssItem.feed_type,
        rss_source: rssItem.source,
        pub_date_full: rssItem.pub_date_full // Store full RSS timestamp
      }
    };

    const { data: existing } = await supabase
      .from('fda_announcements')
      .select('id')
      .eq('fda_id', rssItem.id)
      .single();

    let announcementId;

    if (existing) {
      const { data } = await supabase
        .from('fda_announcements')
        .update(announcementData)
        .eq('fda_id', rssItem.id)
        .select('id')
        .single();
      announcementId = data.id;
      console.log(`Updated existing announcement: ${rssItem.id}`);
    } else {
      const { data } = await supabase
        .from('fda_announcements')
        .insert(announcementData)
        .select('id')
        .single();
      announcementId = data.id;
      console.log(`Created new announcement: ${rssItem.id} (RSS pub date: ${rssItem.pub_date_full})`);
    }

    // Add to processing queue
    await supabase
      .from('processing_queue')
      .insert({
        fda_announcement_id: announcementId,
        source_id: sourceId,
        status: 'pending'
      });

    return { success: true, id: announcementId };
  } catch (error) {
    console.error(`Error ingesting RSS item ${rssItem.id}:`, error);
    return { success: false, error: error.message };
  }
}

function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/ingest')[0];
}