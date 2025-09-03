// src/app/api/sec/process/route.js - SEC Filing AI Analysis Pipeline
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
        const { batchSize = 12, priorityOnly = false } = await request.json();
        const BATCH_SIZE = 2; // Fixed batch size for optimal Claude performance

        console.log(`Starting SEC filing AI processing (total size: ${batchSize})`);

        // Get pending SEC items from processing queue
        let query = supabase
            .from('processing_queue')
            .select(`
        id,
        sec_filing_id,
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
          source_id,
          raw_data
        )
      `)
            .eq('status', 'pending')
            .not('sec_filing_id', 'is', null)
            .order('scheduled_at', { ascending: true })
            .limit(batchSize);

        const { data: queueItems, error: queueError } = await query;

        if (queueError) throw queueError;

        if (!queueItems || queueItems.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No SEC filings to process',
                processed: 0
            });
        }

        console.log(`Processing ${queueItems.length} SEC filings in batches of ${BATCH_SIZE}`);

        // Split into batches of 2
        const batches = [];
        for (let i = 0; i < queueItems.length; i += BATCH_SIZE) {
            batches.push(queueItems.slice(i, i + BATCH_SIZE));
        }

        console.log(`Created ${batches.length} SEC batches for processing`);

        // Process each batch sequentially
        const allResults = [];
        let totalProcessed = 0;
        let totalFailed = 0;
        const allErrors = [];

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Processing SEC batch ${i + 1}/${batches.length} (${batch.length} items)`);

            try {
                const batchResult = await processSECBatchWithAI(batch);
                allResults.push(batchResult);

                totalProcessed += batchResult.processed || 0;
                totalFailed += batchResult.failed || 0;

                if (batchResult.errors) {
                    allErrors.push(...batchResult.errors);
                }

                // Small delay between batches
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (batchError) {
                console.error(`SEC batch ${i + 1} failed:`, batchError);
                totalFailed += batch.length;
                allErrors.push({
                    batch: i + 1,
                    error: batchError.message
                });

                // Mark all items in failed batch as failed
                await Promise.allSettled(
                    batch.map(item => updateQueueStatus(item.id, 'failed', `SEC batch processing failed: ${batchError.message}`))
                );
            }
        }

        console.log(`All SEC batches complete: ${totalProcessed} successful, ${totalFailed} failed`);

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
        console.error('SEC AI Processing Error:', error);
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

// Main SEC batch processing function
async function processSECBatchWithAI(queueItems) {
    try {
        if (!queueItems || queueItems.length === 0) {
            throw new Error('No SEC queue items provided for batch processing');
        }

        const batchItems = queueItems.slice(0, 2); // Ensure max 2 items

        console.log(`Processing SEC batch of ${batchItems.length} filings`);

        // Mark all items as processing
        await Promise.all(
            batchItems.map(item => updateQueueStatus(item.id, 'processing'))
        );

        // Perform batch AI analysis
        const aiAnalysisResults = await batchAnalyzeSECWithClaude(batchItems);

        // Process each result and save to database
        const processingResults = await Promise.allSettled(
            aiAnalysisResults.map((analysis, index) =>
                saveSECAnalysisResult(batchItems[index], analysis)
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
                    sec_id: batchItems[index].sec_filings?.sec_id,
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
        console.error('SEC batch processing error:', error);

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

// Batch AI analysis with Claude for SEC filings
async function batchAnalyzeSECWithClaude(batchItems) {
    try {
        const filings = batchItems.map((item, index) => {
            const filing = item.sec_filings;
            return `${index + 1}. ID: "${filing.id}"
   Form: ${filing.form_type}
   Type: ${filing.filing_type}
   Title: "${filing.title}"
   Summary: "${(filing.summary || '').substring(0, 400)}"
   Company: ${filing.company_name || 'Unknown'}
   Ticker: ${filing.ticker || 'Unknown'}
   CIK: ${filing.cik || 'Unknown'}
   Date: ${filing.filing_date}`;
        }).join('\n\n');

        console.log(`Sending SEC batch of ${batchItems.length} items to Claude for analysis`);

        const message = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            temperature: 0.1,
            system: `I am a senior SEC filing analyst specializing in penny stock trading intelligence. I analyze SEC filings for market impact and sentiment.

CRITICAL REQUIREMENTS:
1. I will return ONLY a valid JSON array
2. I will include exactly the requested number of objects
3. Objects will be in the same order as input
4. No additional text or explanation
5. I MUST provide stock_ticker and stock_exchange for ALL public companies

Required JSON structure for each filing:
{
  "sec_filing_id": "exact-uuid-from-input",
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

SEC FILING SENTIMENT ANALYSIS:
- BULLISH: 8-K mergers/acquisitions (80-100), insider buying Form 4 (60-80), positive earnings 10-Q/K (50-70)
- BEARISH: S-1/S-3 stock offerings (70-90), insider selling Form 4 (60-80), negative earnings/warnings (70-90)
- NEUTRAL: Routine proxy statements (20-40), standard 10-Q/K filings (30-50)

FORM-SPECIFIC ANALYSIS:
- Form 8-K: Major events - M&A bullish, leadership changes neutral/bearish, material agreements vary
- Form 4: Insider trading - buying bullish, selling bearish (weight by dollar amount and executive level)
- Form S-1/S-3: Stock offerings - generally bearish due to dilution
- Form 10-Q/10-K: Financial reports - analyze for deteriorating conditions, warnings, positive/negative guidance

MARKET IMPACT GUIDELINES:
- I use general terms like "positive catalyst", "dilution pressure", "insider confidence signal"
- I DO NOT include specific percentage predictions
- I focus on qualitative impact: "strong acquisition premium expected", "dilution concerns likely", "insider confidence indicator"
- I mention trading implications: "increased volatility expected", "potential breakout catalyst", "selling pressure anticipated"

RELEVANCE SCORING:
- M&A 8-K: 80-95 (high priority)
- Large insider trades (>$100K): 70-85 (high priority)
- Stock offerings: 75-90 (high priority due to dilution)
- Earnings with surprises: 60-80 (medium-high priority)
- Routine filings: 30-50 (medium priority)

STOCK EXCHANGES: NYSE, NASDAQ, OTC, AMEX - I research and select correct exchange for each ticker.

I return JSON array only without any additional text or formatting.`,
            messages: [
                {
                    role: "user",
                    content: `Analyze these ${batchItems.length} SEC filings:

${filings}`
                }
            ]
        });

        const response = message.content[0].text.trim();

        // Parse and validate JSON response
        let analysisArray;
        try {
            const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
            const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
            const jsonString = jsonMatch ? jsonMatch[0] : cleanResponse;
            analysisArray = JSON.parse(jsonString);
        } catch (parseError) {
            console.error('SEC JSON parsing failed:', parseError);
            throw new Error(`Invalid JSON response from Claude: ${parseError.message}`);
        }

        // Validate response structure
        if (!Array.isArray(analysisArray)) {
            throw new Error('Claude SEC response must be a JSON array');
        }

        if (analysisArray.length !== batchItems.length) {
            console.warn(`Expected ${batchItems.length} SEC results, got ${analysisArray.length}. Using available results.`);
            while (analysisArray.length < batchItems.length) {
                const missingIndex = analysisArray.length;
                analysisArray.push(getSECFallbackAnalysis(batchItems[missingIndex].sec_filings));
            }
        }

        // Validate and clean each analysis result
        const validatedResults = analysisArray.slice(0, batchItems.length).map((analysis, index) => {
            return validateAndCleanSECAnalysis(analysis, batchItems[index]);
        });

        console.log(`Successfully processed SEC batch analysis for ${validatedResults.length} items`);
        return validatedResults;

    } catch (error) {
        console.error('Claude SEC batch analysis error:', error);
        return batchItems.map(item => getSECFallbackAnalysis(item.sec_filings));
    }
}

// Validate and clean SEC analysis results
function validateAndCleanSECAnalysis(analysis, queueItem) {
    const filing = queueItem.sec_filings;

    const validated = {
        sec_filing_id: analysis.sec_filing_id || filing.id,
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
            ? analysis.ai_summary.substring(0, 500) : `${filing.form_type} filing from ${filing.company_name || 'company'}`,
        market_impact_assessment: typeof analysis.market_impact_assessment === 'string' && analysis.market_impact_assessment.length > 5
            ? analysis.market_impact_assessment.substring(0, 300) : 'SEC filing impact requires further analysis',
        tags: Array.isArray(analysis.tags)
            ? analysis.tags.slice(0, 5).map(tag => String(tag).toLowerCase().replace(/\s+/g, '_'))
            : [filing.filing_type, 'sec', filing.form_type.toLowerCase()]
    };

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(validated.sec_filing_id)) {
        validated.sec_filing_id = filing.id;
    }

    return validated;
}

// Save SEC analysis result to database
async function saveSECAnalysisResult(queueItem, analysis) {
    try {
        const filing = queueItem.sec_filings;
        const sourceId = filing.source_id;

        if (!sourceId) {
            throw new Error('No source_id found in SEC filing data');
        }

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
                sec_filing_id: analysis.sec_filing_id,
                source_id: sourceId,
                stock_ticker: analysis.stock_ticker,
                stock_exchange: analysis.stock_exchange,
                relevance_score: analysis.relevance_score,
                priority_level: analysis.priority_level,
                sentiment: analysis.sentiment,
                sentiment_strength: analysis.sentiment_strength,
                ai_summary: analysis.ai_summary,
                market_impact_assessment: analysis.market_impact_assessment,
                tags: analysis.tags,
                is_published: analysis.relevance_score >= 50,
                published_at: analysis.relevance_score >= 50 ? new Date().toISOString() : null
            })
            .select('id')
            .single();

        if (error) throw error;

        await updateQueueStatus(queueItem.id, 'completed');

        console.log(`✓ Saved SEC analysis for ${filing.sec_id} (${filing.form_type}, score: ${analysis.relevance_score}, ticker: ${analysis.stock_ticker || 'none'}, sentiment: ${analysis.sentiment} ${analysis.sentiment_strength}%)`);

        return {
            success: true,
            processedNewsId: data.id,
            published: analysis.relevance_score >= 50,
            relevanceScore: analysis.relevance_score,
            sentiment: `${analysis.sentiment} (${analysis.sentiment_strength}%)`
        };

    } catch (error) {
        console.error(`Error saving SEC analysis for ${queueItem.id}:`, error);
        await updateQueueStatus(queueItem.id, 'failed', error.message);
        return { success: false, error: error.message };
    }
}

// Fallback analysis if AI fails
function getSECFallbackAnalysis(filing) {
    const fallbackScores = {
        'merger_acquisition': 90,
        'major_event': 80,
        'insider_trading': 75,
        'stock_offering': 85,
        'quarterly_report': 60,
        'annual_report': 65
    };

    const fallbackSentiment = {
        'merger_acquisition': { sentiment: 'bullish', strength: 80 },
        'major_event': { sentiment: 'neutral', strength: 50 },
        'insider_trading': { sentiment: 'neutral', strength: 60 },
        'stock_offering': { sentiment: 'bearish', strength: 75 },
        'quarterly_report': { sentiment: 'neutral', strength: 50 },
        'annual_report': { sentiment: 'neutral', strength: 50 }
    };

    const sentimentData = fallbackSentiment[filing.filing_type] || { sentiment: 'neutral', strength: 50 };

    return {
        sec_filing_id: filing.id,
        stock_ticker: filing.ticker || null,
        stock_exchange: null,
        relevance_score: fallbackScores[filing.filing_type] || 50,
        priority_level: filing.priority || 'medium',
        sentiment: sentimentData.sentiment,
        sentiment_strength: sentimentData.strength,
        ai_summary: `${filing.form_type} filing from ${filing.company_name || 'company'} regarding ${filing.filing_type.replace('_', ' ')}.`,
        market_impact_assessment: 'SEC filing analysis unavailable - manual review recommended',
        tags: [filing.filing_type, 'sec', filing.form_type.toLowerCase()]
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