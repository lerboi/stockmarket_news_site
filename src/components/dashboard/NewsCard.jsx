// src/components/dashboard/NewsCard.js
'use client';

export default function NewsCard({ 
  title, 
  summary, 
  priority, 
  category, 
  timestamp, 
  ticker, 
  relevanceScore,
  source,
  marketImpact,
  tags = [],
  companyName
}) {
  // Priority color mapping
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Category mapping without emojis
  const getCategoryDisplay = (category) => {
    switch (category) {
      case 'drug_approval':
        return 'Drug Approval';
      case 'safety_alert':
        return 'Safety Alert';
      case 'device_approval':
        return 'Device Approval';
      case 'regulatory':
        return 'Regulatory';
      default:
        return 'FDA Update';
    }
  };

  // Get relevance score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 mb-1">
              {ticker && (
                <span className="text-blue-400 font-mono text-sm font-bold">
                  ${ticker}
                </span>
              )}
              {companyName && !ticker && (
                <span className="text-gray-300 text-sm font-medium">
                  {companyName}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getPriorityColor(priority)}`}>
                {priority.toUpperCase()}
              </span>
              <span className="text-gray-400 text-xs">
                {getCategoryDisplay(category)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {source} • {timestamp}
            </p>
          </div>
        </div>
        
        {relevanceScore && (
          <div className="text-right">
            <div className={`text-lg font-bold ${getScoreColor(relevanceScore)}`}>
              {relevanceScore}%
            </div>
            <div className="text-xs text-gray-500">
              relevance
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white leading-tight">
          {title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          {summary}
        </p>
        
        {/* Market Impact */}
        {marketImpact && (
          <div className="bg-zinc-800 rounded-lg p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-blue-400">Market Impact:</span> {marketImpact}
            </p>
          </div>
        )}

        {/* Key Tags - Show only most relevant ones without hashtags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 3).map((tag, index) => (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-zinc-800 text-zinc-400 rounded border border-zinc-700"
              >
                {tag.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Trading Actions - Focused on trading activities */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
        <div className="flex items-center space-x-4">
          {ticker && (
            <>
              <button className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Chart</span>
              </button>
              <button className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                <span>Add Alert</span>
              </button>
            </>
          )}
          <button className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span>Watchlist</span>
          </button>
        </div>
        <button className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium">
          View Details →
        </button>
      </div>
    </div>
  );
}