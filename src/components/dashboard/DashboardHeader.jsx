// src/components/dashboard/DashboardHeader.jsx
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import ProfileModal from './ProfileModal';

export default function DashboardHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const { data: session } = useSession();

  const toggleProfileModal = () => {
    setIsProfileModalOpen(!isProfileModalOpen);
  };

  const navigationItems = [
    { label: 'Dashboard', href: '/dashboard', active: true },
    { label: 'Watchlist', href: '/watchlist', active: false },
    { label: 'Analytics', href: '/analytics', active: false },
    { label: 'Settings', href: '/settings', active: false }
  ];

  return (
    <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-30 backdrop-blur-sm bg-zinc-900/95">
      <div className="container mx-auto px-4 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="text-xl font-bold text-white">
              Pennystock<span className="text-gray-400">AI</span>
            </div>
            <div className="hidden sm:flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Live Market Intelligence</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  item.active
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                    : 'text-gray-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* User Profile and Mobile Menu */}
          <div className="flex items-center space-x-4">
            {session && (
              <div className="hidden sm:block relative">
                <button
                  onClick={toggleProfileModal}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-zinc-800 transition-all duration-150 group"
                >
                  <div className="relative">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center ring-2 ring-transparent group-hover:ring-zinc-600 transition-all">
                      {session.user.image ? (
                        <img 
                          src={session.user.image} 
                          alt="Profile" 
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {session.user.name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div>
                      <p className="text-sm text-gray-300 font-medium text-left">
                        {session.user.name}
                      </p>
                      <p className="text-xs text-gray-500 text-left">Pro Account</p>
                    </div>
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                        isProfileModalOpen ? 'rotate-180' : ''
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {/* Profile Modal - positioned relative to this container */}
                <ProfileModal 
                  isOpen={isProfileModalOpen} 
                  onClose={() => setIsProfileModalOpen(false)} 
                />
              </div>
            )}
            
            {/* Mobile Profile Button */}
            {session && (
              <button
                onClick={toggleProfileModal}
                className="sm:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-zinc-800 relative"
              >
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  {session.user.image ? (
                    <img 
                      src={session.user.image} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">
                      {session.user.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900"></div>
                
                {/* Mobile Profile Modal */}
                {isProfileModalOpen && (
                  <div className="sm:hidden">
                    <ProfileModal 
                      isOpen={isProfileModalOpen} 
                      onClose={() => setIsProfileModalOpen(false)} 
                    />
                  </div>
                )}
              </button>
            )}
            
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <svg 
                className={`w-6 h-6 transition-transform duration-200 ${
                  isMobileMenuOpen ? 'rotate-90' : ''
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pt-4 border-t border-zinc-800">
            <nav className="flex flex-col space-y-2">
              {navigationItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    item.active
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                      : 'text-gray-300 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                </a>
              ))}
              
              {/* Mobile User Info */}
              {session && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="flex items-center space-x-3 px-4 py-2">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                      {session.user.image ? (
                        <img 
                          src={session.user.image} 
                          alt="Profile" 
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {session.user.name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{session.user.name}</p>
                      <p className="text-xs text-gray-400">{session.user.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}