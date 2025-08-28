// src/app/api/fda/ingest/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // Transform and insert data into Supabase
    const ingestResults = await Promise.allSettled(
      fdaData.map(item => ingestFDAItem(item))
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
          item_id: fdaData[index].id,
          error: result.status === 'fulfilled' ? result.value.error : result.reason.message
        });
      }
    });

    console.log(`FDA ingestion complete: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      ingested: successful,
      failed: failed,
      total_processed: fdaData.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // Only return first 5 errors
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

// Helper function to get base URL
function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/ingest')[0];
}

// Helper function to ingest a single FDA item
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
      raw_data: fdaItem
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
      console.log(`Updated existing FDA announcement: ${fdaItem.id}`);
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('fda_announcements')
        .insert(announcementData)
        .select('id')
        .single();

      if (error) throw error;
      announcementId = data.id;
      console.log(`Inserted new FDA announcement: ${fdaItem.id}`);
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
  switch (fdaItem.category) {
    case 'drug_approval':
      return `FDA Approves ${fdaItem.drug_name || 'Drug'} by ${fdaItem.sponsor_name || 'Unknown Company'}`;
    case 'safety_alert':
      return `FDA Recall: ${fdaItem.product_description || 'Product'} (${fdaItem.classification || 'Classification Unknown'})`;
    case 'device_approval':
      return `FDA Clears ${fdaItem.device_name || 'Medical Device'} by ${fdaItem.applicant || 'Unknown Company'}`;
    default:
      return `FDA Announcement: ${fdaItem.drug_name || fdaItem.product_description || fdaItem.device_name || 'Unknown'}`;
  }
}

// Helper function to generate description
function generateDescription(fdaItem) {
  switch (fdaItem.category) {
    case 'drug_approval':
      return `FDA approved ${fdaItem.drug_name || 'drug'} (Application ${fdaItem.application_number || 'N/A'}) from ${fdaItem.sponsor_name || 'pharmaceutical company'}.`;
    case 'safety_alert':
      return `FDA issued ${fdaItem.classification || 'recall'} for ${fdaItem.product_description || 'product'} due to: ${fdaItem.reason_for_recall || 'safety concerns'}.`;
    case 'device_approval':
      return `FDA granted 510(k) clearance for ${fdaItem.device_name || 'medical device'} (${fdaItem.k_number || 'N/A'}) from ${fdaItem.applicant || 'medical device company'}.`;
    default:
      return `FDA regulatory update regarding ${fdaItem.product_name || 'medical product'}.`;
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