// src/app/api/fda/rss-feed/route.js - New RSS feed parser
import { NextResponse } from 'next/server';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const hoursAgo = parseInt(searchParams.get('hours') || '24'); // Default to 24 hours

    console.log(`Fetching FDA RSS feed for last ${hoursAgo} hours...`);

    // Fetch FDA Press Releases RSS Feed
    const rssResponse = await fetch('https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml');
    
    if (!rssResponse.ok) {
      throw new Error(`RSS feed returned ${rssResponse.status}: ${rssResponse.statusText}`);
    }

    const rssText = await rssResponse.text();
    const parsedFeed = await parseXML(rssText);

    if (!parsedFeed.rss || !parsedFeed.rss.channel || !parsedFeed.rss.channel[0].item) {
      throw new Error('Invalid RSS feed structure');
    }

    const items = parsedFeed.rss.channel[0].item;
    
    // Filter by time (last X hours)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursAgo);

    const recentItems = items.filter(item => {
      const pubDate = new Date(item.pubDate?.[0] || 0);
      return pubDate > cutoffTime;
    }).slice(0, limit);

    console.log(`Found ${recentItems.length} recent FDA announcements`);

    // Transform RSS items to our format
    const transformedData = recentItems.map((item, index) => {
      const title = item.title?.[0] || 'FDA Announcement';
      const description = item.description?.[0] || '';
      const link = item.link?.[0] || '';
      const pubDate = item.pubDate?.[0];
      
      // Determine announcement type based on title keywords
      const announcementType = categorizeAnnouncement(title, description);
      const priority = determinePriority(title, description, announcementType);
      
      return {
        id: `fda-rss-${Date.now()}-${index}`,
        title: title,
        description: description.substring(0, 500), // Truncate long descriptions
        link: link,
        pub_date: pubDate,
        announcement_date: formatDate(pubDate),
        announcement_type: announcementType,
        priority: priority,
        source: 'FDA RSS',
        category: announcementType,
        sponsor_name: extractCompanyName(title, description),
        product_name: extractProductName(title, description),
        classification: extractClassification(title, description),
        raw_data: {
          original_title: title,
          original_description: description,
          link: link,
          pub_date: pubDate,
          rss_source: 'FDA Press Releases'
        }
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedData,
      count: transformedData.length,
      hours_ago: hoursAgo,
      cutoff_time: cutoffTime.toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA RSS Feed Error:', error);
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

// Categorize announcement based on content
function categorizeAnnouncement(title, description) {
  const content = (title + ' ' + description).toLowerCase();
  
  if (content.includes('approve') && (content.includes('drug') || content.includes('medication') || content.includes('therapeutic'))) {
    return 'drug_approval';
  }
  
  if (content.includes('recall') || content.includes('safety') || content.includes('warning') || content.includes('alert')) {
    return 'safety_alert';
  }
  
  if (content.includes('device') || content.includes('510(k)') || content.includes('clearance')) {
    return 'device_approval';
  }
  
  return 'regulatory';
}

// Determine priority based on announcement content
function determinePriority(title, description, type) {
  const content = (title + ' ' + description).toLowerCase();
  
  // High priority keywords
  if (content.includes('first') || 
      content.includes('breakthrough') || 
      content.includes('class i') || 
      content.includes('urgent') ||
      content.includes('immediate') ||
      content.includes('novel')) {
    return 'high';
  }
  
  // Safety alerts are generally high priority
  if (type === 'safety_alert') {
    return 'high';
  }
  
  // New drug approvals are medium-high priority
  if (type === 'drug_approval') {
    return 'high';
  }
  
  return 'medium';
}

// Extract company name from text
function extractCompanyName(title, description) {
  const content = title + ' ' + description;
  
  // Common patterns for company mentions in FDA announcements
  const companyPatterns = [
    /(?:from|by|for)\s+([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Corporation|Company|Pharmaceuticals|Therapeutics|Sciences|Biotech)?)/g,
    /([A-Z][a-zA-Z\s&.,-]+(?:Inc|LLC|Corp|Corporation|Company|Pharmaceuticals|Therapeutics|Sciences|Biotech))/g
  ];
  
  for (const pattern of companyPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].replace(/^(from|by|for)\s+/, '').trim();
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
    /approves?\s+([A-Z][a-zA-Z0-9\s-]+)/gi
  ];
  
  for (const pattern of productPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      const productName = matches[0].replace(/^(drug|medication|product|device|approves?)\s+/gi, '').replace(/"/g, '').trim();
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
  
  return null;
}

// Format date to YYYY-MM-DD
function formatDate(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  } catch (error) {
    return new Date().toISOString().split('T')[0];
  }
}