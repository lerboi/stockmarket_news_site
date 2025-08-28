// src/lib/aiFiltering.js
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Specialized AI analysis for different FDA announcement types
export async function analyzeAnnouncementType(announcement, stockTicker) {
  switch (announcement.announcement_type) {
    case 'drug_approval':
      return await analyzeDrugApproval(announcement, stockTicker);
    case 'safety_alert':
      return await analyzeSafetyAlert(announcement, stockTicker);
    case 'device_approval':
      return await analyzeDeviceApproval(announcement, stockTicker);
    default:
      return await analyzeGenericAnnouncement(announcement, stockTicker);
  }
}

// Drug approval analysis
async function analyzeDrugApproval(announcement, stockTicker) {
  const prompt = `
Analyze this FDA drug approval for investment impact on penny stocks/biotech:

Company: ${announcement.sponsor_name}
Drug: ${announcement.product_name}
Stock Ticker: ${stockTicker || 'Unknown'}
Approval Date: ${announcement.announcement_date}
Application: ${announcement.raw_data?.application_number || 'N/A'}

Key factors for penny stocks:
- First-in-class drugs = extremely bullish (95+ score)
- Orphan drugs = very bullish (80+ score) 
- Generic approvals = moderately bullish (60+ score)
- Follow-on indications = moderately bullish (50-70 score)
- Small biotech companies = higher volatility potential

Return JSON with:
{
  "relevanceScore": 0-100,
  "priorityLevel": "high/medium/low",
  "summary": "2-3 sentences for traders",
  "marketImpact": "Expected price movement and reasoning",
  "tags": ["fda_approval", "biotech", "..."],
  "riskFactors": ["market competition", "commercial viability", "..."],
  "catalystType": "drug_approval"
}`;

  return await callClaude(prompt, 'drug-approval');
}

// Safety alert analysis  
async function analyzeSafetyAlert(announcement, stockTicker) {
  const prompt = `
Analyze this FDA safety alert/recall for stock impact:

Company: ${announcement.sponsor_name || announcement.recalling_firm}
Product: ${announcement.product_name || announcement.product_description}
Stock: ${stockTicker || 'Unknown'}
Classification: ${announcement.classification}
Reason: ${announcement.raw_data?.reason_for_recall || 'Unknown'}

Recall impact scoring:
- Class I (life-threatening) = 80-100 score, likely bearish
- Class II (reversible harm) = 50-80 score, moderately bearish  
- Class III (unlikely harm) = 20-50 score, minor impact
- Voluntary vs mandatory = affects severity

Return JSON with:
{
  "relevanceScore": 0-100,
  "priorityLevel": "high/medium/low", 
  "summary": "Key points for traders",
  "marketImpact": "Expected stock reaction",
  "tags": ["safety_recall", "risk", "..."],
  "severityAssessment": "Impact severity explanation",
  "catalystType": "safety_alert"
}`;

  return await callClaude(prompt, 'safety-alert');
}

// Device approval analysis
async function analyzeDeviceApproval(announcement, stockTicker) {
  const prompt = `
Analyze this FDA device clearance for investment potential:

Company: ${announcement.applicant}
Device: ${announcement.device_name}  
Stock: ${stockTicker || 'Unknown'}
Clearance: ${announcement.k_number}
Decision: ${announcement.decision}

Device impact factors:
- Novel devices = higher impact (70+ score)
- 510(k) clearances = standard process (40-70 score)
- De Novo pathway = innovative (80+ score)
- Advisory committee involvement = higher significance

Return JSON with:
{
  "relevanceScore": 0-100,
  "priorityLevel": "high/medium/low",
  "summary": "Investment implications", 
  "marketImpact": "Expected market reaction",
  "tags": ["device_clearance", "medtech", "..."],
  "innovationLevel": "Assessment of device novelty",
  "catalystType": "device_approval"  
}`;

  return await callClaude(prompt, 'device-approval');
}

// Generic announcement analysis
async function analyzeGenericAnnouncement(announcement, stockTicker) {
  const prompt = `
Analyze this FDA announcement for stock trading relevance:

Type: ${announcement.announcement_type}
Company: ${announcement.sponsor_name}
Description: ${announcement.description}
Stock: ${stockTicker || 'Unknown'}

Provide general analysis focusing on:
- Regulatory significance
- Market timing
- Competition impact
- Revenue implications

Return JSON with:
{
  "relevanceScore": 0-100,
  "priorityLevel": "high/medium/low",
  "summary": "Investment implications",
  "marketImpact": "Expected market reaction", 
  "tags": ["regulatory", "..."],
  "catalystType": "regulatory"
}`;

  return await callClaude(prompt, 'generic');
}

// Claude API call with error handling
async function callClaude(prompt, analysisType) {
  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 600,
      temperature: 0.2, // Lower temperature for more consistent analysis
      messages: [
        {
          role: "user",
          content: `You are a financial analyst specializing in biotech/pharmaceutical penny stocks. Provide JSON responses only.\n\n${prompt}`
        }
      ]
    });

    const response = message.content[0].text.trim();
    
    // Parse and validate JSON response
    const analysis = JSON.parse(response);
    
    // Ensure required fields exist
    const validatedAnalysis = {
      relevanceScore: Math.max(0, Math.min(100, analysis.relevanceScore || 0)),
      priorityLevel: ['high', 'medium', 'low'].includes(analysis.priorityLevel) 
        ? analysis.priorityLevel : 'medium',
      summary: analysis.summary || 'Analysis unavailable',
      marketImpact: analysis.marketImpact || 'Impact unclear',
      tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 8) : ['fda', 'regulatory'],
      catalystType: analysis.catalystType || analysisType,
      // Optional fields
      riskFactors: analysis.riskFactors || [],
      severityAssessment: analysis.severityAssessment || null,
      innovationLevel: analysis.innovationLevel || null
    };

    return validatedAnalysis;

  } catch (error) {
    console.error(`Claude API Error (${analysisType}):`, error);
    
    // Return fallback analysis
    return getFallbackAnalysis(analysisType);
  }
}

// Fallback analysis when AI fails
function getFallbackAnalysis(analysisType) {
  const fallbacks = {
    'drug-approval': {
      relevanceScore: 75,
      priorityLevel: 'high',
      summary: 'FDA drug approval - potential positive catalyst for biotech stock.',
      marketImpact: 'Drug approvals typically drive positive price movement for biotech companies.',
      tags: ['fda_approval', 'biotech', 'drug', 'catalyst'],
      catalystType: 'drug_approval'
    },
    'safety-alert': {
      relevanceScore: 80,
      priorityLevel: 'high', 
      summary: 'FDA safety alert - potential negative catalyst requiring immediate attention.',
      marketImpact: 'Safety alerts often create downward pressure on pharmaceutical stocks.',
      tags: ['safety_alert', 'recall', 'risk', 'regulatory'],
      catalystType: 'safety_alert'
    },
    'device-approval': {
      relevanceScore: 60,
      priorityLevel: 'medium',
      summary: 'FDA device clearance - moderate positive catalyst for medical device company.',
      marketImpact: 'Device approvals provide steady positive momentum for medtech stocks.',
      tags: ['device_clearance', 'medtech', 'approval'],
      catalystType: 'device_approval'
    },
    'generic': {
      relevanceScore: 45,
      priorityLevel: 'medium',
      summary: 'FDA regulatory update with potential market implications.',
      marketImpact: 'Regulatory updates may create short-term volatility.',
      tags: ['fda', 'regulatory', 'update'],
      catalystType: 'regulatory'
    }
  };

  return fallbacks[analysisType] || fallbacks['generic'];
}

// Batch analysis for multiple announcements
export async function batchAnalyzeAnnouncements(announcements, maxConcurrent = 3) {
  const batches = [];
  for (let i = 0; i < announcements.length; i += maxConcurrent) {
    batches.push(announcements.slice(i, i + maxConcurrent));
  }

  const results = [];
  for (const batch of batches) {
    const batchResults = await Promise.allSettled(
      batch.map(ann => analyzeAnnouncementType(ann.announcement, ann.stockTicker))
    );
    
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Smart filtering based on market conditions
export function applyMarketContextFiltering(analysis, marketConditions = {}) {
  let adjustedScore = analysis.relevanceScore;

  // Adjust scores based on market volatility
  if (marketConditions.volatility === 'high') {
    // In high volatility, news has more impact
    adjustedScore = Math.min(100, adjustedScore * 1.2);
  } else if (marketConditions.volatility === 'low') {
    // In low volatility, reduce impact slightly
    adjustedScore = adjustedScore * 0.9;
  }

  // Adjust for sector sentiment
  if (marketConditions.biotechSentiment === 'bearish') {
    // In bearish biotech markets, positive news has more relative impact
    if (analysis.catalystType === 'drug_approval') {
      adjustedScore = Math.min(100, adjustedScore * 1.3);
    }
  } else if (marketConditions.biotechSentiment === 'bullish') {
    // In bullish markets, bad news has more impact
    if (analysis.catalystType === 'safety_alert') {
      adjustedScore = Math.min(100, adjustedScore * 1.2);
    }
  }

  // Adjust priority level based on adjusted score
  let adjustedPriority = analysis.priorityLevel;
  if (adjustedScore >= 80) adjustedPriority = 'high';
  else if (adjustedScore >= 50) adjustedPriority = 'medium';
  else adjustedPriority = 'low';

  return {
    ...analysis,
    relevanceScore: Math.round(adjustedScore),
    priorityLevel: adjustedPriority,
    originalScore: analysis.relevanceScore,
    marketAdjustments: marketConditions
  };
}

// Content quality scoring
export function scoreContentQuality(announcement) {
  let qualityScore = 0;

  // Check for key information completeness
  if (announcement.sponsor_name) qualityScore += 20;
  if (announcement.product_name) qualityScore += 20;
  if (announcement.announcement_date) qualityScore += 15;
  if (announcement.description && announcement.description.length > 50) qualityScore += 25;
  if (announcement.raw_data && Object.keys(announcement.raw_data).length > 5) qualityScore += 20;

  return Math.min(100, qualityScore);
}

// Generate trading alerts based on analysis
export function generateTradingAlert(analysis, announcement, stockTicker) {
  if (analysis.relevanceScore < 60) return null;

  const alertTypes = {
    'drug_approval': '🚀 FDA APPROVAL',
    'safety_alert': '⚠️ SAFETY ALERT', 
    'device_approval': '✅ DEVICE CLEARED',
    'regulatory': '📋 REGULATORY UPDATE'
  };

  const alertType = alertTypes[analysis.catalystType] || '📊 FDA UPDATE';
  
  return {
    type: 'trading_alert',
    urgency: analysis.priorityLevel,
    title: `${alertType}: ${stockTicker ? '$' + stockTicker : announcement.sponsor_name}`,
    message: analysis.summary,
    impact: analysis.marketImpact,
    score: analysis.relevanceScore,
    timestamp: new Date().toISOString(),
    tags: analysis.tags
  };
}