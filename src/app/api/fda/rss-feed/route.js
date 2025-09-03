// src/app/api/fda/rss-feed/route.js - Updated with full timestamp support
import { NextResponse } from 'next/server';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

// FDA RSS Feed URLs
const FDA_RSS_FEEDS = {
  press_releases: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
  medwatch_alerts: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeframe = searchParams.get('timeframe') || '24h'; // 24h, 1w, 1m

    console.log(`Fetching FDA RSS feeds for timeframe: ${timeframe}...`);

    // Calculate time cutoff based on timeframe
    const cutoffTime = calculateTimeframe(timeframe);

    // Fetch both RSS feeds concurrently with enhanced configuration
    const feedPromises = Object.entries(FDA_RSS_FEEDS).map(async ([feedType, feedUrl]) => {
      try {
        console.log(`Fetching ${feedType} from ${feedUrl}...`);

        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          },
          timeout: 30000, // 30 second timeout
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
          throw new Error(`${feedType} RSS feed returned ${response.status}: ${response.statusText}`);
        }

        const rssText = await response.text();

        if (!rssText || rssText.trim().length === 0) {
          throw new Error(`Empty response from ${feedType} RSS feed`);
        }

        const parsedFeed = await parseXML(rssText);

        if (!parsedFeed.rss || !parsedFeed.rss.channel || !parsedFeed.rss.channel[0].item) {
          throw new Error(`Invalid RSS feed structure for ${feedType}`);
        }

        const items = parsedFeed.rss.channel[0].item;

        // Filter by time and transform items
        const recentItems = items
          .filter(item => {
            const pubDate = new Date(item.pubDate?.[0] || 0);
            return pubDate > cutoffTime;
          })
          .map((item, index) => transformRSSItem(item, feedType, index));

        console.log(`✓ Successfully fetched ${recentItems.length} recent items from ${feedType}`);
        return recentItems;

      } catch (error) {
        console.error(`❌ Error fetching ${feedType}:`, error.message);

        // Return empty array but log the specific error
        if (error.name === 'AbortError') {
          console.error(`${feedType}: Request timed out after 30 seconds`);
        } else if (error.code === 'ECONNRESET') {
          console.error(`${feedType}: Connection reset by FDA server - may need to retry later`);
        } else if (error.code === 'ENOTFOUND') {
          console.error(`${feedType}: DNS lookup failed - check internet connection`);
        }

        return []; // Return empty array on error to continue with other feeds
      }
    });

    // Wait for all feeds to complete
    const feedResults = await Promise.all(feedPromises);

    // Combine all feed results
    const allData = feedResults.flat();

    if (allData.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: `No FDA announcements found in the last ${timeframe}`,
        timeframe: timeframe,
        cutoff_time: cutoffTime.toISOString(),
        timestamp: new Date().toISOString()
      });
    }

    // Sort by publication date (most recent first)
    allData.sort((a, b) => {
      const dateA = new Date(a.pub_date_full || 0);
      const dateB = new Date(b.pub_date_full || 0);
      return dateB - dateA;
    });

    // Apply final limit
    const limitedData = allData.slice(0, limit);

    console.log(`Returning ${limitedData.length} combined FDA RSS announcements`);

    return NextResponse.json({
      success: true,
      data: limitedData,
      count: limitedData.length,
      total_found: allData.length,
      timeframe: timeframe,
      cutoff_time: cutoffTime.toISOString(),
      sources: Object.keys(FDA_RSS_FEEDS),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Multi-RSS Feed Error:', error);
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

// Calculate cutoff time based on timeframe
function calculateTimeframe(timeframe) {
  const now = new Date();
  const cutoffTime = new Date(now);

  switch (timeframe) {
    case '24h':
      cutoffTime.setHours(cutoffTime.getHours() - 24);
      break;
    case '1w':
      cutoffTime.setDate(cutoffTime.getDate() - 7);
      break;
    case '1m':
      cutoffTime.setMonth(cutoffTime.getMonth() - 1);
      break;
    default:
      // Default to 24 hours
      cutoffTime.setHours(cutoffTime.getHours() - 24);
  }

  return cutoffTime;
}

// Transform RSS item to our format with full timestamp support
function transformRSSItem(item, feedType, index) {
  const title = item.title?.[0] || 'FDA Announcement';
  const description = item.description?.[0] || '';
  const link = item.link?.[0] || '';
  const pubDateString = item.pubDate?.[0];

  // Parse the full RSS publication date
  const pubDateFull = pubDateString ? new Date(pubDateString) : new Date();

  // Determine announcement type based on feed type and content
  const announcementType = categorizeAnnouncement(title, description, feedType);
  const priority = determinePriority(title, description, announcementType, feedType);

  return {
    id: `fda-rss-${feedType}-${Date.now()}-${index}`,
    title: title,
    description: description.substring(0, 500), // Truncate long descriptions
    link: link,
    pub_date: pubDateString, // Original RSS pubDate string
    pub_date_full: pubDateFull.toISOString(), // Full timestamp for sorting/filtering
    announcement_date: pubDateFull.toISOString(), // Use RSS publication date
    announcement_type: announcementType,
    priority: priority,
    source: feedType === 'press_releases' ? 'FDA Press Releases' : 'FDA MedWatch Alerts',
    feed_type: feedType,
    category: announcementType,
    sponsor_name: extractCompanyName(title, description),
    product_name: extractProductName(title, description),
    classification: extractClassification(title, description),
    raw_data: {
      original_title: title,
      original_description: description,
      link: link,
      pub_date: pubDateString,
      pub_date_full: pubDateFull.toISOString(),
      rss_source: feedType,
      feed_url: FDA_RSS_FEEDS[feedType]
    }
  };
}

// Enhanced categorization considering feed type
function categorizeAnnouncement(title, description, feedType) {
  const content = (title + ' ' + description).toLowerCase();

  // MedWatch alerts are primarily safety-related
  if (feedType === 'medwatch_alerts') {
    if (content.includes('recall') || content.includes('safety') || content.includes('alert')) {
      return 'safety_alert';
    }
    return 'safety_alert'; // Default for MedWatch
  }

  // Press releases have various types
  if (feedType === 'press_releases') {
    if (content.includes('approve') && (content.includes('drug') || content.includes('medication') || content.includes('therapeutic'))) {
      return 'drug_approval';
    }

    if (content.includes('recall') || content.includes('safety') || content.includes('warning') || content.includes('alert')) {
      return 'safety_alert';
    }

    if (content.includes('device') || content.includes('510(k)') || content.includes('clearance')) {
      return 'device_approval';
    }
  }

  return 'regulatory';
}

// Enhanced priority determination
function determinePriority(title, description, type, feedType) {
  const content = (title + ' ' + description).toLowerCase();

  // MedWatch alerts are generally high priority
  if (feedType === 'medwatch_alerts') {
    return 'high';
  }

  // High priority keywords
  if (content.includes('first') ||
    content.includes('breakthrough') ||
    content.includes('class i') ||
    content.includes('urgent') ||
    content.includes('immediate') ||
    content.includes('novel') ||
    content.includes('emergency') ||
    content.includes('voluntary recall')) {
    return 'high';
  }

  // Safety alerts and drug approvals are generally high priority
  if (type === 'safety_alert' || type === 'drug_approval') {
    return 'high';
  }

  // Device approvals are medium priority
  if (type === 'device_approval') {
    return 'medium';
  }

  return 'medium';
}

// Extract company name from text
function extractCompanyName(title, description) {
  const content = title + ' ' + description;

  // Common patterns for company mentions in FDA announcements
  const companyPatterns = [
    /(?:from|by|for|recalls?)\s+([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Corporation|Company|Pharmaceuticals|Therapeutics|Sciences|Biotech)?)/gi,
    /([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Corporation|Company|Pharmaceuticals|Therapeutics|Sciences|Biotech))/g,
    // MedWatch specific patterns
    /(?:manufactured by|distributed by|marketed by)\s+([A-Z][a-zA-Z\s&.,-]+)/gi
  ];

  for (const pattern of companyPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const company = matches[0]
        .replace(/^(from|by|for|recalls?|manufactured by|distributed by|marketed by)\s+/gi, '')
        .trim();
      if (company.length > 2 && company.length < 100) {
        return company;
      }
    }
  }

  return null;
}

// Extract product name from text
function extractProductName(title, description) {
  const content = title + ' ' + description;

  // Look for product names in quotes or after specific keywords
  const productPatterns = [
    /"([^"]+)"/g, // Text in quotes
    /(?:drug|medication|product|device)\s+([A-Z][a-zA-Z0-9\s-]+)/gi,
    /approves?\s+([A-Z][a-zA-Z0-9\s-]+)/gi,
    // MedWatch specific patterns
    /lot\s+#?([A-Z0-9\s-]+)/gi,
    /batch\s+#?([A-Z0-9\s-]+)/gi
  ];

  for (const pattern of productPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const productName = matches[0]
        .replace(/^(drug|medication|product|device|approves?|lot|batch)\s+#?/gi, '')
        .replace(/"/g, '')
        .trim();
      if (productName.length > 2 && productName.length < 100) {
        return productName;
      }
    }
  }

  return null;
}

// Extract classification from content
function extractClassification(title, description) {
  const content = (title + ' ' + description).toLowerCase();

  if (content.includes('class i')) return 'Class I';
  if (content.includes('class ii')) return 'Class II';
  if (content.includes('class iii')) return 'Class III';
  if (content.includes('510(k)')) return '510(k)';
  if (content.includes('pma')) return 'PMA';
  if (content.includes('breakthrough')) return 'Breakthrough Therapy';
  if (content.includes('fast track')) return 'Fast Track';
  if (content.includes('voluntary recall')) return 'Voluntary Recall';
  if (content.includes('fda-initiated')) return 'FDA-Initiated Recall';

  return null;
}