import { NextRequest, NextResponse } from 'next/server';
import {
  getComplaintByIdOrRef,
  updateComplaintStatus,
  deleteComplaint,
  assignDepartment,
  updateComplaintPriority,
  markComplaintAsDuplicate,
  unmarkComplaintDuplicate,
  findPotentialDuplicates,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const complaint = getComplaintByIdOrRef(id);

    if (!complaint) {
      return NextResponse.json(
        { error: `No complaint found with ID or Reference "${id}"` },
        { status: 404 }
      );
    }

    // Attach any potential duplicates for administrative review
    const potentialDuplicates = findPotentialDuplicates({
      category: complaint.category,
      location: complaint.location,
      latitude: complaint.latitude,
      longitude: complaint.longitude,
      excludeId: complaint.id,
      thresholdMeters: 400,
    });
    complaint.potential_duplicates = potentialDuplicates;

    return NextResponse.json(complaint);
  } catch (error) {
    console.error('Error finding complaint:', error);
    return NextResponse.json({ error: 'Failed to look up complaint' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, admin_notes, author, department, priority, action, master_id, duplicate_of } = body;

    const existing = getComplaintByIdOrRef(id);
    if (!existing) {
      return NextResponse.json(
        { error: `Complaint "${id}" not found.` },
        { status: 404 }
      );
    }

    // Action: Mark as duplicate of a master ticket
    if (action === 'mark_duplicate' || duplicate_of) {
      const targetMasterId = master_id || duplicate_of;
      if (!targetMasterId) {
        return NextResponse.json({ error: 'Target master complaint ID is required to mark as duplicate.' }, { status: 400 });
      }
      const result = markComplaintAsDuplicate(
        existing.id,
        parseInt(targetMasterId, 10),
        author || 'Municipal Triage Officer'
      );
      return NextResponse.json({
        message: `Complaint ${existing.reference_id} marked as duplicate of master ticket.`,
        complaint: result.duplicate,
        master: result.master,
      });
    }

    // Action: Unmark as duplicate
    if (action === 'unmark_duplicate') {
      const updated = unmarkComplaintDuplicate(existing.id, author || 'Municipal Triage Officer');
      return NextResponse.json({
        message: `Complaint ${existing.reference_id} unmarked as duplicate and restored.`,
        complaint: updated,
      });
    }

    // If only priority is provided
    if (priority && !status && !department && !admin_notes) {
      const updated = updateComplaintPriority(existing.id, priority, author || 'Municipal Operations');
      return NextResponse.json({
        message: `Priority updated to ${priority}`,
        complaint: updated,
      });
    }

    // If only department is provided
    if (department && !status && !priority && !admin_notes) {
      const updated = assignDepartment(existing.id, department, author || 'Municipal Dispatcher');
      return NextResponse.json({
        message: `Complaint assigned to ${department} successfully`,
        complaint: updated,
      });
    }

    const validStatuses = ['Pending', 'In Progress', 'Resolved', 'Submitted', 'Under Review'];
    const matchedStatus = status
      ? validStatuses.find((s) => s.toLowerCase() === status.toLowerCase())
      : existing.status;

    if (status && !matchedStatus) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: Pending, In Progress, Resolved` },
        { status: 400 }
      );
    }

    const updated = updateComplaintStatus(
      existing.id,
      matchedStatus || existing.status,
      admin_notes,
      author || 'Municipal Officer',
      department,
      priority
    );

    return NextResponse.json({
      message: 'Complaint updated successfully',
      complaint: updated,
    });
  } catch (error) {
    console.error('Error updating complaint:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update complaint' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = getComplaintByIdOrRef(id);

    if (!existing) {
      return NextResponse.json(
        { error: `Complaint "${id}" not found.` },
        { status: 404 }
      );
    }

    const success = deleteComplaint(existing.id);

    if (!success) {
      return NextResponse.json(
        { error: `Failed to remove complaint ${id}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Complaint ${existing.reference_id} deleted successfully from municipal database.`,
      id: existing.id,
      reference_id: existing.reference_id,
    });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    return NextResponse.json({ error: 'Failed to delete complaint' }, { status: 500 });
  }
}
