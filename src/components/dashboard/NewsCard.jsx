// src/components/dashboard/NewsCard.jsx - Modern Professional Design
'use client';

export default function NewsCard({ 
  title, 
  summary, 
  priority, 
  category, 
  timestamp, 
  ticker, 
  exchange,
  sentiment,
  sentimentStrength,
  source,
  marketImpact,
  tags = [],
  companyName
}) {
  // Convert sentiment strength to descriptive terms
  const getSentimentDisplay = (sentiment, strength) => {
    if (!sentiment || sentiment === 'neutral') return 'NEUTRAL';
    
    if (sentiment === 'bullish') {
      if (strength >= 80) return 'VERY BULLISH';
      if (strength >= 60) return 'BULLISH';
      return 'MILDLY BULLISH';
    }
    
    if (sentiment === 'bearish') {
      if (strength >= 80) return 'VERY BEARISH';
      if (strength >= 60) return 'BEARISH';
      return 'MILDLY BEARISH';
    }
    
    return 'NEUTRAL';
  };

  // Sentiment styling - sleek and minimal
  const getSentimentStyle = (sentiment, strength) => {
    if (!sentiment || sentiment === 'neutral') {
      return 'text-gray-400 bg-gray-900/50';
    }
    
    if (sentiment === 'bullish') {
      if (strength >= 80) return 'text-emerald-300 bg-emerald-950/30';
      if (strength >= 60) return 'text-green-300 bg-green-950/30';
      return 'text-green-400 bg-green-950/20';
    }
    
    if (sentiment === 'bearish') {
      if (strength >= 80) return 'text-red-300 bg-red-950/30';
      if (strength >= 60) return 'text-red-300 bg-red-950/30';
      return 'text-red-400 bg-red-950/20';
    }
    
    return 'text-gray-400 bg-gray-900/50';
  };

  // Priority styling - minimal
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-300 bg-red-950/20';
      case 'medium':
        return 'text-yellow-300 bg-yellow-950/20';
      case 'low':
        return 'text-gray-400 bg-gray-900/50';
      default:
        return 'text-gray-400 bg-gray-900/50';
    }
  };

  // Exchange styling - sleek
  const getExchangeStyle = (exchange) => {
    switch (exchange) {
      case 'NYSE':
        return 'text-blue-300 bg-blue-950/20 border border-blue-800/30';
      case 'NASDAQ':
        return 'text-purple-300 bg-purple-950/20 border border-purple-800/30';
      case 'OTC':
        return 'text-orange-300 bg-orange-950/20 border border-orange-800/30';
      case 'AMEX':
        return 'text-indigo-300 bg-indigo-950/20 border border-indigo-800/30';
      default:
        return 'text-gray-400 bg-gray-900/50 border border-gray-800/30';
    }
  };

  return (
    <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-900 rounded-xl p-6 border border-zinc-800/50 hover:border-zinc-700/70 transition-all duration-300 backdrop-blur-sm">
      {/* Prominent Stock Information Header */}
      {ticker && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {/* Left: Stock Info */}
            <div className="flex items-center space-x-6">
              {/* Stock Ticker - Clean and prominent */}
              <div>
                <div className="text-3xl font-bold text-white tracking-tight">
                  ${ticker}
                </div>
                <div className="text-sm text-gray-400 mt-1 font-medium">
                  {companyName || 'Company'}
                </div>
              </div>
              
              {/* Exchange - Sleek badge */}
              {exchange && (
                <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${getExchangeStyle(exchange)}`}>
                  {exchange}
                </div>
              )}
            </div>

            {/* Right: AI Sentiment - Clean display */}
            <div className="text-right">
              <div className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide ${getSentimentStyle(sentiment, sentimentStrength)}`}>
                {getSentimentDisplay(sentiment, sentimentStrength)}
              </div>
              <div className="text-xs text-gray-500 mt-1 font-medium">AI Analysis</div>
            </div>
          </div>
        </div>
      )}

      {/* Header for non-ticker news - Simplified */}
      {!ticker && (
        <div className="flex items-start justify-between mb-6">
          <div>
            {companyName && (
              <div className="text-lg font-semibold text-gray-300 mb-2">
                {companyName}
              </div>
            )}
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityStyle(priority)}`}>
                {priority.toUpperCase()}
              </span>
              <span>{source} • {timestamp}</span>
            </div>
          </div>
          
          {/* AI Sentiment for non-ticker items */}
          <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getSentimentStyle(sentiment, sentimentStrength)}`}>
            {getSentimentDisplay(sentiment, sentimentStrength)}
          </div>
        </div>
      )}

      {/* Metadata for ticker items - Clean and minimal */}
      {ticker && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityStyle(priority)}`}>
              {priority.toUpperCase()}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {source} • {timestamp}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white leading-tight">
          {title}
        </h3>
        <p className="text-gray-300 text-sm leading-relaxed">
          {summary}
        </p>
        
        {/* Market Impact - Enhanced styling */}
        {marketImpact && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-full"></div>
            <div className="pl-4 py-2">
              <p className="text-sm text-gray-300 leading-relaxed">
                <span className="font-semibold text-blue-400">Market Impact:</span> {marketImpact}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Trading Actions - Modern and clean */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-800/50">
        <div className="flex items-center space-x-6">
          {ticker && (
            <>
              <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm flex items-center space-x-2 hover:bg-zinc-800/50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Chart</span>
              </button>
              <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm flex items-center space-x-2 hover:bg-zinc-800/50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>Watchlist</span>
              </button>
            </>
          )}
          <button className="text-gray-400 hover:text-white transition-colors duration-200 text-sm flex items-center space-x-2 hover:bg-zinc-800/50 px-3 py-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4 19h5c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2z" />
            </svg>
            <span>Alert</span>
          </button>
        </div>
        <button className="text-blue-400 hover:text-blue-300 transition-colors duration-200 text-sm font-medium flex items-center space-x-1">
          <span>View Details</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}