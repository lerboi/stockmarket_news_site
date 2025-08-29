// src/app/dashboard/page.js
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

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      openLoginModal(); // Open login modal instead of redirect
      return;
    }
  }, [session, status, openLoginModal]);

  const handleFiltersChange = (newFilters) => {
    setNewsFilters(newFilters);
  };

  // Show loading spinner while checking auth
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-6">🔐</div>
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-gray-400 mb-6">
            Please sign in to access your PennystockAI dashboard and start analyzing FDA market intelligence.
          </p>
          <button
            onClick={openLoginModal}
            className="bg-white hover:bg-gray-100 text-gray-900 font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <DashboardHeader />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Stats Overview */}
        <StatsOverview />
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <NewsFilters 
              onFiltersChange={handleFiltersChange}
              currentFilters={newsFilters}
            />
          </div>
          
          {/* News Feed */}
          <div className="lg:col-span-3">
            <NewsFeed filters={newsFilters} />
          </div>
        </div>
      </div>
    </div>
  );
}