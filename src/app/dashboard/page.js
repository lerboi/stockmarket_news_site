// src/app/dashboard/page.js
import DashboardHeader from '../../components/dashboard/DashboardHeader';
import NewsFilters from '../../components/dashboard/NewsFilters';
import NewsFeed from '../../components/dashboard/NewsFeed';
import StatsOverview from '../../components/dashboard/StatsOverview';

export default function Dashboard() {
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
            <NewsFilters />
          </div>
          
          {/* News Feed */}
          <div className="lg:col-span-3">
            <NewsFeed />
          </div>
        </div>
      </div>
    </div>
  );
}