// src/app/api/fda/process/route.js
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

export async function POST(request) {
  try {
    const { batchSize = 10, priorityOnly = false } = await request.json();

    console.log(`Starting AI processing batch (size: ${batchSize})`);

    // Get pending items from processing queue
    let query = supabase
      .from('processing_queue')
      .select(`
        id,
        fda_announcement_id,
        fda_announcements (
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

    console.log(`Processing ${queueItems.length} FDA announcements`);

    // Process each item
    const processingResults = await Promise.allSettled(
      queueItems.map(item => processAnnouncementWithAI(item))
    );

    // Count results
    let successful = 0;
    let failed = 0;
    let errors = [];

    processingResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successful++;
      } else {
        failed++;
        errors.push({
          queue_id: queueItems[index].id,
          error: result.status === 'fulfilled' ? result.value.error : result.reason.message
        });
      }
    });

    console.log(`AI processing complete: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed: successful,
      failed: failed,
      total_items: queueItems.length,
      errors: errors.length > 0 ? errors.slice(0, 3) : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Processing Error:', error);
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

// Main AI processing function for a single announcement
async function processAnnouncementWithAI(queueItem) {
  try {
    const announcement = queueItem.fda_announcements;
    if (!announcement) {
      throw new Error('No announcement data found');
    }

    // Mark as processing
    await updateQueueStatus(queueItem.id, 'processing');

    console.log(`Processing: ${announcement.fda_id}`);

    // Step 1: Company/Stock Matching
    const stockTicker = await matchCompanyToStock(announcement);

    // Step 2: AI Relevance Analysis
    const aiAnalysis = await analyzeWithClaude(announcement, stockTicker);

    // Step 3: Save processed news
    if (aiAnalysis.relevanceScore >= 30) { // Only save relevant items
      const processedNewsId = await saveProcessedNews(announcement, stockTicker, aiAnalysis);
      
      // Mark queue item as completed
      await updateQueueStatus(queueItem.id, 'completed');
      
      console.log(`✓ Processed and saved: ${announcement.fda_id} (score: ${aiAnalysis.relevanceScore})`);
      return { success: true, processedNewsId, relevanceScore: aiAnalysis.relevanceScore };
    } else {
      // Mark as completed but don't publish (low relevance)
      await updateQueueStatus(queueItem.id, 'completed');
      console.log(`○ Processed but not published: ${announcement.fda_id} (score: ${aiAnalysis.relevanceScore})`);
      return { success: true, relevanceScore: aiAnalysis.relevanceScore, published: false };
    }

  } catch (error) {
    console.error(`Error processing ${queueItem.id}:`, error);
    
    // Mark as failed and increment retry count
    await updateQueueStatus(queueItem.id, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

// Company to stock ticker matching
async function matchCompanyToStock(announcement) {
  try {
    const companyName = announcement.sponsor_name || announcement.description;
    if (!companyName) return null;

    // Direct company name match
    const { data: directMatch } = await supabase
      .from('stock_mappings')
      .select('stock_ticker, company_name')
      .ilike('company_name', `%${companyName}%`)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (directMatch) {
      console.log(`✓ Direct match: ${companyName} → ${directMatch.stock_ticker}`);
      return directMatch.stock_ticker;
    }

    // Check aliases
    const { data: aliasMatches } = await supabase
      .from('stock_mappings')
      .select('stock_ticker, company_name, aliases')
      .eq('is_active', true);

    if (aliasMatches) {
      for (const mapping of aliasMatches) {
        if (mapping.aliases) {
          for (const alias of mapping.aliases) {
            if (companyName.toLowerCase().includes(alias.toLowerCase()) || 
                alias.toLowerCase().includes(companyName.toLowerCase())) {
              console.log(`✓ Alias match: ${companyName} → ${mapping.stock_ticker} (via ${alias})`);
              return mapping.stock_ticker;
            }
          }
        }
      }
    }

    console.log(`○ No stock match found for: ${companyName}`);
    return null;

  } catch (error) {
    console.error('Error in stock matching:', error);
    return null;
  }
}

// Claude analysis for relevance and summarization
async function analyzeWithClaude(announcement, stockTicker) {
  try {
    const prompt = `You are a financial analyst specializing in penny stocks and biotech/pharma investments. Analyze this FDA announcement for potential stock market impact.

FDA Announcement:
- Type: ${announcement.announcement_type}
- Title: ${announcement.title}
- Company: ${announcement.sponsor_name || 'Unknown'}
- Product: ${announcement.product_name || 'Unknown'}
- Description: ${announcement.description}
- Date: ${announcement.announcement_date}
- Stock Ticker: ${stockTicker || 'Not identified'}
- Classification: ${announcement.classification || 'N/A'}

Please provide a JSON response with:
1. relevanceScore (0-100): How likely this is to impact stock prices
2. priorityLevel (high/medium/low): Urgency for traders
3. summary (2-3 sentences): Key takeaways for investors
4. marketImpact (1 sentence): Expected price movement direction and reasoning
5. tags (array): 3-5 relevant keywords for filtering

Focus on penny stocks and small-cap companies. Consider:
- Drug approvals = potentially very bullish
- Safety recalls = potentially very bearish  
- Device clearances = moderately bullish
- Clinical trial outcomes = variable impact

Respond only with valid JSON.`;

    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const response = message.content[0].text.trim();
    
    try {
      const analysis = JSON.parse(response);
      
      // Validate required fields
      if (typeof analysis.relevanceScore !== 'number' || 
          !['high', 'medium', 'low'].includes(analysis.priorityLevel)) {
        throw new Error('Invalid AI response format');
      }

      return {
        relevanceScore: Math.max(0, Math.min(100, analysis.relevanceScore)),
        priorityLevel: analysis.priorityLevel,
        summary: analysis.summary || 'AI analysis unavailable',
        marketImpact: analysis.marketImpact || 'Impact unclear',
        tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 5) : []
      };

    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      throw new Error('Invalid AI response format');
    }

  } catch (error) {
    console.error('Claude API Error:', error);
    
    // Fallback analysis
    return {
      relevanceScore: getFallbackRelevanceScore(announcement),
      priorityLevel: getFallbackPriority(announcement),
      summary: `${announcement.announcement_type.replace('_', ' ')} announcement from ${announcement.sponsor_name || 'company'} regarding ${announcement.product_name || 'product'}.`,
      marketImpact: 'AI analysis unavailable - manual review recommended',
      tags: [announcement.announcement_type, 'fda', 'regulatory']
    };
  }
}

// Fallback scoring if AI fails
function getFallbackRelevanceScore(announcement) {
  switch (announcement.announcement_type) {
    case 'drug_approval': return 85;
    case 'safety_alert': 
      if (announcement.classification === 'Class I') return 90;
      if (announcement.classification === 'Class II') return 70;
      return 50;
    case 'device_approval': return 60;
    default: return 40;
  }
}

function getFallbackPriority(announcement) {
  if (announcement.announcement_type === 'drug_approval') return 'high';
  if (announcement.classification === 'Class I') return 'high';
  if (announcement.announcement_type === 'safety_alert') return 'medium';
  return 'low';
}

// Save processed news to database
async function saveProcessedNews(announcement, stockTicker, aiAnalysis) {
  const { data, error } = await supabase
    .from('processed_news')
    .insert({
      fda_announcement_id: announcement.id,
      stock_ticker: stockTicker,
      relevance_score: aiAnalysis.relevanceScore,
      priority_level: aiAnalysis.priorityLevel,
      ai_summary: aiAnalysis.summary,
      market_impact_assessment: aiAnalysis.marketImpact,
      tags: aiAnalysis.tags,
      is_published: aiAnalysis.relevanceScore >= 50, // Auto-publish high relevance items
      published_at: aiAnalysis.relevanceScore >= 50 ? new Date().toISOString() : null
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
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