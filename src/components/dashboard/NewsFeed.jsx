// src/components/dashboard/NewsFeed.jsx - Updated for real-time RSS processing
'use client';
import { useState, useEffect } from 'react';
import NewsCard from './NewsCard';

export default function NewsFeed({ filters, onStatsUpdate }) {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    fetchNews();
    
    // Auto-refresh every 2 minutes for real-time updates
    const interval = setInterval(fetchNews, 120000);
    return () => clearInterval(interval);
  }, [filters]);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '20',
        priority: filters?.priority || 'all',
        category: filters?.category || 'all',
        timeframe: filters?.timeframe || '24h'
      });

      const response = await fetch(`/api/news?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setNewsItems(result.data);
        setError(null);
        setLastUpdate(new Date());
        
        // Trigger stats update when news is successfully fetched
        if (onStatsUpdate) {
          onStatsUpdate();
        }
      } else {
        setError('Failed to load news');
      }
    } catch (err) {
      setError('Failed to connect to news feed');
      console.error('News fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerFDAPipeline = async (hours = 24) => {
    try {
      setTriggering(true);
      setError(null);
      
      const response = await fetch('/api/admin/trigger-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'full', 
          limit: 15, 
          hours: hours // Real-time: last 1 hour by default
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`RSS Pipeline success:`, result.summary);
        
        // Show success message
        if (result.summary.ingested === 0) {
          setError(`No new FDA announcements found in the last ${hours} hour${hours > 1 ? 's' : ''}`);
        }
        
        // Wait a moment then refresh the news feed and stats
        setTimeout(() => {
          fetchNews(); // This will trigger stats update via onStatsUpdate
          setError(null);
        }, 3000);
      } else {
        setError(`RSS Pipeline failed: ${result.error}`);
      }
    } catch (err) {
      setError('Failed to trigger FDA RSS pipeline');
      console.error('RSS Pipeline trigger error:', err);
    } finally {
      setTriggering(false);
    }
  };

  const loadMoreNews = async () => {
    try {
      const params = new URLSearchParams({
        limit: '10',
        offset: newsItems.length.toString(),
        priority: filters?.priority || 'all',
        category: filters?.category || 'all',
        timeframe: filters?.timeframe || '24h'
      });

      const response = await fetch(`/api/news?${params}`);
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        // Filter out any duplicates before adding
        const existingIds = new Set(newsItems.map(item => item.id));
        const newItems = result.data.filter(item => !existingIds.has(item.id));
        
        if (newItems.length > 0) {
          setNewsItems(prev => [...prev, ...newItems]);
        }
      }
    } catch (err) {
      console.error('Load more error:', err);
    }
  };

  if (loading && newsItems.length === 0) {
    return (
      <div className="space-y-4">
        {/* Loading skeleton */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 animate-pulse">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="h-4 bg-zinc-700 rounded w-20 mb-2"></div>
                  <div className="h-3 bg-zinc-700 rounded w-32"></div>
                </div>
              </div>
              <div className="h-8 w-16 bg-zinc-700 rounded"></div>
            </div>
            <div className="space-y-3">
              <div className="h-5 bg-zinc-700 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-700 rounded w-full"></div>
              <div className="h-4 bg-zinc-700 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && newsItems.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
        <div className="text-red-400 text-2xl mb-4">⚠</div>
        <h3 className="text-xl font-medium text-white mb-2">
          {error.includes('No new FDA') ? 'No Recent Announcements' : 'Connection Error'}
        </h3>
        <p className="text-gray-400 mb-6">{error}</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={fetchNews}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
          >
            Retry Connection
          </button>
          <button
            onClick={() => triggerFDAPipeline(24)}
            disabled={triggering}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded transition-colors disabled:opacity-50"
          >
            {triggering ? 'Processing...' : 'Check Last 24 Hours'}
          </button>
          <button
            onClick={() => triggerFDAPipeline(6)}
            disabled={triggering}
            className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded transition-colors disabled:opacity-50"
          >
            {triggering ? 'Processing...' : 'Check Last 6 Hours'}
          </button>
        </div>
      </div>
    );
  }

  if (newsItems.length === 0) {
    return (
      <div className="space-y-4">
        {/* Real-Time Status Header */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                Real-Time RSS Feed
              </span>
              <span className="text-sm text-gray-400">
                Monitoring FDA press releases
              </span>
              {lastUpdate && (
                <span className="text-xs text-gray-500">
                  • Updated {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button 
              onClick={fetchNews}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh news feed"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
          <div className="text-4xl mb-4">📡</div>
          <h3 className="text-xl font-medium text-white mb-2">
            Ready for Real-Time Analysis
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Click below to fetch and analyze recent FDA press releases. The AI will process them in real-time and display relevant penny stock trading intelligence.
          </p>
          
          {/* Process Overview */}
          <div className="bg-zinc-800 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h4 className="text-sm font-medium text-white mb-2">Real-Time Process:</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Parse FDA RSS press releases</li>
              <li>Filter by time (last 1-24 hours)</li>
              <li>AI filter for publicly traded companies</li>
              <li>Real-time relevance scoring</li>
              <li>Breaking news alerts</li>
            </ul>
          </div>

          <div className="flex justify-center space-x-3 flex-wrap gap-2">
            <button
              onClick={() => triggerFDAPipeline(24)}
              disabled={triggering}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded transition-colors disabled:opacity-50 font-medium"
            >
              {triggering ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  Processing...
                </>
              ) : (
                'Last 24 Hours'
              )}
            </button>
            
            <button
              onClick={() => triggerFDAPipeline(6)}
              disabled={triggering}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded transition-colors disabled:opacity-50 font-medium"
            >
              Last 6 Hours
            </button>
            
            <button
              onClick={() => triggerFDAPipeline(1)}
              disabled={triggering}
              className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded transition-colors disabled:opacity-50 font-medium"
            >
              Last Hour
            </button>
            
            <button
              onClick={() => {
                setNewsItems([{
                  id: 'demo-rss',
                  title: 'Demo: FDA Approves Breakthrough Cancer Drug via RSS',
                  summary: 'This is a demo showing real-time RSS processing. Live FDA press releases will appear here within minutes of publication.',
                  priority: 'high',
                  category: 'drug_approval',
                  timestamp: 'Just now',
                  ticker: 'DEMO',
                  relevanceScore: 92,
                  source: 'FDA RSS (Demo)',
                  marketImpact: 'Expected immediate positive catalyst - breaking news from official FDA press release.',
                  tags: ['breaking_news', 'real_time', 'drug_approval', 'cancer'],
                  companyName: 'Demo Biotech Inc'
                }]);
                if (onStatsUpdate) {
                  onStatsUpdate();
                }
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-3 rounded transition-colors text-sm"
            >
              Preview Demo
            </button>
          </div>
          
          {/* Info Note */}
          <div className="mt-6 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 <strong>Real-Time:</strong> This system processes FDA press releases as they're published, 
              typically within 5-15 minutes of official release.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Real-Time Status Bar */}
      <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Live Feed
            </span>
            <span className="text-sm text-gray-400">
              {newsItems.length} items • Auto-refresh every 2min
            </span>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {error && (
              <span className="text-xs text-amber-400 mr-2">Update failed</span>
            )}
            <button
              onClick={() => triggerFDAPipeline(24)}
              disabled={triggering}
              className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3 py-1 rounded transition-colors disabled:opacity-50"
            >
              {triggering ? 'Checking...' : 'Check Now'}
            </button>
          </div>
        </div>
      </div>

      {/* News Items */}
      <div className="space-y-4">
        {newsItems.map((item) => (
          <NewsCard
            key={item.id}
            title={item.title}
            summary={item.summary}
            priority={item.priority}
            category={item.category}
            timestamp={item.timestamp}
            ticker={item.ticker}
            relevanceScore={item.relevanceScore}
            source={item.source}
            marketImpact={item.marketImpact}
            tags={item.tags}
            companyName={item.companyName}
          />
        ))}
      </div>

      {/* Load More Button */}
      {newsItems.length > 0 && (
        <div className="flex justify-center mt-8">
          <button 
            onClick={loadMoreNews}
            className="bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 px-6 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More News'}
          </button>
        </div>
      )}

      {/* Status Footer */}
      {newsItems.length > 0 && (
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Real-time updates from FDA RSS feed • Auto-refresh every 2 minutes • Default: Last 24 hours
          </p>
        </div>
      )}
    </div>
  );
}