import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

// Database file path: check backend directory first, then root fallback
const backendDbPath = path.join(process.cwd(), 'backend', 'fixmystreet.db');
const dbPath = fs.existsSync(backendDbPath) 
  ? backendDbPath 
  : path.join(process.cwd(), 'fixmystreet.db');

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export interface ComplaintUpdate {
  id: number;
  complaint_id: number;
  status: 'Pending' | 'In Progress' | 'Resolved';
  message: string;
  author: string;
  created_at: string;
}

export interface ComplaintRecord {
  id: number;
  reference_id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  status: 'Pending' | 'In Progress' | 'Resolved';
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  admin_notes?: string | null;
  priority?: 'Urgent' | 'High' | 'Normal' | 'Low' | string;
  updated_at?: string | null;
  assigned_department?: string | null;
  duplicate_of?: number | null;
  master_reference_id?: string | null;
  duplicate_count?: number;
  potential_duplicates?: DuplicateMatch[];
  updates?: ComplaintUpdate[];
}

export interface DuplicateMatch {
  id: number;
  reference_id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  priority?: string;
  created_at: string;
  distanceMeters?: number | null;
  matchReason: string;
  confidence: 'High' | 'Medium' | 'Low';
}

function initDatabase(db: DatabaseSync) {
  // Ensure complaints table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reference_id TEXT,
      latitude REAL,
      longitude REAL,
      image_url TEXT,
      admin_notes TEXT,
      priority TEXT DEFAULT 'Normal',
      updated_at TIMESTAMP,
      assigned_department TEXT DEFAULT 'Unassigned',
      duplicate_of INTEGER
    )
  `);

  // Ensure assigned_department column exists for existing tables
  const cols = db.prepare('PRAGMA table_info(complaints)').all().map((c: any) => c.name);
  if (!cols.includes('assigned_department')) {
    db.exec("ALTER TABLE complaints ADD COLUMN assigned_department TEXT DEFAULT 'Unassigned'");
  }
  if (!cols.includes('duplicate_of')) {
    db.exec('ALTER TABLE complaints ADD COLUMN duplicate_of INTEGER');
  }
  if (!cols.includes('priority')) {
    db.exec("ALTER TABLE complaints ADD COLUMN priority TEXT DEFAULT 'Normal'");
  }

  // Ensure complaint_updates table exists for tracking timeline
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaint_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      author TEXT DEFAULT 'Municipal Dispatch',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    )
  `);

  // Ensure reference_id is populated for any legacy rows
  db.exec(`
    UPDATE complaints 
    SET reference_id = 'FMS-JAL-' || printf('%04d', id) 
    WHERE reference_id IS NULL OR reference_id = ''
  `);

  // Standardize legacy statuses: map 'Submitted' and 'Under Review' to 'Pending'
  db.exec(`
    UPDATE complaints 
    SET status = 'Pending' 
    WHERE status IN ('Submitted', 'Under Review')
  `);

  // Seed sample updates for existing complaints if updates table is empty
  const updateCount = (db.prepare('SELECT COUNT(*) as count FROM complaint_updates').get() as { count: number }).count;
  if (updateCount === 0) {
    seedComplaintUpdates(db);
  }
}

function seedComplaintUpdates(db: DatabaseSync) {
  const insertUpdate = db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Complaint #3: Model Town Pothole (In Progress, High)
  insertUpdate.run(3, 'Pending', 'Complaint registered by citizen with geo-coordinates.', 'Citizen Portal', '2026-11-09 08:30:00');
  insertUpdate.run(3, 'Pending', 'Verified by Ward 14 Road Inspector. Depth measured at 14cm.', 'Ward 14 Inspector', '2026-11-09 11:15:00');
  insertUpdate.run(3, 'In Progress', 'Assigned to Roads & Pavement Department. Asphalt patch truck dispatched to Model Town Road.', 'Municipal Road Division', '2026-11-09 15:40:00');

  // Complaint #4: Urban Estate Waste Bin (Pending, Normal)
  insertUpdate.run(4, 'Pending', 'Issue reported by citizen. Overflowing commercial community bin.', 'Citizen Portal', '2026-11-09 10:00:00');
  insertUpdate.run(4, 'Pending', 'Assigned to Sanitation & Waste Management. Compactor scheduled for morning round.', 'Sanitation Superintendent', '2026-11-09 12:20:00');

  // Complaint #5: Adarsh Nagar Streetlight (Pending, Urgent)
  insertUpdate.run(5, 'Pending', 'Citizen reported broken streetlight pole and dark junction.', 'Citizen Portal', '2026-11-09 14:00:00');

  // Complaint #6: Cantt Road Drainage (Resolved, Normal)
  insertUpdate.run(6, 'Pending', 'Reported severe storm drain blockage and silt pooling.', 'Citizen Portal', '2026-11-08 09:00:00');
  insertUpdate.run(6, 'In Progress', 'High-pressure vacuum jetting truck deployed to Cantt Crossing.', 'Drainage Dept', '2026-11-08 13:30:00');
  insertUpdate.run(6, 'Resolved', 'Drain grating cleared, plastic waste removed, flow test passed. Issue resolved.', 'Chief Sanitary Inspector', '2026-11-08 17:00:00');
}

/**
 * Haversine formula to calculate great-circle distance between two GPS coordinates in meters.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Check if two category strings are conceptually identical or overlapping.
 */
export function isSameCategory(cat1: string, cat2: string): boolean {
  if (!cat1 || !cat2) return false;
  const c1 = cat1.toLowerCase().trim();
  const c2 = cat2.toLowerCase().trim();
  if (c1 === c2) return true;
  if ((c1.includes('road') || c1.includes('pothole')) && (c2.includes('road') || c2.includes('pothole'))) return true;
  if ((c1.includes('waste') || c1.includes('garbage')) && (c2.includes('waste') || c2.includes('garbage'))) return true;
  if (c1.includes('light') && c2.includes('light')) return true;
  if (c1.includes('drain') && c2.includes('drain')) return true;
  if (c1.includes('water') && c2.includes('water')) return true;
  return false;
}

/**
 * Extract meaningful location tokens for fuzzy textual matching.
 */
function extractLocationTokens(text: string): string[] {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const stopWords = new Set(['near', 'the', 'and', 'at', 'in', 'on', 'road', 'street', 'opposite', 'behind', 'beside', 'front', 'gate', 'lane', 'jalandhar']);
  return clean
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !stopWords.has(w));
}

/**
 * Identify potential duplicate complaints based on GPS proximity and category,
 * or fuzzy textual location matching.
 */
export function findPotentialDuplicates(params: {
  category?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
  excludeId?: number;
  thresholdMeters?: number;
}): DuplicateMatch[] {
  const db = getDatabase();
  const thresholdMeters = params.thresholdMeters ?? 350; // default 350 meters radius
  
  // Fetch active/unmerged complaints to compare against
  let query = 'SELECT * FROM complaints WHERE 1=1';
  const sqlParams: (string | number)[] = [];

  if (params.excludeId) {
    query += ' AND id != ?';
    sqlParams.push(params.excludeId);
  }

  // Filter out issues that are already marked as duplicates of another master
  query += ' AND (duplicate_of IS NULL OR duplicate_of = 0)';
  query += ' ORDER BY id DESC LIMIT 100';

  const rows = db.prepare(query).all(...sqlParams) as unknown as ComplaintRecord[];
  const matches: DuplicateMatch[] = [];

  const targetTokens = params.location ? extractLocationTokens(params.location) : [];
  const targetLat = params.latitude != null ? Number(params.latitude) : null;
  const targetLng = params.longitude != null ? Number(params.longitude) : null;
  const hasGps = targetLat != null && targetLng != null && !isNaN(targetLat) && !isNaN(targetLng);

  for (const row of rows) {
    const rowLat = row.latitude != null ? Number(row.latitude) : null;
    const rowLng = row.longitude != null ? Number(row.longitude) : null;
    const rowHasGps = rowLat != null && rowLng != null && !isNaN(rowLat) && !isNaN(rowLng);
    const categoryMatches = params.category ? isSameCategory(params.category, row.category) : false;

    let distance: number | null = null;
    let isSpatialDuplicate = false;

    if (hasGps && rowHasGps) {
      distance = haversineDistanceMeters(targetLat!, targetLng!, rowLat!, rowLng!);
      if (distance <= thresholdMeters) {
        isSpatialDuplicate = true;
      }
    }

    // Textual location token check
    let tokenOverlapCount = 0;
    let matchedToken = '';
    if (targetTokens.length > 0 && row.location) {
      const rowTokens = extractLocationTokens(row.location);
      for (const t of targetTokens) {
        if (rowTokens.includes(t)) {
          tokenOverlapCount++;
          if (!matchedToken) matchedToken = t;
        }
      }
    }

    // Determine if it qualifies as a duplicate
    if (isSpatialDuplicate && categoryMatches) {
      matches.push({
        id: row.id,
        reference_id: row.reference_id,
        name: row.name,
        category: row.category,
        location: row.location,
        status: row.status,
        priority: row.priority || 'Normal',
        created_at: row.created_at,
        distanceMeters: distance,
        matchReason: `Spatial duplicate: ~${distance}m away in same category (${row.category})`,
        confidence: distance! <= 150 ? 'High' : 'Medium',
      });
    } else if (isSpatialDuplicate && distance! <= 60) {
      // Extremely close GPS distance (< 60m) even if category entered was slightly different
      matches.push({
        id: row.id,
        reference_id: row.reference_id,
        name: row.name,
        category: row.category,
        location: row.location,
        status: row.status,
        priority: row.priority || 'Normal',
        created_at: row.created_at,
        distanceMeters: distance,
        matchReason: `Proximity match: ~${distance}m away (${row.category})`,
        confidence: 'Medium',
      });
    } else if (categoryMatches && tokenOverlapCount >= 1 && (matchedToken.length >= 4 || tokenOverlapCount >= 2)) {
      // Meaningful location name overlap like "Model Town" or "Urban Estate"
      matches.push({
        id: row.id,
        reference_id: row.reference_id,
        name: row.name,
        category: row.category,
        location: row.location,
        status: row.status,
        priority: row.priority || 'Normal',
        created_at: row.created_at,
        distanceMeters: distance,
        matchReason: `Address keyword overlap "${matchedToken}" in same category`,
        confidence: tokenOverlapCount >= 2 ? 'High' : 'Medium',
      });
    }
  }

  // Sort by confidence ('High' first), then distance
  matches.sort((a, b) => {
    if (a.confidence === 'High' && b.confidence !== 'High') return -1;
    if (b.confidence === 'High' && a.confidence !== 'High') return 1;
    return (a.distanceMeters ?? 9999) - (b.distanceMeters ?? 9999);
  });

  return matches;
}

export function getAllComplaints(options: {
  category?: string;
  status?: string;
  department?: string;
  priority?: string;
  duplicateFilter?: 'all' | 'duplicates_only' | 'originals_only';
  search?: string;
  limit?: number;
} = {}): ComplaintRecord[] {
  const db = getDatabase();
  let query = 'SELECT * FROM complaints WHERE 1=1';
  const params: (string | number)[] = [];

  if (options.category && options.category !== 'All') {
    query += ' AND LOWER(category) LIKE ?';
    params.push(`%${options.category.toLowerCase()}%`);
  }

  if (options.status && options.status !== 'All') {
    const targetStatus = options.status.toLowerCase();
    if (targetStatus === 'pending') {
      query += " AND LOWER(status) IN ('pending', 'submitted', 'under review')";
    } else {
      query += ' AND LOWER(status) = LOWER(?)';
      params.push(options.status);
    }
  }

  if (options.department && options.department !== 'All') {
    query += ' AND LOWER(assigned_department) = LOWER(?)';
    params.push(options.department);
  }

  if (options.priority && options.priority !== 'All') {
    query += ' AND LOWER(priority) = LOWER(?)';
    params.push(options.priority);
  }

  if (options.duplicateFilter === 'duplicates_only') {
    query += ' AND duplicate_of IS NOT NULL AND duplicate_of > 0';
  } else if (options.duplicateFilter === 'originals_only') {
    query += ' AND (duplicate_of IS NULL OR duplicate_of = 0)';
  }

  if (options.search) {
    query += ' AND (name LIKE ? OR description LIKE ? OR location LIKE ? OR reference_id LIKE ? OR assigned_department LIKE ? OR priority LIKE ?)';
    const term = `%${options.search}%`;
    params.push(term, term, term, term, term, term);
  }

  query += ' ORDER BY id DESC';

  if (options.limit && options.limit > 0) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(query).all(...params) as unknown as ComplaintRecord[];
  
  // Calculate duplicate counts and master reference IDs
  const allMasterCounts = db.prepare(`
    SELECT duplicate_of, COUNT(*) as cnt 
    FROM complaints 
    WHERE duplicate_of IS NOT NULL AND duplicate_of > 0 
    GROUP BY duplicate_of
  `).all() as Array<{ duplicate_of: number; cnt: number }>;
  
  const countMap = new Map<number, number>();
  for (const m of allMasterCounts) {
    countMap.set(m.duplicate_of, m.cnt);
  }

  // Pre-fetch reference IDs for duplicate_of references
  const refMap = new Map<number, string>();
  const idRows = db.prepare('SELECT id, reference_id FROM complaints').all() as Array<{ id: number; reference_id: string }>;
  for (const r of idRows) {
    refMap.set(r.id, r.reference_id);
  }

  return rows.map((r) => {
    const norm = normalizeComplaint(r);
    norm.duplicate_count = countMap.get(r.id) || 0;
    if (r.duplicate_of) {
      norm.master_reference_id = refMap.get(r.duplicate_of) || `FMS-JAL-${String(r.duplicate_of).padStart(4, '0')}`;
    }
    return norm;
  });
}

function normalizeComplaint(c: ComplaintRecord): ComplaintRecord {
  let status: 'Pending' | 'In Progress' | 'Resolved' = 'Pending';
  const s = (c.status || '').toLowerCase();
  if (s.includes('resolved')) {
    status = 'Resolved';
  } else if (s.includes('progress')) {
    status = 'In Progress';
  } else {
    status = 'Pending';
  }

  let priority = c.priority || 'Normal';
  const p = priority.toLowerCase();
  if (p.includes('urgent')) {
    priority = 'Urgent';
  } else if (p.includes('high')) {
    priority = 'High';
  } else if (p.includes('low')) {
    priority = 'Low';
  } else {
    priority = 'Normal';
  }

  return { 
    ...c, 
    status,
    priority,
    assigned_department: c.assigned_department || 'Unassigned',
    duplicate_of: c.duplicate_of ? Number(c.duplicate_of) : null,
  };
}

export function getComplaintByIdOrRef(idOrRef: string | number): ComplaintRecord | null {
  const db = getDatabase();
  const searchStr = String(idOrRef).trim();
  
  const numericMatch = searchStr.match(/\d+/);
  const numericId = numericMatch ? parseInt(numericMatch[0], 10) : null;

  let complaint: ComplaintRecord | null = null;

  if (numericId !== null) {
    const stmt = db.prepare('SELECT * FROM complaints WHERE id = ? OR reference_id LIKE ? LIMIT 1');
    complaint = stmt.get(numericId, `%${searchStr}%`) as unknown as ComplaintRecord;
  }

  if (!complaint) {
    const stmt = db.prepare('SELECT * FROM complaints WHERE LOWER(reference_id) = LOWER(?) LIMIT 1');
    complaint = stmt.get(searchStr) as unknown as ComplaintRecord;
  }

  if (!complaint) return null;

  complaint = normalizeComplaint(complaint);

  // Load chronological status updates history
  const updatesStmt = db.prepare(`
    SELECT * FROM complaint_updates 
    WHERE complaint_id = ? 
    ORDER BY created_at ASC, id ASC
  `);
  const updates = updatesStmt.all(complaint.id) as unknown as ComplaintUpdate[];

  if (updates.length === 0) {
    updates.push({
      id: 0,
      complaint_id: complaint.id,
      status: complaint.status,
      message: 'Complaint submitted by citizen and logged in municipal database.',
      author: 'Citizen Portal',
      created_at: complaint.created_at,
    });
  }

  complaint.updates = updates;

  // Master reference ID if this is a duplicate
  if (complaint.duplicate_of) {
    const masterRow = db.prepare('SELECT reference_id FROM complaints WHERE id = ?').get(complaint.duplicate_of) as { reference_id: string } | undefined;
    complaint.master_reference_id = masterRow ? masterRow.reference_id : `FMS-JAL-${String(complaint.duplicate_of).padStart(4, '0')}`;
  }

  // Count how many complaints are duplicates of this
  const dupCountRow = db.prepare('SELECT COUNT(*) as cnt FROM complaints WHERE duplicate_of = ?').get(complaint.id) as { cnt: number };
  complaint.duplicate_count = dupCountRow ? dupCountRow.cnt : 0;

  return complaint;
}

export function createComplaint(data: {
  name: string;
  description: string;
  category: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  priority?: string;
  assigned_department?: string;
  duplicate_of?: number | null;
}): ComplaintRecord {
  const db = getDatabase();
  
  // Auto-route to department based on category
  let defaultDept = data.assigned_department || 'Unassigned';
  if (!data.assigned_department || data.assigned_department === 'Unassigned') {
    const cat = data.category.toLowerCase();
    if (cat.includes('road') || cat.includes('pothole')) {
      defaultDept = 'Roads & Pavement Department';
    } else if (cat.includes('waste') || cat.includes('garbage')) {
      defaultDept = 'Sanitation & Waste Management';
    } else if (cat.includes('light')) {
      defaultDept = 'Electrical & Streetlighting';
    } else if (cat.includes('drain')) {
      defaultDept = 'Drainage & Sewerage Board';
    } else if (cat.includes('water')) {
      defaultDept = 'Water Supply Department';
    }
  }

  const priorityVal = data.priority || 'Normal';

  const stmt = db.prepare(`
    INSERT INTO complaints (name, description, category, location, status, latitude, longitude, image_url, priority, assigned_department, duplicate_of)
    VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.name,
    data.description,
    data.category,
    data.location,
    data.latitude ?? null,
    data.longitude ?? null,
    data.image_url ?? null,
    priorityVal,
    defaultDept,
    data.duplicate_of ?? null
  );

  const newId = Number(result.lastInsertRowid);
  const refId = `FMS-JAL-${String(newId).padStart(4, '0')}`;

  db.prepare('UPDATE complaints SET reference_id = ? WHERE id = ?').run(refId, newId);

  // Insert initial status update
  const initialMsg = priorityVal === 'Urgent'
    ? `🚨 URGENT Hazard reported by citizen. Dispatched to ${defaultDept} for expedited review.`
    : `Complaint registered by citizen and assigned to ${defaultDept}.`;

  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, 'Pending', ?, 'Citizen Portal')
  `).run(newId, initialMsg);

  return getComplaintByIdOrRef(newId)!;
}

export function updateComplaintStatus(
  id: number,
  status: string,
  adminNotes?: string,
  author: string = 'Municipal Officer',
  department?: string,
  priority?: string
): ComplaintRecord | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  let canonicalStatus: 'Pending' | 'In Progress' | 'Resolved' = 'Pending';
  const s = status.toLowerCase();
  if (s.includes('resolved')) {
    canonicalStatus = 'Resolved';
  } else if (s.includes('progress')) {
    canonicalStatus = 'In Progress';
  } else {
    canonicalStatus = 'Pending';
  }

  let query = 'UPDATE complaints SET status = ?, updated_at = ?';
  const params: (string | number)[] = [canonicalStatus, now];

  if (adminNotes !== undefined) {
    query += ', admin_notes = ?';
    params.push(adminNotes);
  }

  if (department !== undefined) {
    query += ', assigned_department = ?';
    params.push(department);
  }

  if (priority !== undefined) {
    query += ', priority = ?';
    params.push(priority);
  }

  query += ' WHERE id = ?';
  params.push(id);

  db.prepare(query).run(...params);

  // Add entry to complaint_updates
  const noteMessage = adminNotes && adminNotes.trim().length > 0 
    ? adminNotes.trim() 
    : department 
    ? `Status updated to ${canonicalStatus} and assigned to ${department}`
    : `Status updated to ${canonicalStatus}`;

  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, ?, ?, ?)
  `).run(id, canonicalStatus, noteMessage, author);

  return getComplaintByIdOrRef(id);
}

export function updateComplaintPriority(
  id: number,
  priority: string,
  author: string = 'Municipal Operations',
  reason?: string
): ComplaintRecord | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare('UPDATE complaints SET priority = ?, updated_at = ? WHERE id = ?').run(priority, now, id);

  const existing = getComplaintByIdOrRef(id);
  const status = existing ? existing.status : 'Pending';

  const msg = reason 
    ? `Priority marked as ${priority}: ${reason}` 
    : `Priority escalated to ${priority} by operations officer.`;

  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, ?, ?, ?)
  `).run(id, status, msg, author);

  return getComplaintByIdOrRef(id);
}

export function markComplaintAsDuplicate(
  duplicateId: number,
  masterId: number,
  author: string = 'Municipal Triage Officer'
): { duplicate: ComplaintRecord | null; master: ComplaintRecord | null } {
  const db = getDatabase();
  const now = new Date().toISOString();

  const dup = getComplaintByIdOrRef(duplicateId);
  const master = getComplaintByIdOrRef(masterId);

  if (!dup || !master) {
    throw new Error('Both duplicate and master complaints must exist.');
  }

  if (dup.id === master.id) {
    throw new Error('A complaint cannot be marked as a duplicate of itself.');
  }

  // Update duplicate record
  db.prepare(`
    UPDATE complaints 
    SET duplicate_of = ?, status = 'Resolved', updated_at = ?
    WHERE id = ?
  `).run(master.id, now, dup.id);

  // Add timeline update on duplicate
  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, 'Resolved', ?, ?)
  `).run(
    dup.id,
    `Identified as duplicate of master complaint ${master.reference_id}. All field work consolidated under master record.`,
    author
  );

  // Add timeline update on master
  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, ?, ?, ?)
  `).run(
    master.id,
    master.status,
    `Additional citizen report ${dup.reference_id} (Citizen: ${dup.name}) merged into this ticket.`,
    author
  );

  return {
    duplicate: getComplaintByIdOrRef(duplicateId),
    master: getComplaintByIdOrRef(masterId),
  };
}

export function unmarkComplaintDuplicate(
  duplicateId: number,
  author: string = 'Municipal Triage Officer'
): ComplaintRecord | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE complaints 
    SET duplicate_of = NULL, updated_at = ?
    WHERE id = ?
  `).run(now, duplicateId);

  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, 'Pending', 'Unmarked as duplicate. Reopened as an independent complaint.', ?)
  `).run(duplicateId, author);

  return getComplaintByIdOrRef(duplicateId);
}

export function assignDepartment(
  id: number,
  department: string,
  author: string = 'Municipal Dispatcher'
): ComplaintRecord | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE complaints 
    SET assigned_department = ?, updated_at = ?
    WHERE id = ?
  `).run(department, now, id);

  const existing = getComplaintByIdOrRef(id);
  const status = existing ? existing.status : 'Pending';

  db.prepare(`
    INSERT INTO complaint_updates (complaint_id, status, message, author)
    VALUES (?, ?, ?, ?)
  `).run(id, status, `Complaint routed to ${department} for inspection and dispatch.`, author);

  return getComplaintByIdOrRef(id);
}

export function deleteComplaint(id: number): boolean {
  const db = getDatabase();
  
  // Unlink any complaints that were duplicates of this one
  db.prepare('UPDATE complaints SET duplicate_of = NULL WHERE duplicate_of = ?').run(id);

  // Delete timeline updates
  db.prepare('DELETE FROM complaint_updates WHERE complaint_id = ?').run(id);

  // Delete complaint
  const result = db.prepare('DELETE FROM complaints WHERE id = ?').run(id);
  
  return result.changes > 0;
}

export function getStats() {
  const db = getDatabase();
  const total = (db.prepare('SELECT COUNT(*) as count FROM complaints').get() as { count: number }).count;
  const pending = (db.prepare("SELECT COUNT(*) as count FROM complaints WHERE LOWER(status) IN ('pending', 'submitted', 'under review')").get() as { count: number }).count;
  const inProgress = (db.prepare("SELECT COUNT(*) as count FROM complaints WHERE LOWER(status) LIKE '%progress%'").get() as { count: number }).count;
  const resolved = (db.prepare("SELECT COUNT(*) as count FROM complaints WHERE LOWER(status) LIKE '%resolved%'").get() as { count: number }).count;
  const urgent = (db.prepare("SELECT COUNT(*) as count FROM complaints WHERE LOWER(priority) = 'urgent' AND LOWER(status) NOT LIKE '%resolved%'").get() as { count: number }).count;
  const duplicates = (db.prepare('SELECT COUNT(*) as count FROM complaints WHERE duplicate_of IS NOT NULL AND duplicate_of > 0').get() as { count: number }).count;

  return {
    total,
    pending,
    inProgress,
    resolved,
    urgent,
    duplicates,
    active: total - resolved,
  };
}
