// src/components/dashboard/StatsOverview.js - Event-driven updates only
'use client';
import { useState, useEffect } from 'react';

export default function StatsOverview({ refreshTrigger = 0 }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Only fetch stats on initial load or when refreshTrigger changes
  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  const fetchStats = async () => {
    try {
      setError(null);
      const response = await fetch('/api/stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
        setLastUpdated(new Date());
      } else {
        setError('Failed to load stats');
      }
    } catch (err) {
      setError('Failed to connect');
      console.error('Stats fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    setLoading(true);
    fetchStats();
  };

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 animate-pulse">
            <div className="h-4 bg-zinc-700 rounded mb-2"></div>
            <div className="h-8 bg-zinc-700 rounded mb-1"></div>
            <div className="h-3 bg-zinc-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button 
            onClick={handleManualRefresh}
            className="mt-2 text-red-300 hover:text-red-200 text-xs underline"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  const statsData = [
    {
      title: "Today's News",
      value: stats?.todaysNews || 0,
      subtitle: "Filtered items",
      trend: getTrend(stats?.trends?.activityTrend),
      icon: "📰"
    },
    {
      title: "High Priority",
      value: stats?.highPriority || 0,
      subtitle: "Market movers",
      trend: stats?.trends?.highPriorityPercent > 25 ? "up" : "neutral",
      icon: "🚨",
      extra: stats?.trends?.highPriorityPercent ? `${stats.trends.highPriorityPercent}%` : null
    }
  ];

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        {statsData.map((stat, index) => (
          <div key={index} className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">{stat.title}</p>
                <div className="flex items-baseline space-x-2">
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                  {stat.extra && (
                    <span className="text-sm text-blue-400">({stat.extra})</span>
                  )}
                </div>
                <div className="flex items-center space-x-1 mt-1">
                  <p className="text-xs text-gray-500">{stat.subtitle}</p>
                  {stat.trend !== "neutral" && (
                    <span className={`text-xs ${getTrendColor(stat.trend)}`}>
                      {getTrendIcon(stat.trend)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-2xl opacity-50">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual Refresh Section */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {error && stats && (
            <span className="text-amber-400">
              • Update failed, showing cached data
            </span>
          )}
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={loading}
          className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 flex items-center space-x-1"
        >
          <svg 
            className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          <span>{loading ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}

function getTrend(trendValue) {
  if (trendValue === 'up') return 'up';
  if (trendValue === 'down') return 'down';
  return 'neutral';
}

function getTrendColor(trend) {
  switch (trend) {
    case 'up': return 'text-green-400';
    case 'down': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function getTrendIcon(trend) {
  switch (trend) {
    case 'up': return '↗';
    case 'down': return '↘';
    default: return '→';
  }
}