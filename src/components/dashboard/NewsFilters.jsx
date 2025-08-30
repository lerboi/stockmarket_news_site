// src/components/dashboard/NewsFilters.jsx - Monotone minimal design
'use client';
import { useState, useEffect } from 'react';

export default function NewsFilters({ onFiltersChange, currentFilters }) {
  const [selectedFilters, setSelectedFilters] = useState({
    priority: 'all',
    category: 'all',
    sentiment: 'all',
    timeframe: '24h',
    ...currentFilters
  });

  // Responsive default state: open on desktop, closed on mobile
  const [isExpanded, setIsExpanded] = useState(false);

  // Set default expansion state based on screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const isDesktop = window.innerWidth >= 768; // md breakpoint
      setIsExpanded(isDesktop);
    };

    // Set initial state
    checkScreenSize();

    // Listen for window resize
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Update filters when currentFilters prop changes
  useEffect(() => {
    setSelectedFilters(prev => ({
      ...prev,
      ...currentFilters
    }));
  }, [currentFilters]);

  const priorityOptions = [
    { value: 'all', label: 'All Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'drug_approval', label: 'Drug Approvals' },
    { value: 'safety_alert', label: 'Safety Alerts' },
    { value: 'device_approval', label: 'Device Approvals' },
    { value: 'regulatory', label: 'Regulatory' }
  ];

  const sentimentOptions = [
    { value: 'all', label: 'All Sentiment' },
    { value: 'bullish', label: 'Bullish' },
    { value: 'bearish', label: 'Bearish' },
    { value: 'neutral', label: 'Neutral' }
  ];

  // Updated timeframe options for multi-source RSS
  const timeframeOptions = [
    { value: '24h', label: '24 Hours', description: 'Breaking news & real-time alerts' },
    { value: '1w', label: '1 Week', description: 'Weekly market trends' },
    { value: '1m', label: '1 Month', description: 'Monthly analysis & patterns' }
  ];

  const handleFilterChange = (filterType, value) => {
    const newFilters = {
      ...selectedFilters,
      [filterType]: value
    };
    setSelectedFilters(newFilters);
    
    // Notify parent component
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const resetFilters = () => {
    const defaultFilters = {
      priority: 'all',
      category: 'all',
      sentiment: 'all',
      timeframe: '24h'
    };
    setSelectedFilters(defaultFilters);
    if (onFiltersChange) {
      onFiltersChange(defaultFilters);
    }
  };

  const getActiveFilterCount = () => {
    return Object.values(selectedFilters).filter(value => value !== 'all').length;
  };

  const getFilterSummary = () => {
    const summary = [];
    if (selectedFilters.priority !== 'all') {
      summary.push(priorityOptions.find(opt => opt.value === selectedFilters.priority)?.label);
    }
    if (selectedFilters.category !== 'all') {
      summary.push(categoryOptions.find(opt => opt.value === selectedFilters.category)?.label);
    }
    if (selectedFilters.sentiment !== 'all') {
      summary.push(sentimentOptions.find(opt => opt.value === selectedFilters.sentiment)?.label);
    }
    if (selectedFilters.timeframe !== 'all') {
      summary.push(timeframeOptions.find(opt => opt.value === selectedFilters.timeframe)?.label);
    }
    return summary;
  };

  return (
    <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 backdrop-blur-sm sticky top-6">
      {/* Minimal Monotone Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-zinc-800/30 transition-all duration-200 rounded-t-xl md:cursor-default"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide">FILTERS</h3>
              {!isExpanded && getActiveFilterCount() > 0 && (
                <p className="text-xs text-gray-500 truncate max-w-48 mt-1">
                  {getFilterSummary().join(' • ')}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {getActiveFilterCount() > 0 && (
              <div className="bg-white text-black text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                {getActiveFilterCount()}
              </div>
            )}
            <svg 
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 md:hidden ${
                isExpanded ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <div className={`transition-all duration-300 ease-out overflow-hidden ${
        isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-4 pb-4 space-y-6">
          <div className="h-px bg-zinc-800/50"></div>

          {/* Quick Actions - Minimal Pills */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Quick Actions
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  handleFilterChange('sentiment', 'bullish');
                  handleFilterChange('priority', 'high');
                }}
                className="text-xs bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white px-3 py-2 rounded-full transition-all duration-200 border border-zinc-700/50 hover:border-zinc-600"
              >
                Bullish Catalysts
              </button>
              <button
                onClick={() => {
                  handleFilterChange('sentiment', 'bearish');
                  handleFilterChange('category', 'safety_alert');
                }}
                className="text-xs bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white px-3 py-2 rounded-full transition-all duration-200 border border-zinc-700/50 hover:border-zinc-600"
              >
                Risk Alerts
              </button>
              <button
                onClick={() => handleFilterChange('timeframe', '24h')}
                className="text-xs bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white px-3 py-2 rounded-full transition-all duration-200 border border-zinc-700/50 hover:border-zinc-600"
              >
                Breaking News
              </button>
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Priority Level
            </label>
            <div className="space-y-1">
              {priorityOptions.map(option => (
                <label
                  key={option.value}
                  className={`group flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedFilters.priority === option.value 
                      ? 'bg-white/10 border border-white/20 text-white' 
                      : 'text-gray-400 hover:bg-zinc-800/50 hover:text-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    selectedFilters.priority === option.value
                      ? 'border-white bg-white'
                      : 'border-gray-600 group-hover:border-gray-500'
                  }`}>
                    {selectedFilters.priority === option.value && (
                      <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sentiment Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Market Sentiment
            </label>
            <div className="space-y-1">
              {sentimentOptions.map(option => (
                <label
                  key={option.value}
                  className={`group flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedFilters.sentiment === option.value 
                      ? 'bg-white/10 border border-white/20 text-white' 
                      : 'text-gray-400 hover:bg-zinc-800/50 hover:text-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    selectedFilters.sentiment === option.value
                      ? 'border-white bg-white'
                      : 'border-gray-600 group-hover:border-gray-500'
                  }`}>
                    {selectedFilters.sentiment === option.value && (
                      <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Announcement Type
            </label>
            <div className="space-y-1">
              {categoryOptions.map(option => (
                <label
                  key={option.value}
                  className={`group flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedFilters.category === option.value 
                      ? 'bg-white/10 border border-white/20 text-white' 
                      : 'text-gray-400 hover:bg-zinc-800/50 hover:text-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                    selectedFilters.category === option.value
                      ? 'border-white bg-white'
                      : 'border-gray-600 group-hover:border-gray-500'
                  }`}>
                    {selectedFilters.category === option.value && (
                      <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Timeframe Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Time Range
            </label>
            <div className="space-y-2">
              {timeframeOptions.map(option => (
                <label
                  key={option.value}
                  className={`group block p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                    selectedFilters.timeframe === option.value 
                      ? 'bg-white/10 border-white/20 text-white' 
                      : 'text-gray-400 border-zinc-800/50 hover:bg-zinc-800/50 hover:border-zinc-700 hover:text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{option.label}</div>
                      <div className="text-xs text-gray-500 mt-1 group-hover:text-gray-400 transition-colors duration-200">
                        {option.description}
                      </div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200 ${
                      selectedFilters.timeframe === option.value
                        ? 'border-white bg-white'
                        : 'border-gray-600 group-hover:border-gray-500'
                    }`}>
                      {selectedFilters.timeframe === option.value && (
                        <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <input
                    type="radio"
                    name="timeframe"
                    value={option.value}
                    checked={selectedFilters.timeframe === option.value}
                    onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            {getActiveFilterCount() > 0 && (
              <button
                onClick={resetFilters}
                className="w-full bg-zinc-800/60 hover:bg-zinc-700/80 text-gray-300 hover:text-white text-sm font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 border border-zinc-700/50 hover:border-zinc-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset All Filters</span>
              </button>
            )}

            <button
              onClick={() => setIsExpanded(false)}
              className="w-full md:hidden bg-white/10 hover:bg-white/20 text-white text-sm font-medium py-3 px-4 rounded-lg transition-all duration-200 border border-white/20"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}