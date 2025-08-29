// src/app/dashboard/page.js - Minimalist ultra-dark design
'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useAuthModal } from '@/lib/auth-context';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import NewsFilters from '@/components/dashboard/NewsFilters';
import NewsFeed from '@/components/dashboard/NewsFeed';
import StatsOverview from '@/components/dashboard/StatsOverview';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const { openLoginModal } = useAuthModal();
  const [newsFilters, setNewsFilters] = useState({
    priority: 'all',
    category: 'all',
    timeframe: '24h'
  });
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      openLoginModal();
      return;
    }
  }, [session, status, openLoginModal]);

  const handleFiltersChange = (newFilters) => {
    setNewsFilters(newFilters);
  };

  const handleStatsUpdate = () => {
    setStatsRefreshTrigger(prev => prev + 1);
  };

  // Show loading spinner while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-6 h-6 border border-gray-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <h2 className="text-xl font-light text-gray-300 mb-4">Authentication Required</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            Please sign in to access your PennystockAI dashboard and start analyzing FDA market intelligence.
          </p>
          <button
            onClick={openLoginModal}
            className="bg-zinc-900 hover:bg-zinc-800 text-gray-200 font-medium px-8 py-3 rounded border border-zinc-700 transition-colors"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black bg-fixed">
      {/* Dark Header */}
      <div className="border-b border-zinc-900">
        <DashboardHeader />
      </div>
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Stats Overview */}
        <div className="mb-8">
          <StatsOverview refreshTrigger={statsRefreshTrigger} />
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <NewsFilters 
              onFiltersChange={handleFiltersChange}
              currentFilters={newsFilters}
            />
          </div>
          
          {/* News Feed */}
          <div className="lg:col-span-3">
            <NewsFeed 
              filters={newsFilters}
              onStatsUpdate={handleStatsUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}