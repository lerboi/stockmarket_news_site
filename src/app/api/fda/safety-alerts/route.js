// src/app/api/fda/safety-alerts/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    const skip = searchParams.get('skip') || '0';

    // FDA openFDA API endpoint for drug safety alerts/recalls
    const fdaUrl = `https://api.fda.gov/drug/enforcement.json?sort=report_date:desc&limit=${limit}&skip=${skip}`;

    console.log(`Fetching FDA safety alerts: ${fdaUrl}`);

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

    // Transform FDA enforcement data into our format
    const transformedData = data.results?.map(alert => ({
      id: `fda-safety-${alert.recall_number}`,
      recall_number: alert.recall_number,
      product_description: alert.product_description,
      reason_for_recall: alert.reason_for_recall,
      recalling_firm: alert.recalling_firm,
      classification: alert.classification, // Class I, II, or III
      report_date: alert.report_date,
      recall_initiation_date: alert.recall_initiation_date,
      status: alert.status,
      distribution_pattern: alert.distribution_pattern,
      product_quantity: alert.product_quantity,
      source: 'FDA',
      category: 'safety_alert',
      priority: getClassificationPriority(alert.classification),
      raw_data: alert
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedData,
      total: data.meta?.results?.total || 0,
      count: transformedData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('FDA Safety Alerts API Error:', error);
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

// Helper function to convert FDA classification to our priority system
function getClassificationPriority(classification) {
  switch (classification) {
    case 'Class I':
      return 'high'; // Life-threatening situation
    case 'Class II':
      return 'medium'; // Temporary/reversible health consequences
    case 'Class III':
      return 'low'; // Unlikely to cause adverse health consequences
    default:
      return 'medium';
  }
}