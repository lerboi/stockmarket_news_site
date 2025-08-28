// src/components/dashboard/StatsOverview.js
'use client';
import { useState, useEffect } from 'react';

export default function StatsOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
        setError(null);
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

  if (loading) {
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

  if (error) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 bg-red-900/20 border border-red-800 rounded-lg p-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
          <button 
            onClick={fetchStats}
            className="mt-2 text-red-300 hover:text-red-200 text-xs underline"
          >
            Retry
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