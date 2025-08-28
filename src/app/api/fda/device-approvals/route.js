// src/app/api/fda/device-approvals/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    const skip = searchParams.get('skip') || '0';

    // FDA openFDA API endpoint for device 510k clearances
    const fdaUrl = `https://api.fda.gov/device/510k.json?sort=date_received:desc&limit=${limit}&skip=${skip}`;

    console.log(`Fetching FDA device approvals: ${fdaUrl}`);

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

    // Transform FDA device data into our format
    const transformedData = data.results?.map(device => ({
      id: `fda-device-${device.k_number}`,
      k_number: device.k_number,
      device_name: device.device_name,
      applicant: device.applicant,
      contact: device.contact,
      date_received: device.date_received,
      decision_date: device.decision_date,
      decision: device.decision,
      review_advisory_committee: device.review_advisory_committee,
      product_code: device.product_code,
      statement_or_summary: device.statement_or_summary,
      clearance_type: device.clearance_type,
      source: 'FDA',
      category: 'device_approval',
      priority: getDevicePriority(device.clearance_type, device.review_advisory_committee),
      raw_data: device
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: data.meta?.results?.total || 0,
      count: transformedData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Device Approvals API Error:', error);
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

// Helper function to determine device priority based on type and committee
function getDevicePriority(clearanceType, advisoryCommittee) {
  // Higher priority for novel devices or those requiring advisory committee review
  if (advisoryCommittee && advisoryCommittee !== 'N/A') {
    return 'high';
  }
  
  if (clearanceType && clearanceType.toLowerCase().includes('novel')) {
    return 'high';
  }
  
  return 'medium';
}