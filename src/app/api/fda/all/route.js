// src/app/api/fda/all/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeTypes = searchParams.get('types')?.split(',') || ['drugs', 'safety', 'devices'];

    const baseUrl = getBaseUrl(request);
    
    // Fetch data from our individual FDA endpoints
    const promises = [];
    
    if (includeTypes.includes('drugs')) {
      promises.push(
        fetch(`${baseUrl}/api/fda/drug-approvals?limit=${Math.floor(limit/3)}`)
          .then(res => res.json())
          .catch(err => ({ success: false, error: err.message, type: 'drugs' }))
      );
    }
    
    if (includeTypes.includes('safety')) {
      promises.push(
        fetch(`${baseUrl}/api/fda/safety-alerts?limit=${Math.floor(limit/3)}`)
          .then(res => res.json())
          .catch(err => ({ success: false, error: err.message, type: 'safety' }))
      );
    }
    
    if (includeTypes.includes('devices')) {
      promises.push(
        fetch(`${baseUrl}/api/fda/device-approvals?limit=${Math.floor(limit/3)}`)
          .then(res => res.json())
          .catch(err => ({ success: false, error: err.message, type: 'devices' }))
      );
    }

    const results = await Promise.allSettled(promises);
    
    // Combine all successful results
    let allData = [];
    let errors = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        allData = allData.concat(result.value.data || []);
      } else if (result.status === 'fulfilled' && !result.value.success) {
        errors.push({
          type: includeTypes[index],
          error: result.value.error
        });
      } else {
        errors.push({
          type: includeTypes[index],
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    // Sort by date (most recent first)
    allData.sort((a, b) => {
      const dateA = new Date(a.approval_date || a.report_date || a.decision_date || a.date_received || 0);
      const dateB = new Date(b.approval_date || b.report_date || b.decision_date || b.date_received || 0);
      return dateB - dateA;
    });

    // Limit final results
    allData = allData.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: allData,
      count: allData.length,
      errors: errors.length > 0 ? errors : undefined,
      types_fetched: includeTypes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Aggregate API Error:', error);
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

// Helper function to get base URL
function getBaseUrl(request) {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return request.url.split('/api/fda/all')[0];
}