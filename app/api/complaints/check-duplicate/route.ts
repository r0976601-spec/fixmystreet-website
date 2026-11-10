import { NextRequest, NextResponse } from 'next/server';
import { findPotentialDuplicates } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, location, latitude, longitude, excludeId, thresholdMeters } = body;

    const duplicates = findPotentialDuplicates({
      category,
      location,
      latitude: latitude != null ? parseFloat(latitude) : null,
      longitude: longitude != null ? parseFloat(longitude) : null,
      excludeId: excludeId ? parseInt(excludeId, 10) : undefined,
      thresholdMeters: thresholdMeters ? parseInt(thresholdMeters, 10) : undefined,
    });

    return NextResponse.json({
      isPotentialDuplicate: duplicates.length > 0,
      count: duplicates.length,
      duplicates,
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const location = searchParams.get('location') || undefined;
    const latitude = searchParams.get('latitude') ? parseFloat(searchParams.get('latitude')!) : null;
    const longitude = searchParams.get('longitude') ? parseFloat(searchParams.get('longitude')!) : null;
    const excludeId = searchParams.get('excludeId') ? parseInt(searchParams.get('excludeId')!, 10) : undefined;
    const thresholdMeters = searchParams.get('thresholdMeters') ? parseInt(searchParams.get('thresholdMeters')!, 10) : undefined;

    const duplicates = findPotentialDuplicates({
      category,
      location,
      latitude,
      longitude,
      excludeId,
      thresholdMeters,
    });

    return NextResponse.json({
      isPotentialDuplicate: duplicates.length > 0,
      count: duplicates.length,
      duplicates,
    });
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
