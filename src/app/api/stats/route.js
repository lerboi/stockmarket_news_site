// src/app/api/stats/route.js
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get today's published news count
    const { count: todaysNews } = await supabase
      .from('processed_news')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
      .gte('published_at', todayISO);

    // Get high priority items count (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    
    const { count: highPriority } = await supabase
      .from('processed_news')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
      .eq('priority_level', 'high')
      .gte('published_at', last24Hours.toISOString());

    // Get processing queue status
    const { count: pendingQueue } = await supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: processingQueue } = await supabase
      .from('processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    // Get recent activity stats
    const { data: recentActivity, error: activityError } = await supabase
      .from('processed_news')
      .select('priority_level, published_at')
      .eq('is_published', true)
      .gte('published_at', last24Hours.toISOString())
      .order('published_at', { ascending: false });

    if (activityError) {
      console.error('Activity query error:', activityError);
    }

    // Calculate trends
    const trends = calculateTrends(recentActivity || []);

    const stats = {
      todaysNews: todaysNews || 0,
      highPriority: highPriority || 0,
      queueStatus: {
        pending: pendingQueue || 0,
        processing: processingQueue || 0,
        total: (pendingQueue || 0) + (processingQueue || 0)
      },
      trends: trends,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Calculate trends for the dashboard
function calculateTrends(recentActivity) {
  if (!recentActivity || recentActivity.length === 0) {
    return {
      totalItems: 0,
      highPriorityPercent: 0,
      activityTrend: 'neutral'
    };
  }

  const highPriorityCount = recentActivity.filter(item => item.priority_level === 'high').length;
  const highPriorityPercent = Math.round((highPriorityCount / recentActivity.length) * 100);

  // Simple trend calculation based on recent activity
  const now = new Date();
  const last6Hours = recentActivity.filter(item => {
    const itemDate = new Date(item.published_at);
    const hoursDiff = (now - itemDate) / (1000 * 60 * 60);
    return hoursDiff <= 6;
  }).length;

  const previous6Hours = recentActivity.filter(item => {
    const itemDate = new Date(item.published_at);
    const hoursDiff = (now - itemDate) / (1000 * 60 * 60);
    return hoursDiff > 6 && hoursDiff <= 12;
  }).length;

  let activityTrend = 'neutral';
  if (last6Hours > previous6Hours) activityTrend = 'up';
  else if (last6Hours < previous6Hours) activityTrend = 'down';

  return {
    totalItems: recentActivity.length,
    highPriorityPercent,
    activityTrend,
    recentActivity: last6Hours,
    previousActivity: previous6Hours
  };
}