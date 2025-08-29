// src/components/dashboard/NewsFilters.jsx
'use client';
import { useState, useEffect } from 'react';

export default function NewsFilters({ onFiltersChange, currentFilters }) {
  const [selectedFilters, setSelectedFilters] = useState({
    priority: 'all',
    category: 'all',
    timeframe: '24h',
    ...currentFilters
  });
  const [isExpanded, setIsExpanded] = useState(false);

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

  const timeframeOptions = [
    { value: '1h', label: '1 Hour' },
    { value: '24h', label: '24 Hours' },
    { value: '3d', label: '3 Days' },
    { value: '1w', label: '1 Week' }
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
    if (selectedFilters.timeframe !== 'all') {
      summary.push(timeframeOptions.find(opt => opt.value === selectedFilters.timeframe)?.label);
    }
    return summary;
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 sticky top-6">
      {/* Collapsed Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Filters</h3>
              {!isExpanded && getActiveFilterCount() > 0 && (
                <p className="text-xs text-gray-400 truncate max-w-48">
                  {getFilterSummary().join(', ')}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {getActiveFilterCount() > 0 && (
              <span className="bg-blue-600 text-white text-xs font-medium px-2 py-1 rounded-full">
                {getActiveFilterCount()}
              </span>
            )}
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="p-4 pt-0 border-t border-zinc-800">
          {/* Quick Filter Buttons */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Quick Filters
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  handleFilterChange('priority', 'high');
                  handleFilterChange('category', 'drug_approval');
                }}
                className="text-xs bg-green-600/20 hover:bg-green-600/30 text-green-300 px-3 py-2 rounded transition-colors"
              >
                High Priority Drugs
              </button>
              <button
                onClick={() => {
                  handleFilterChange('priority', 'high');
                  handleFilterChange('category', 'safety_alert');
                }}
                className="text-xs bg-red-600/20 hover:bg-red-600/30 text-red-300 px-3 py-2 rounded transition-colors"
              >
                Safety Alerts
              </button>
              <button
                onClick={() => handleFilterChange('timeframe', '1h')}
                className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3 py-2 rounded transition-colors"
              >
                Latest News
              </button>
            </div>
          </div>

          {/* Priority Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Priority Level
            </label>
            <div className="space-y-2">
              {priorityOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-all hover:bg-zinc-800 ${
                    selectedFilters.priority === option.value 
                      ? 'bg-blue-600/20 border border-blue-600/50 text-blue-300' 
                      : 'text-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={option.value}
                    checked={selectedFilters.priority === option.value}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    className="text-blue-600 focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              News Category
            </label>
            <div className="space-y-2">
              {categoryOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center space-x-3 p-2 rounded cursor-pointer transition-all hover:bg-zinc-800 ${
                    selectedFilters.category === option.value 
                      ? 'bg-green-600/20 border border-green-600/50 text-green-300' 
                      : 'text-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={option.value}
                    checked={selectedFilters.category === option.value}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="text-green-600 focus:ring-green-500 focus:ring-2"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Timeframe Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Time Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              {timeframeOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center justify-center p-3 rounded cursor-pointer transition-all hover:bg-zinc-800 ${
                    selectedFilters.timeframe === option.value 
                      ? 'bg-purple-600/20 border border-purple-600/50 text-purple-300' 
                      : 'text-gray-300 border border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="timeframe"
                    value={option.value}
                    checked={selectedFilters.timeframe === option.value}
                    onChange={(e) => handleFilterChange('timeframe', e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-center">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {getActiveFilterCount() > 0 && (
              <button
                onClick={resetFilters}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white text-sm font-medium py-2 px-4 rounded transition-all flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset All</span>
              </button>
            )}

            <button
              onClick={() => setIsExpanded(false)}
              className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-sm font-medium py-2 px-4 rounded transition-colors"
            >
              Collapse Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}