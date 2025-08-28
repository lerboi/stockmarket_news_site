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
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Category icon mapping
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'earnings':
      case 'drug_approval':
        return '💊';
      case 'sec_filings':
      case 'safety_alert':
        return '⚠️';
      case 'fda':
      case 'device_approval':
        return '🏥';
      case 'press_releases':
      case 'regulatory':
        return '📋';
      case 'insider_trading':
        return '👤';
      default:
        return '📊';
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
          <span className="text-2xl">{getCategoryIcon(category)}</span>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              {ticker && (
                <span className="text-blue-400 font-mono text-sm font-medium">
                  ${ticker}
                </span>
              )}
              {companyName && !ticker && (
                <span className="text-gray-300 text-sm">
                  {companyName}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(priority)}`}>
                {priority} priority
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {source} • {timestamp}
            </p>
          </div>
        </div>
        
        {relevanceScore && (
          <div className="text-right">
            <div className={`text-sm font-medium ${getScoreColor(relevanceScore)}`}>
              {relevanceScore}%
            </div>
            <div className="text-xs text-gray-500">
              relevance
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white leading-tight">
          {title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          {summary}
        </p>
        
        {/* Market Impact */}
        {marketImpact && (
          <div className="bg-zinc-800 rounded-lg p-3 border-l-4 border-blue-500">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-blue-400">Market Impact:</span> {marketImpact}
            </p>
          </div>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 4).map((tag, index) => (
              <span 
                key={index}
                className="inline-flex items-center px-2 py-1 text-xs font-medium bg-zinc-800 text-zinc-300 rounded-md"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="text-xs text-gray-500 px-2 py-1">
                +{tags.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center space-x-4">
          <button className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>Save</span>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span>Share</span>
          </button>
          {ticker && (
            <button className="text-gray-400 hover:text-white transition-colors text-sm flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Chart</span>
            </button>
          )}
        </div>
        <button className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium">
          Read More →
        </button>
      </div>
    </div>
  );
}