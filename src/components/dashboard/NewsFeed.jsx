// src/components/dashboard/NewsFeed.js - Modified to trigger stats updates
'use client';
import { useState, useEffect } from 'react';
import NewsCard from './NewsCard';

export default function NewsFeed({ filters, onStatsUpdate }) {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetchNews();
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

  const triggerFDAPipeline = async () => {
    try {
      setTriggering(true);
      const response = await fetch('/api/admin/trigger-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'full', limit: 10 })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Wait a moment then refresh the news feed and stats
        setTimeout(() => {
          fetchNews(); // This will trigger stats update via onStatsUpdate
        }, 3000);
      } else {
        setError(`Pipeline failed: ${result.error}`);
      }
    } catch (err) {
      setError('Failed to trigger FDA pipeline');
      console.error('Pipeline trigger error:', err);
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

  if (error) {
    return (
      <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800 text-center">
        <div className="text-red-400 text-2xl mb-4">⚠</div>
        <h3 className="text-xl font-medium text-white mb-2">
          Connection Error
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
            onClick={triggerFDAPipeline}
            disabled={triggering}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded transition-colors disabled:opacity-50"
          >
            {triggering ? 'Processing...' : 'Trigger FDA Pipeline'}
          </button>
        </div>
      </div>
    );
  }

  if (newsItems.length === 0) {
    return (
      <div className="space-y-4">
        {/* Status Header */}
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                <span className="w-2 h-2 bg-amber-400 rounded-full mr-2 animate-pulse"></span>
                Waiting for Data
              </span>
              <span className="text-sm text-gray-400">
                No FDA announcements processed yet
              </span>
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
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-medium text-white mb-2">
            Ready to Start Analysis
          </h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Click below to fetch and analyze recent FDA announcements. The AI will process them and display relevant penny stock trading intelligence.
          </p>
          
          {/* Process Overview */}
          <div className="bg-zinc-800 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h4 className="text-sm font-medium text-white mb-2">Analysis Process:</h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Fetch FDA drug approvals & safety alerts</li>
              <li>AI filter for publicly traded companies only</li>
              <li>AI analysis for market impact scoring</li>
              <li>Display high-relevance trading news</li>
            </ul>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={triggerFDAPipeline}
              disabled={triggering}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded transition-colors disabled:opacity-50 font-medium"
            >
              {triggering ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  Processing FDA Data...
                </>
              ) : (
                'Fetch FDA News'
              )}
            </button>
            <button
              onClick={() => {
                setNewsItems([{
                  id: 'demo',
                  title: 'Demo: FDA Approves Breakthrough Drug for Rare Disease',
                  summary: 'This is a demo news item showing the interface. Real FDA news will appear here after processing.',
                  priority: 'high',
                  category: 'drug_approval',
                  timestamp: 'Just now',
                  ticker: 'DEMO',
                  relevanceScore: 85,
                  source: 'FDA (Demo)',
                  marketImpact: 'Expected positive catalyst for small biotech companies in rare disease space.',
                  tags: ['demo', 'drug_approval', 'biotech'],
                  companyName: 'Demo Pharmaceutical Inc'
                }]);
                // Trigger stats update when demo is loaded
                if (onStatsUpdate) {
                  onStatsUpdate();
                }
              }}
              className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-3 rounded transition-colors text-sm"
            >
              Preview Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
            Updates when new FDA announcements are processed
          </p>
        </div>
      )}
    </div>
  );
}