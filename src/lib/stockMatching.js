// src/lib/stockMatching.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Enhanced company name to stock ticker matching
export async function enhancedStockMatching(companyName, productName = null) {
  if (!companyName) return null;

  try {
    // Step 1: Exact company name match
    const exactMatch = await findExactMatch(companyName);
    if (exactMatch) return exactMatch;

    // Step 2: Fuzzy company name matching
    const fuzzyMatch = await findFuzzyMatch(companyName);
    if (fuzzyMatch) return fuzzyMatch;

    // Step 3: Product/drug name matching (for subsidiaries)
    if (productName) {
      const productMatch = await findProductMatch(productName);
      if (productMatch) return productMatch;
    }

    // Step 4: Parent company lookup (for subsidiaries like "Janssen" -> "Johnson & Johnson")
    const parentMatch = await findParentCompanyMatch(companyName);
    if (parentMatch) return parentMatch;

    console.log(`No stock match found for: ${companyName}`);
    return null;

  } catch (error) {
    console.error('Error in enhanced stock matching:', error);
    return null;
  }
}

// Find exact company name match
async function findExactMatch(companyName) {
  const { data, error } = await supabase
    .from('stock_mappings')
    .select('stock_ticker, company_name')
    .ilike('company_name', companyName)
    .eq('is_active', true)
    .limit(1);

  if (error || !data || data.length === 0) return null;

  console.log(`✓ Exact match: ${companyName} → ${data[0].stock_ticker}`);
  return data[0].stock_ticker;
}

// Find fuzzy matches using partial string matching
async function findFuzzyMatch(companyName) {
  const cleanCompanyName = cleanCompanyName(companyName);
  
  const { data, error } = await supabase
    .from('stock_mappings')
    .select('stock_ticker, company_name, aliases')
    .eq('is_active', true);

  if (error || !data) return null;

  // Check company names and aliases
  for (const mapping of data) {
    // Check main company name
    const cleanMappingName = cleanCompanyName(mapping.company_name);
    if (isCompanyMatch(cleanCompanyName, cleanMappingName)) {
      console.log(`✓ Fuzzy match: ${companyName} → ${mapping.stock_ticker}`);
      return mapping.stock_ticker;
    }

    // Check aliases
    if (mapping.aliases) {
      for (const alias of mapping.aliases) {
        const cleanAlias = cleanCompanyName(alias);
        if (isCompanyMatch(cleanCompanyName, cleanAlias)) {
          console.log(`✓ Alias match: ${companyName} → ${mapping.stock_ticker} (via ${alias})`);
          return mapping.stock_ticker;
        }
      }
    }
  }

  return null;
}

// Product name matching (useful for subsidiaries)
async function findProductMatch(productName) {
  // This would require a product-to-company mapping table
  // For now, return null - can be enhanced later
  return null;
}

// Parent company matching for subsidiaries
async function findParentCompanyMatch(companyName) {
  const subsidiaryMappings = {
    'janssen': 'JNJ',
    'genentech': 'ROCHE', // Roche subsidiary
    'oncology ventures': 'JNJ',
    'centocor': 'JNJ',
    'tibotec': 'JNJ',
    'veracyte': 'VCYT',
    'catalyst pharmaceuticals': 'CPRX',
    'novavax': 'NVAX',
    'vaxart': 'VXRT',
    'inovio': 'INO',
    'moderna': 'MRNA',
    'biontech': 'BNTX',
    'curevac': 'CVAC',
    'translate bio': 'MRNA', // Acquired by Moderna
    'zogenix': 'ZGNX',
    'sage therapeutics': 'SAGE',
    'bluebird bio': 'BLUE',
    'spark therapeutics': 'ROCHE', // Acquired by Roche
    'kite pharma': 'GILD', // Acquired by Gilead
    'car-t': 'GILD' // CAR-T often relates to Gilead's Kite
  };

  const cleanName = cleanCompanyName(companyName).toLowerCase();
  
  for (const [subsidiary, ticker] of Object.entries(subsidiaryMappings)) {
    if (cleanName.includes(subsidiary.toLowerCase()) || subsidiary.toLowerCase().includes(cleanName)) {
      console.log(`✓ Subsidiary match: ${companyName} → ${ticker} (via ${subsidiary})`);
      return ticker;
    }
  }

  return null;
}

// Clean company name for better matching
function cleanCompanyName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/\b(inc|ltd|llc|corp|corporation|company|co|pharmaceutical|pharmaceuticals|pharma|therapeutics|sciences|systems|technologies|tech|biotech|bio)\b/g, '')
    .replace(/[.,\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Determine if two company names match
function isCompanyMatch(name1, name2) {
  if (!name1 || !name2) return false;
  
  // Exact match after cleaning
  if (name1 === name2) return true;
  
  // One contains the other (for cases like "Pfizer" vs "Pfizer Inc")
  if (name1.length >= 3 && name2.length >= 3) {
    if (name1.includes(name2) || name2.includes(name1)) {
      return true;
    }
  }

  // Word-based matching for multi-word companies
  const words1 = name1.split(' ').filter(w => w.length > 2);
  const words2 = name2.split(' ').filter(w => w.length > 2);
  
  if (words1.length > 0 && words2.length > 0) {
    const commonWords = words1.filter(w => words2.includes(w));
    // Match if they share most significant words
    return commonWords.length >= Math.min(words1.length, words2.length) * 0.6;
  }

  return false;
}

// Add new company mapping dynamically
export async function addCompanyMapping(companyName, stockTicker, exchange = null, aliases = []) {
  try {
    const { data, error } = await supabase
      .from('stock_mappings')
      .insert({
        company_name: companyName,
        stock_ticker: stockTicker.toUpperCase(),
        exchange: exchange,
        aliases: aliases,
        market_cap_category: 'penny', // Default to penny stock
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✓ Added new stock mapping: ${companyName} → ${stockTicker}`);
    return data;

  } catch (error) {
    console.error('Error adding stock mapping:', error);
    return null;
  }
}

// Batch update stock mappings
export async function updateStockMappingsFromAPI() {
  // This could fetch from external APIs like Alpha Vantage, Yahoo Finance, etc.
  // to keep stock mappings updated with current tickers
  console.log('Stock mapping updates would be implemented here');
  return { updated: 0 };
}