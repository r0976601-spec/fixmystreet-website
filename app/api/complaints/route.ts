import { NextRequest, NextResponse } from 'next/server';
import { getAllComplaints, createComplaint } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const department = searchParams.get('department') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const duplicateFilter = (searchParams.get('duplicateFilter') as 'all' | 'duplicates_only' | 'originals_only') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const complaints = getAllComplaints({
      category,
      status,
      department,
      priority,
      duplicateFilter,
      search,
      limit,
    });
    return NextResponse.json(complaints);
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return NextResponse.json({ error: 'Failed to fetch complaints' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, category, location, latitude, longitude, image_url, priority, duplicate_of } = body;

    if (!name?.trim() || !description?.trim() || !category?.trim() || !location?.trim()) {
      return NextResponse.json(
        { error: 'Name, description, category, and location are required fields.' },
        { status: 400 }
      );
    }

    const complaint = createComplaint({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      location: location.trim(),
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      image_url: image_url || null,
      priority: priority || 'Normal',
      duplicate_of: duplicate_of ? parseInt(duplicate_of, 10) : null,
    });

    return NextResponse.json({
      message: 'Complaint submitted successfully!',
      complaint,
      id: complaint.id,
      reference_id: complaint.reference_id,
      status: complaint.status,
      priority: complaint.priority,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating complaint:', error);
    return NextResponse.json({ error: 'Failed to submit complaint' }, { status: 500 });
  }
}
