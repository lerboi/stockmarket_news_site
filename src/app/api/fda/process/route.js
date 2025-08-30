// src/app/api/fda/process/route.js - Updated with sentiment analysis
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache for FDA data source ID
let fdaSourceId = null;

export async function POST(request) {
  try {
    const { batchSize = 12, priorityOnly = false } = await request.json();
    const BATCH_SIZE = 2; // Fixed batch size for optimal Claude performance

    console.log(`Starting batch AI processing (total size: ${batchSize})`);

    // Ensure FDA data source exists
    await ensureFDADataSource();

    // Get pending items from processing queue (today's data only)
    const today = new Date().toISOString().split('T')[0];
    let query = supabase
      .from('processing_queue')
      .select(`
        id,
        fda_announcement_id,
        fda_announcements!inner (
          id,
          fda_id,
          announcement_type,
          title,
          description,
          sponsor_name,
          product_name,
          announcement_date,
          classification,
          raw_data
        )
      `)
      .eq('status', 'pending')
      .eq('fda_announcements.announcement_date', today)
      .order('scheduled_at', { ascending: true })
      .limit(batchSize);

    const { data: queueItems, error: queueError } = await query;

    if (queueError) throw queueError;

    if (!queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No items to process',
        processed: 0
      });
    }

    console.log(`Processing ${queueItems.length} FDA announcements in batches of ${BATCH_SIZE}`);

    // Split into batches of 2
    const batches = [];
    for (let i = 0; i < queueItems.length; i += BATCH_SIZE) {
      batches.push(queueItems.slice(i, i + BATCH_SIZE));
    }

    console.log(`Created ${batches.length} batches for processing`);

    // Process each batch sequentially to avoid rate limits
    const allResults = [];
    let totalProcessed = 0;
    let totalFailed = 0;
    const allErrors = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
      
      try {
        const batchResult = await processBatchWithAI(batch);
        allResults.push(batchResult);
        
        totalProcessed += batchResult.processed || 0;
        totalFailed += batchResult.failed || 0;
        
        if (batchResult.errors) {
          allErrors.push(...batchResult.errors);
        }
        
        // Small delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (batchError) {
        console.error(`Batch ${i + 1} failed:`, batchError);
        totalFailed += batch.length;
        allErrors.push({
          batch: i + 1,
          error: batchError.message
        });
        
        // Mark all items in failed batch as failed
        await Promise.allSettled(
          batch.map(item => updateQueueStatus(item.id, 'failed', `Batch processing failed: ${batchError.message}`))
        );
      }
    }

    console.log(`All batches complete: ${totalProcessed} successful, ${totalFailed} failed`);

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      failed: totalFailed,
      total_items: queueItems.length,
      batches_processed: batches.length,
      errors: allErrors.length > 0 ? allErrors.slice(0, 5) : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch AI Processing Error:', error);
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

// Ensure FDA data source exists and cache the ID
async function ensureFDADataSource() {
  if (fdaSourceId) {
    return fdaSourceId;
  }

  try {
    // Check if FDA data source already exists
    const { data: existingSource, error: selectError } = await supabase
      .from('data_sources')
      .select('id')
      .eq('source_name', 'FDA')
      .single();

    if (existingSource) {
      fdaSourceId = existingSource.id;
      return fdaSourceId;
    }

    // Create FDA data source if it doesn't exist
    const { data: newSource, error: insertError } = await supabase
      .from('data_sources')
      .insert({
        source_name: 'FDA',
        source_type: 'regulatory',
        is_active: true,
        api_config: {
          base_url: 'https://api.fda.gov',
          endpoints: {
            drug_approvals: '/drug/drugsfda.json',
            safety_alerts: '/food/enforcement.json',
            device_approvals: '/device/510k.json'
          }
        },
        processing_config: {
          batch_size: 50,
          retry_attempts: 3,
          ai_filtering_enabled: true
        }
      })
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    fdaSourceId = newSource.id;
    console.log(`Created FDA data source with ID: ${fdaSourceId}`);
    return fdaSourceId;

  } catch (error) {
    console.error('Error ensuring FDA data source:', error);
    throw new Error(`Failed to create/retrieve FDA data source: ${error.message}`);
  }
}

// Main batch processing function
async function processBatchWithAI(queueItems) {
  try {
    // Validate input
    if (!queueItems || queueItems.length === 0) {
      throw new Error('No queue items provided for batch processing');
    }

    const batchItems = queueItems.slice(0, 2); // Ensure max 2 items
    
    console.log(`Processing batch of ${batchItems.length} FDA announcements`);

    // Mark all items as processing
    await Promise.all(
      batchItems.map(item => updateQueueStatus(item.id, 'processing'))
    );

    // Perform batch AI analysis
    const aiAnalysisResults = await batchAnalyzeWithClaude(batchItems);

    // Process each result and save to database
    const processingResults = await Promise.allSettled(
      aiAnalysisResults.map((analysis, index) => 
        saveBatchAnalysisResult(batchItems[index], analysis)
      )
    );

    // Count successes and failures
    let successful = 0;
    let failed = 0;
    const errors = [];

    processingResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      } else {
        failed++;
        errors.push({
          queue_id: batchItems[index].id,
          fda_id: batchItems[index].fda_announcements?.fda_id,
          error: result.status === 'fulfilled' ? result.value.error : result.reason.message
        });
      }
    });

    return {
      success: true,
      processed: successful,
      failed: failed,
      total_items: batchItems.length,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Batch processing error:', error);
    
    // Mark all items as failed if batch completely fails
    if (queueItems) {
      await Promise.allSettled(
        queueItems.map(item => updateQueueStatus(item.id, 'failed', error.message))
      );
    }

    return {
      success: false,
      error: error.message,
      processed: 0,
      failed: queueItems?.length || 0
    };
  }
}

// Batch AI analysis with Claude - returns structured JSON array
async function batchAnalyzeWithClaude(batchItems) {
  try {
    // Build the batch prompt
    const prompt = buildEnhancedBatchPrompt(batchItems);
    
    console.log(`Sending batch of ${batchItems.length} items to Claude for sentiment analysis`);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      temperature: 0.1, // Very low temperature for consistent structured output
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const response = message.content[0].text.trim();
    
    // Parse and validate JSON response
    let analysisArray;
    try {
      // Remove any markdown code blocks if present
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      
      // Try to extract JSON if there's extra text
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : cleanResponse;
      
      analysisArray = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.log('Raw response:', response);
      throw new Error(`Invalid JSON response from Claude: ${parseError.message}`);
    }

    // Validate response structure
    if (!Array.isArray(analysisArray)) {
      throw new Error('Claude response must be a JSON array');
    }

    if (analysisArray.length !== batchItems.length) {
      console.warn(`Expected ${batchItems.length} results, got ${analysisArray.length}. Using available results.`);
      // Pad with fallback analyses if needed
      while (analysisArray.length < batchItems.length) {
        const missingIndex = analysisArray.length;
        analysisArray.push(getFallbackAnalysis(batchItems[missingIndex].fda_announcements));
      }
    }

    // Validate and clean each analysis result
    const validatedResults = analysisArray.slice(0, batchItems.length).map((analysis, index) => {
      return validateAndCleanAnalysis(analysis, batchItems[index]);
    });

    console.log(`Successfully processed batch analysis for ${validatedResults.length} items`);
    return validatedResults;

  } catch (error) {
    console.error('Claude batch analysis error:', error);
    
    // Return fallback analysis for each item
    return batchItems.map(item => getFallbackAnalysis(item.fda_announcements));
  }
}

// Updated buildEnhancedBatchPrompt function for more professional analysis
function buildEnhancedBatchPrompt(batchItems) {
  const announcements = batchItems.map((item, index) => {
    const announcement = item.fda_announcements;
    return `${index + 1}. ID: "${announcement.id}"
   Type: ${announcement.announcement_type}
   Title: "${announcement.title}"
   Description: "${(announcement.description || '').substring(0, 400)}"
   Company: ${announcement.sponsor_name || 'Unknown'}
   Product: ${announcement.product_name || 'Unknown'}
   Date: ${announcement.announcement_date}`;
  }).join('\n\n');

  return `You are a senior biotech/pharmaceutical stock analyst specializing in penny stock trading intelligence. Analyze these ${batchItems.length} FDA announcements for market impact and sentiment.

CRITICAL REQUIREMENTS:
1. Return ONLY a valid JSON array
2. Must contain exactly ${batchItems.length} objects
3. Objects must be in the same order as input
4. No additional text or explanation
5. MUST provide stock_ticker and stock_exchange for ALL public companies

Required JSON structure for each announcement:
{
  "fda_announcement_id": "exact-uuid-from-input",
  "stock_ticker": "TICKER" (REQUIRED for public companies, null only for private/unknown),
  "stock_exchange": "NASDAQ" or "NYSE" or "OTC" or "AMEX" (REQUIRED when ticker provided),
  "relevance_score": 0-100,
  "priority_level": "high" or "medium" or "low",
  "sentiment": "bullish" or "bearish" or "neutral",
  "sentiment_strength": 0-100,
  "ai_summary": "2-3 sentence professional summary for institutional investors",
  "market_impact_assessment": "General market impact description - NO specific price predictions",
  "tags": ["tag1", "tag2", "tag3"]
}

SENTIMENT ANALYSIS:
- BULLISH: Drug approvals (80-100), device clearances (60-79), minor approvals (40-59)
- BEARISH: Class I recalls (80-100), safety alerts (60-79), minor recalls (40-59)
- NEUTRAL: Routine updates (0-39)

MARKET IMPACT GUIDELINES:
- Use general terms like "positive catalyst", "negative pressure", "potential volatility"
- DO NOT include specific percentage predictions (no "15-30%" type predictions)
- Focus on qualitative impact: "strong upward momentum", "downward pressure expected", "mixed market reaction likely"
- Mention trading volume expectations: "increased trading activity expected", "sustained investor interest likely"

RELEVANCE SCORING:
- Drug approvals: 70-95 (high priority if novel/first-in-class)
- Safety alerts: 75-95 (high priority for Class I recalls)
- Device approvals: 50-80 (medium priority unless breakthrough technology)

STOCK EXCHANGES: NYSE, NASDAQ, OTC, AMEX - Research and select correct exchange for each ticker.

FDA Announcements:

${announcements}

Return JSON array only:`;
}

// Validate and clean individual analysis results
function validateAndCleanAnalysis(analysis, queueItem) {
  const announcement = queueItem.fda_announcements;
  
  // Ensure required fields exist with proper types
  const validated = {
    fda_announcement_id: analysis.fda_announcement_id || announcement.id,
    stock_ticker: analysis.stock_ticker && typeof analysis.stock_ticker === 'string' && analysis.stock_ticker !== 'null'
      ? analysis.stock_ticker.toUpperCase() : null,
    stock_exchange: analysis.stock_exchange && typeof analysis.stock_exchange === 'string'
      ? analysis.stock_exchange.toUpperCase() : null,
    relevance_score: Math.max(0, Math.min(100, parseInt(analysis.relevance_score) || 0)),
    priority_level: ['high', 'medium', 'low'].includes(analysis.priority_level) 
      ? analysis.priority_level : 'medium',
    sentiment: ['bullish', 'bearish', 'neutral'].includes(analysis.sentiment)
      ? analysis.sentiment : 'neutral',
    sentiment_strength: Math.max(0, Math.min(100, parseInt(analysis.sentiment_strength) || 50)),
    ai_summary: typeof analysis.ai_summary === 'string' && analysis.ai_summary.length > 10
      ? analysis.ai_summary.substring(0, 500) : `${announcement.announcement_type.replace('_', ' ')} from ${announcement.sponsor_name || 'company'}`,
    market_impact_assessment: typeof analysis.market_impact_assessment === 'string' && analysis.market_impact_assessment.length > 5
      ? analysis.market_impact_assessment.substring(0, 300) : 'Market impact requires further analysis',
    tags: Array.isArray(analysis.tags) 
      ? analysis.tags.slice(0, 5).map(tag => String(tag).toLowerCase().replace(/\s+/g, '_'))
      : [announcement.announcement_type, 'fda', 'regulatory']
  };

  // Validate UUID format for fda_announcement_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(validated.fda_announcement_id)) {
    console.warn(`Invalid UUID for announcement, using fallback: ${validated.fda_announcement_id}`);
    validated.fda_announcement_id = announcement.id;
  }

  return validated;
}

// Save individual analysis result to database
async function saveBatchAnalysisResult(queueItem, analysis) {
  try {
    const announcement = queueItem.fda_announcements;
    
    // Ensure we have the FDA source ID
    await ensureFDADataSource();
    
    // Only save if relevance score meets threshold
    if (analysis.relevance_score < 30) {
      await updateQueueStatus(queueItem.id, 'completed');
      return { 
        success: true, 
        published: false, 
        reason: `Low relevance score: ${analysis.relevance_score}` 
      };
    }

    // Insert into processed_news table
    const { data, error } = await supabase
      .from('processed_news')
      .insert({
        fda_announcement_id: analysis.fda_announcement_id,
        source_id: fdaSourceId,
        stock_ticker: analysis.stock_ticker,
        stock_exchange: analysis.stock_exchange,
        relevance_score: analysis.relevance_score,
        priority_level: analysis.priority_level,
        sentiment: analysis.sentiment,
        sentiment_strength: analysis.sentiment_strength,
        ai_summary: analysis.ai_summary,
        market_impact_assessment: analysis.market_impact_assessment,
        tags: analysis.tags,
        is_published: analysis.relevance_score >= 50, // Auto-publish high relevance
        published_at: analysis.relevance_score >= 50 ? new Date().toISOString() : null
      })
      .select('id')
      .single();

    if (error) throw error;

    // Mark queue item as completed
    await updateQueueStatus(queueItem.id, 'completed');
    
    console.log(`âœ" Saved analysis for ${announcement.fda_id} (score: ${analysis.relevance_score}, ticker: ${analysis.stock_ticker || 'none'}, sentiment: ${analysis.sentiment} ${analysis.sentiment_strength}%)`);
    
    return { 
      success: true, 
      processedNewsId: data.id, 
      published: analysis.relevance_score >= 50,
      relevanceScore: analysis.relevance_score,
      sentiment: `${analysis.sentiment} (${analysis.sentiment_strength}%)`
    };

  } catch (error) {
    console.error(`Error saving analysis for ${queueItem.id}:`, error);
    await updateQueueStatus(queueItem.id, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

// Fallback analysis if AI completely fails
function getFallbackAnalysis(announcement) {
  const fallbackScores = {
    'drug_approval': 75,
    'safety_alert': 80,
    'device_approval': 60
  };

  const fallbackPriority = {
    'drug_approval': 'high',
    'safety_alert': 'high', 
    'device_approval': 'medium'
  };

  const fallbackSentiment = {
    'drug_approval': { sentiment: 'bullish', strength: 70 },
    'safety_alert': { sentiment: 'bearish', strength: 75 },
    'device_approval': { sentiment: 'bullish', strength: 60 }
  };

  const sentimentData = fallbackSentiment[announcement.announcement_type] || { sentiment: 'neutral', strength: 50 };

  return {
    fda_announcement_id: announcement.id,
    stock_ticker: null,
    stock_exchange: null,
    relevance_score: fallbackScores[announcement.announcement_type] || 50,
    priority_level: fallbackPriority[announcement.announcement_type] || 'medium',
    sentiment: sentimentData.sentiment,
    sentiment_strength: sentimentData.strength,
    ai_summary: `${announcement.announcement_type.replace('_', ' ')} announcement from ${announcement.sponsor_name || 'company'} regarding ${announcement.product_name || 'product'}.`,
    market_impact_assessment: 'AI analysis unavailable - manual review recommended',
    tags: [announcement.announcement_type, 'fda', 'regulatory']
  };
}

// Update processing queue status
async function updateQueueStatus(queueId, status, errorMessage = null) {
  const updateData = {
    status,
    processed_at: new Date().toISOString()
  };

  if (errorMessage) {
    updateData.error_message = errorMessage;
    // Increment retry count for failed items
    const { data: currentItem } = await supabase
      .from('processing_queue')
      .select('retry_count')
      .eq('id', queueId)
      .single();
    
    if (currentItem) {
      updateData.retry_count = (currentItem.retry_count || 0) + 1;
    }
  }

  await supabase
    .from('processing_queue')
    .update(updateData)
    .eq('id', queueId);
}