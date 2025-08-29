// src/components/dashboard/ProfileModal.js
'use client';
import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function ProfileModal({ isOpen, onClose }) {
  const { data: session } = useSession();
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
    onClose();
  };

  if (!isOpen || !session) return null;

  return (
    <div className="absolute top-16 right-4 z-50">
      <div 
        ref={modalRef}
        className={`bg-zinc-900 rounded-lg shadow-xl border border-zinc-700 w-72 transform transition-all duration-200 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Profile Header */}
        <div className="p-6 border-b border-zinc-700">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              {session.user.image ? (
                <img 
                  src={session.user.image} 
                  alt="Profile" 
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <span className="text-lg font-medium text-gray-900">
                  {session.user.name?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white">{session.user.name}</h3>
              <p className="text-sm text-gray-400">{session.user.email}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-2">
          <button className="w-full text-left px-6 py-3 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Profile Settings</span>
          </button>
          
          <button className="w-full text-left px-6 py-3 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            <span>Preferences</span>
          </button>

          <button className="w-full text-left px-6 py-3 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center space-x-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Help & Support</span>
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-700"></div>

        {/* Sign Out */}
        <div className="p-2">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors flex items-center space-x-3 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}