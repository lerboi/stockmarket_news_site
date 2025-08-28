// src/components/dashboard/NewsFilters.js
'use client';
import { useState } from 'react';

export default function NewsFilters() {
  const [selectedFilters, setSelectedFilters] = useState({
    priority: 'all',
    category: 'all',
    timeframe: '24h'
  });

  const priorityOptions = [
    { value: 'all', label: 'All Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'low', label: 'Low Priority' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'earnings', label: 'Earnings' },
    { value: 'sec_filings', label: 'SEC Filings' },
    { value: 'fda', label: 'FDA News' },
    { value: 'press_releases', label: 'Press Releases' },
    { value: 'insider_trading', label: 'Insider Trading' }
  ];

  const timeframeOptions = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '3d', label: 'Last 3 Days' },
    { value: '1w', label: 'Last Week' }
  ];

  const handleFilterChange = (filterType, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 sticky top-6">
      <h3 className="text-lg font-semibold text-white mb-4">Filters</h3>
      
      {/* Priority Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Priority Level
        </label>
        <select
          value={selectedFilters.priority}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {priorityOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          News Category
        </label>
        <select
          value={selectedFilters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {categoryOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timeframe Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Time Range
        </label>
        <select
          value={selectedFilters.timeframe}
          onChange={(e) => handleFilterChange('timeframe', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {timeframeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
          Apply Filters
        </button>
        <button className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors">
          Reset All
        </button>
      </div>
    </div>
  );
}