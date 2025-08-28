// src/app/api/fda/drug-approvals/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    const skip = searchParams.get('skip') || '0';

    // FDA openFDA API endpoint for drug approvals
    const fdaUrl = `https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_status:"AP"&sort=submissions.submission_status_date:desc&limit=${limit}&skip=${skip}`;

    console.log(`Fetching FDA drug approvals: ${fdaUrl}`);

    const response = await fetch(fdaUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`FDA API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform FDA data into our format
    const transformedData = (data.results || []).map(drug => ({
      id: `fda-drug-${drug.application_number}`,
      application_number: drug.application_number,
      sponsor_name: drug.sponsor_name,
      products: drug.products || [],
      submissions: drug.submissions || [],
      approval_date: getLatestApprovalDate(drug.submissions),
      drug_name: drug.products?.[0]?.brand_name || drug.products?.[0]?.generic_name || 'Unknown',
      source: 'FDA',
      category: 'drug_approval',
      raw_data: drug
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: data.meta?.results?.total || 0,
      count: transformedData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA API Error:', error);
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

// Helper function to get date N days ago in YYYY-MM-DD format
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

// Helper function to extract the latest approval date from submissions
function getLatestApprovalDate(submissions) {
  if (!submissions || submissions.length === 0) return null;
  
  const approvedSubmissions = submissions.filter(sub => sub.submission_status === 'AP');
  if (approvedSubmissions.length === 0) return null;

  const latestDate = approvedSubmissions.reduce((latest, current) => {
    const currentDate = new Date(current.submission_status_date);
    const latestDate = new Date(latest);
    return currentDate > latestDate ? current.submission_status_date : latest;
  }, approvedSubmissions[0].submission_status_date);

  return latestDate;
}