// src/app/api/fda/ingest/route.js - Updated with AI pre-filtering
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Supabase client (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request) {
  try {
    const { type = 'all', limit = 50 } = await request.json();

    console.log(`Starting FDA data ingestion for type: ${type}`);

    // Fetch fresh FDA data from our API routes
    let fdaData = [];
    
    if (type === 'all') {
      const response = await fetch(`${getBaseUrl(request)}/api/fda/all?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`FDA all endpoint failed: ${response.status}`);
      }
      const result = await response.json();
      fdaData = result.success ? result.data : [];
    } else {
      const endpoints = {
        'drugs': '/api/fda/drug-approvals',
        'safety': '/api/fda/safety-alerts', 
        'devices': '/api/fda/device-approvals'
      };
      
      if (endpoints[type]) {
        const response = await fetch(`${getBaseUrl(request)}${endpoints[type]}?limit=${limit}`);
        if (!response.ok) {
          throw new Error(`FDA ${type} endpoint failed: ${response.status}`);
        }
        const result = await response.json();
        fdaData = result.success ? result.data : [];
      }
    }

    if (fdaData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No FDA data retrieved',
        ingested: 0
      });
    }

    console.log(`Retrieved ${fdaData.length} FDA announcements, filtering for public companies...`);

    // Step 1: AI Pre-Filter for Public Companies Only
    const publicCompanies = await filterPublicCompanies(fdaData);
    
    if (publicCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No public companies found in this batch',
        ingested: 0,
        filtered_out: fdaData.length,
        total_processed: fdaData.length
      });
    }

    console.log(`Filtered to ${publicCompanies.length} public companies (${fdaData.length - publicCompanies.length} private companies excluded)`);

    // Step 2: Ingest only public companies
    const ingestResults = await Promise.allSettled(
      publicCompanies.map(item => ingestFDAItem(item))
    );

    // Count successes and failures
    let successful = 0;
    let failed = 0;
    let errors = [];

    ingestResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      } else {
        failed++;
        errors.push({
          item_id: publicCompanies[index].id,
          company: publicCompanies[index].sponsor_name,
          error: result.status === 'fulfilled' ? result.value.error : result.reason.message
        });
      }
    });

    console.log(`FDA ingestion complete: ${successful} successful, ${failed} failed, ${fdaData.length - publicCompanies.length} private companies filtered out`);

    return NextResponse.json({
      success: true,
      ingested: successful,
      failed: failed,
      filtered_out: fdaData.length - publicCompanies.length,
      total_processed: fdaData.length,
      public_companies_found: publicCompanies.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Ingestion Error:', error);
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

// AI-powered public company filtering
async function filterPublicCompanies(fdaData) {
  try {
    // Extract unique companies for filtering
    const companiesToCheck = fdaData
      .filter(item => item.sponsor_name || item.recalling_firm || item.applicant)
      .map(item => ({
        fda_id: item.id,
        company_name: item.sponsor_name || item.recalling_firm || item.applicant,
        announcement_type: item.category || 'unknown'
      }));

    if (companiesToCheck.length === 0) {
      return [];
    }

    console.log(`Checking ${companiesToCheck.length} companies for public trading status...`);

    // Process in batches to handle large datasets
    const batchSize = 20; // Optimize for token limits
    const filteredCompanies = [];

    for (let i = 0; i < companiesToCheck.length; i += batchSize) {
      const batch = companiesToCheck.slice(i, i + batchSize);
      const batchResults = await aiFilterCompanyBatch(batch);
      filteredCompanies.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < companiesToCheck.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Create map of public companies
    const publicCompanyMap = new Map();
    filteredCompanies
      .filter(result => result.is_public)
      .forEach(result => {
        publicCompanyMap.set(result.fda_id, {
          ticker: result.ticker,
          company_name: result.company_name
        });
      });

    // Filter original FDA data to only include public companies
    const publicFDAData = fdaData.filter(item => 
      publicCompanyMap.has(item.id)
    );

    // Enhance with ticker information
    publicFDAData.forEach(item => {
      const publicInfo = publicCompanyMap.get(item.id);
      if (publicInfo) {
        item.detected_ticker = publicInfo.ticker;
        item.verified_company_name = publicInfo.company_name;
      }
    });

    console.log(`AI filtering complete: ${publicFDAData.length} public companies identified`);
    return publicFDAData;

  } catch (error) {
    console.error('Error in public company filtering:', error);
    // Fallback: return all companies if filtering fails
    console.log('Falling back to processing all companies due to filtering error');
    return fdaData;
  }
}

// AI batch filtering for public companies
async function aiFilterCompanyBatch(companyBatch) {
  try {
    const prompt = buildPublicCompanyFilterPrompt(companyBatch);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const response = message.content[0].text.trim();
    
    // Parse JSON response
    let results;
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleanResponse;
      results = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parsing failed for company filtering:', parseError);
      console.log('Raw response:', response);
      throw new Error(`Invalid JSON response: ${parseError.message}`);
    }

    // Validate and clean results
    if (!Array.isArray(results)) {
      throw new Error('AI response must be a JSON array');
    }

    return results.map((result, index) => ({
      fda_id: result.fda_id || companyBatch[index]?.fda_id,
      company_name: result.company_name || companyBatch[index]?.company_name,
      is_public: Boolean(result.is_public),
      ticker: result.ticker && result.ticker !== 'null' ? result.ticker.toUpperCase() : null
    }));

  } catch (error) {
    console.error('AI company filtering error:', error);
    // Fallback: assume all companies are public if AI fails
    return companyBatch.map(company => ({
      fda_id: company.fda_id,
      company_name: company.company_name,
      is_public: true, // Conservative fallback
      ticker: null
    }));
  }
}

// Build prompt for public company filtering
function buildPublicCompanyFilterPrompt(companyBatch) {
  const companyList = companyBatch.map((company, index) => 
    `${index + 1}. FDA_ID: "${company.fda_id}", Company: "${company.company_name}", Type: ${company.announcement_type}`
  ).join('\n');

  return `You are a financial analyst expert in pharmaceutical and biotech companies. Analyze these companies and determine which are publicly traded.

CRITICAL: Return ONLY a valid JSON array with exactly ${companyBatch.length} objects.

Required format for each company:
{
  "fda_id": "exact-fda-id-from-input",
  "company_name": "cleaned company name",
  "is_public": true or false,
  "ticker": "TICKER" or null
}

Guidelines:
- is_public: true = publicly traded on any exchange (NYSE, NASDAQ, OTC, international)
- is_public: false = private company, university, government, research institution
- ticker: exact stock symbol (NVAX, MRNA, PFE) or null if unknown/private
- Focus on US-listed companies but include major international pharma

Companies to analyze:
${companyList}

Return JSON array only:`;
}

// Helper function to get base URL
function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/ingest')[0];
}

// Enhanced FDA item ingestion (now only for public companies)
async function ingestFDAItem(fdaItem) {
  try {
    // Transform FDA data to our database format
    const announcementData = {
      fda_id: fdaItem.id,
      announcement_type: fdaItem.category,
      title: generateTitle(fdaItem),
      description: generateDescription(fdaItem),
      sponsor_name: fdaItem.sponsor_name || fdaItem.recalling_firm || fdaItem.applicant,
      product_name: fdaItem.drug_name || fdaItem.product_description || fdaItem.device_name,
      announcement_date: parseAnnouncementDate(fdaItem),
      classification: fdaItem.classification,
      status: fdaItem.status || fdaItem.decision,
      raw_data: {
        ...fdaItem,
        // Store AI-detected ticker for later use
        detected_ticker: fdaItem.detected_ticker,
        verified_company_name: fdaItem.verified_company_name
      }
    };

    // Check if this FDA item already exists
    const { data: existing, error: checkError } = await supabase
      .from('fda_announcements')
      .select('id')
      .eq('fda_id', fdaItem.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      throw checkError;
    }

    let announcementId;

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('fda_announcements')
        .update(announcementData)
        .eq('fda_id', fdaItem.id)
        .select('id')
        .single();

      if (error) throw error;
      announcementId = data.id;
      console.log(`Updated existing public company: ${fdaItem.id}`);
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('fda_announcements')
        .insert(announcementData)
        .select('id')
        .single();

      if (error) throw error;
      announcementId = data.id;
      console.log(`Inserted new public company: ${fdaItem.id} (${fdaItem.sponsor_name || fdaItem.recalling_firm || fdaItem.applicant})`);
    }

    // Add to processing queue for AI analysis
    await addToProcessingQueue(announcementId);

    return { success: true, id: announcementId };

  } catch (error) {
    console.error(`Error ingesting FDA item ${fdaItem.id}:`, error);
    return { success: false, error: error.message };
  }
}

// Helper function to generate a readable title
function generateTitle(fdaItem) {
  const companyName = fdaItem.sponsor_name || fdaItem.recalling_firm || fdaItem.applicant || 'Unknown Company';
  const productName = fdaItem.drug_name || fdaItem.product_description || fdaItem.device_name || 'Product';
  
  switch (fdaItem.category) {
    case 'drug_approval':
      return `FDA Approves ${productName} by ${companyName}`;
    case 'safety_alert':
      return `FDA Recall: ${productName} (${fdaItem.classification || 'Classification Unknown'})`;
    case 'device_approval':
      return `FDA Clears ${productName} by ${companyName}`;
    default:
      return `FDA Announcement: ${productName} from ${companyName}`;
  }
}

// Helper function to generate description
function generateDescription(fdaItem) {
  const companyName = fdaItem.sponsor_name || fdaItem.recalling_firm || fdaItem.applicant || 'company';
  const productName = fdaItem.drug_name || fdaItem.product_description || fdaItem.device_name || 'product';
  
  switch (fdaItem.category) {
    case 'drug_approval':
      return `FDA approved ${productName} (Application ${fdaItem.application_number || 'N/A'}) from ${companyName}.`;
    case 'safety_alert':
      return `FDA issued ${fdaItem.classification || 'recall'} for ${productName} due to: ${fdaItem.reason_for_recall || 'safety concerns'}.`;
    case 'device_approval':
      return `FDA granted 510(k) clearance for ${productName} (${fdaItem.k_number || 'N/A'}) from ${companyName}.`;
    default:
      return `FDA regulatory update regarding ${productName} from ${companyName}.`;
  }
}

// Helper function to parse announcement date
function parseAnnouncementDate(fdaItem) {
  const dateStr = fdaItem.approval_date || fdaItem.report_date || fdaItem.decision_date || fdaItem.date_received;
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Handle various date formats from FDA
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch (error) {
    return new Date().toISOString().split('T')[0];
  }
}

// Helper function to add item to processing queue
async function addToProcessingQueue(announcementId) {
  try {
    const { error } = await supabase
      .from('processing_queue')
      .insert({
        fda_announcement_id: announcementId,
        status: 'pending'
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error adding to processing queue:', error);
    // Don't fail the main ingestion for queue errors
  }
}