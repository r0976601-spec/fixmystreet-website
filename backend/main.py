import math
import sqlite3
import re
from typing import Optional, List
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DB_FILE = Path(__file__).parent / "fixmystreet.db"

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute("""
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
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS complaint_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            message TEXT NOT NULL,
            author TEXT DEFAULT 'Municipal Dispatch',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(complaint_id) REFERENCES complaints(id)
        )
    """)
    # Ensure columns exist in case table was created previously
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(complaints)").fetchall()]
    if "assigned_department" not in cols:
        conn.execute("ALTER TABLE complaints ADD COLUMN assigned_department TEXT DEFAULT 'Unassigned'")
    if "duplicate_of" not in cols:
        conn.execute("ALTER TABLE complaints ADD COLUMN duplicate_of INTEGER")
    if "priority" not in cols:
        conn.execute("ALTER TABLE complaints ADD COLUMN priority TEXT DEFAULT 'Normal'")

    conn.execute("""
        UPDATE complaints 
        SET reference_id = 'FMS-JAL-' || printf('%04d', id) 
        WHERE reference_id IS NULL OR reference_id = ''
    """)
    conn.execute("""
        UPDATE complaints 
        SET status = 'Pending' 
        WHERE status IN ('Submitted', 'Under Review')
    """)
    conn.commit()
    conn.close()

init_db()

app = FastAPI(
    title="FixMyStreet API",
    description="Community Problem Reporting System — Jalandhar Municipal Pilot",
    version="1.3.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fixmystreet.onrender.com",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ComplaintCreate(BaseModel):
    name: str
    description: str
    category: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_url: Optional[str] = None
    priority: Optional[str] = "Normal"
    assigned_department: Optional[str] = None
    duplicate_of: Optional[int] = None

class StatusUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None
    author: Optional[str] = "Municipal Officer"
    department: Optional[str] = None
    priority: Optional[str] = None

class DuplicateCheckRequest(BaseModel):
    category: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    exclude_id: Optional[int] = None
    threshold_meters: Optional[int] = 350

class MarkDuplicateRequest(BaseModel):
    master_id: int
    author: Optional[str] = "Municipal Triage Officer"

def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    R = 6371000  # Earth radius in meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(round(R * c))

def is_same_category(cat1: str, cat2: str) -> bool:
    if not cat1 or not cat2:
        return False
    c1, c2 = cat1.lower().strip(), cat2.lower().strip()
    if c1 == c2:
        return True
    if any(k in c1 for k in ['road', 'pothole']) and any(k in c2 for k in ['road', 'pothole']):
        return True
    if any(k in c1 for k in ['waste', 'garbage']) and any(k in c2 for k in ['waste', 'garbage']):
        return True
    if 'light' in c1 and 'light' in c2:
        return True
    if 'drain' in c1 and 'drain' in c2:
        return True
    if 'water' in c1 and 'water' in c2:
        return True
    return False

@app.get("/")
def home():
    return {
        "message": "Welcome to FixMyStreet API!",
        "status": "running",
        "location": "Jalandhar, Punjab",
        "endpoints": ["/complaints", "/report", "/complaints/{id}", "/stats", "/health", "/complaints/check-duplicate"]
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FixMyStreet Backend"
    }

@app.get("/stats")
def get_stats():
    conn = get_db_connection()
    total = conn.execute("SELECT COUNT(*) as c FROM complaints").fetchone()["c"]
    pending = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE LOWER(status) IN ('pending', 'submitted', 'under review')").fetchone()["c"]
    in_progress = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE LOWER(status) LIKE '%progress%'").fetchone()["c"]
    resolved = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE LOWER(status) LIKE '%resolved%'").fetchone()["c"]
    urgent = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE LOWER(priority) = 'urgent' AND LOWER(status) NOT LIKE '%resolved%'").fetchone()["c"]
    duplicates = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE duplicate_of IS NOT NULL AND duplicate_of > 0").fetchone()["c"]
    conn.close()

    return {
        "total": total,
        "pending": pending,
        "inProgress": in_progress,
        "resolved": resolved,
        "urgent": urgent,
        "duplicates": duplicates,
        "active": total - resolved
    }

@app.post("/complaints/check-duplicate")
def check_duplicate(payload: DuplicateCheckRequest):
    conn = get_db_connection()
    query = "SELECT * FROM complaints WHERE (duplicate_of IS NULL OR duplicate_of = 0)"
    params = []
    if payload.exclude_id:
        query += " AND id != ?"
        params.append(payload.exclude_id)
    query += " ORDER BY id DESC LIMIT 100"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    matches = []
    threshold = payload.threshold_meters or 350
    has_gps = payload.latitude is not None and payload.longitude is not None

    for r in rows:
        d = dict(r)
        cat_match = is_same_category(payload.category or "", d.get("category") or "")
        dist = None
        is_spatial = False

        if has_gps and d.get("latitude") is not None and d.get("longitude") is not None:
            dist = haversine_distance_meters(payload.latitude, payload.longitude, d["latitude"], d["longitude"])
            if dist <= threshold:
                is_spatial = True

        # Keyword match
        token_match = False
        matched_token = ""
        if payload.location and d.get("location"):
            tokens = [t.lower() for t in re.findall(r'\b\w{3,}\b', payload.location)]
            row_tokens = [t.lower() for t in re.findall(r'\b\w{3,}\b', d["location"])]
            for t in tokens:
                if t in row_tokens and t not in ['road', 'near', 'street', 'jalandhar']:
                    token_match = True
                    matched_token = t
                    break

        if is_spatial and cat_match:
            matches.append({
                "id": d["id"],
                "reference_id": d["reference_id"],
                "name": d["name"],
                "category": d["category"],
                "location": d["location"],
                "status": d["status"],
                "priority": d.get("priority", "Normal"),
                "distanceMeters": dist,
                "matchReason": f"Spatial match ~{dist}m away in same category",
                "confidence": "High" if dist <= 150 else "Medium"
            })
        elif token_match and cat_match:
            matches.append({
                "id": d["id"],
                "reference_id": d["reference_id"],
                "name": d["name"],
                "category": d["category"],
                "location": d["location"],
                "status": d["status"],
                "priority": d.get("priority", "Normal"),
                "distanceMeters": dist,
                "matchReason": f"Matching address keyword '{matched_token}' in same category",
                "confidence": "Medium"
            })

    return {
        "isPotentialDuplicate": len(matches) > 0,
        "count": len(matches),
        "duplicates": matches
    }

@app.get("/complaints")
def get_complaints(
    category: Optional[str] = None,
    status: Optional[str] = None,
    department: Optional[str] = None,
    priority: Optional[str] = None,
    duplicateFilter: Optional[str] = None,
    search: Optional[str] = None,
    limit: Optional[int] = 50
):
    conn = get_db_connection()
    query = "SELECT * FROM complaints WHERE 1=1"
    params = []

    if category and category != "All":
        query += " AND LOWER(category) LIKE ?"
        params.append(f"%{category.lower()}%")

    if status and status != "All":
        if status.lower() == "pending":
            query += " AND LOWER(status) IN ('pending', 'submitted', 'under review')"
        else:
            query += " AND LOWER(status) = LOWER(?)"
            params.append(status)

    if department and department != "All":
        query += " AND LOWER(assigned_department) = LOWER(?)"
        params.append(department)

    if priority and priority != "All":
        query += " AND LOWER(priority) = LOWER(?)"
        params.append(priority)

    if duplicateFilter == "duplicates_only":
        query += " AND duplicate_of IS NOT NULL AND duplicate_of > 0"
    elif duplicateFilter == "originals_only":
        query += " AND (duplicate_of IS NULL OR duplicate_of = 0)"

    if search:
        query += " AND (name LIKE ? OR description LIKE ? OR location LIKE ? OR reference_id LIKE ? OR assigned_department LIKE ? OR priority LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term, term, term])

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()

    # Pre-fetch master refs and duplicate counts
    ref_rows = conn.execute("SELECT id, reference_id FROM complaints").fetchall()
    ref_map = {r["id"]: r["reference_id"] for r in ref_rows}
    
    count_rows = conn.execute("""
        SELECT duplicate_of, COUNT(*) as cnt 
        FROM complaints 
        WHERE duplicate_of IS NOT NULL AND duplicate_of > 0 
        GROUP BY duplicate_of
    """).fetchall()
    count_map = {r["duplicate_of"]: r["cnt"] for r in count_rows}

    conn.close()
    
    result = []
    for r in rows:
        d = dict(r)
        s = (d.get("status") or "").lower()
        if "resolved" in s:
            d["status"] = "Resolved"
        elif "progress" in s:
            d["status"] = "In Progress"
        else:
            d["status"] = "Pending"

        p = (d.get("priority") or "Normal").capitalize()
        d["priority"] = p
        d["duplicate_count"] = count_map.get(d["id"], 0)
        if d.get("duplicate_of"):
            d["master_reference_id"] = ref_map.get(d["duplicate_of"], f"FMS-JAL-{d['duplicate_of']:04d}")

        result.append(d)
        
    return result

@app.get("/complaints/{id_or_ref}")
def get_complaint(id_or_ref: str):
    conn = get_db_connection()
    row = None
    if id_or_ref.isdigit():
        row = conn.execute("SELECT * FROM complaints WHERE id = ?", (int(id_or_ref),)).fetchone()
    
    if not row:
        row = conn.execute("SELECT * FROM complaints WHERE LOWER(reference_id) = LOWER(?)", (id_or_ref,)).fetchone()
        
    if not row:
        row = conn.execute("SELECT * FROM complaints WHERE reference_id LIKE ?", (f"%{id_or_ref}%",)).fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Complaint '{id_or_ref}' not found")

    complaint = dict(row)
    cid = complaint["id"]
    
    # Normalize status & priority
    s = (complaint.get("status") or "").lower()
    if "resolved" in s:
        complaint["status"] = "Resolved"
    elif "progress" in s:
        complaint["status"] = "In Progress"
    else:
        complaint["status"] = "Pending"
    complaint["priority"] = (complaint.get("priority") or "Normal").capitalize()

    # Updates timeline
    update_rows = conn.execute(
        "SELECT * FROM complaint_updates WHERE complaint_id = ? ORDER BY created_at ASC, id ASC",
        (cid,)
    ).fetchall()

    updates = [dict(u) for u in update_rows]
    if not updates:
        updates.append({
            "id": 0,
            "complaint_id": cid,
            "status": complaint["status"],
            "message": "Complaint submitted by citizen and logged in municipal database.",
            "author": "Citizen Portal",
            "created_at": complaint["created_at"]
        })

    complaint["updates"] = updates

    if complaint.get("duplicate_of"):
        master_row = conn.execute("SELECT reference_id FROM complaints WHERE id = ?", (complaint["duplicate_of"],)).fetchone()
        complaint["master_reference_id"] = master_row["reference_id"] if master_row else f"FMS-JAL-{complaint['duplicate_of']:04d}"

    dup_cnt = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE duplicate_of = ?", (cid,)).fetchone()["c"]
    complaint["duplicate_count"] = dup_cnt

    conn.close()
    return complaint

@app.post("/report")
def create_report(complaint: ComplaintCreate):
    conn = get_db_connection()
    cursor = conn.execute("""
        INSERT INTO complaints
        (name, description, category, location, status, latitude, longitude, image_url, priority, assigned_department, duplicate_of)
        VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?)
    """, (
        complaint.name,
        complaint.description,
        complaint.category,
        complaint.location,
        complaint.latitude,
        complaint.longitude,
        complaint.image_url,
        complaint.priority or "Normal",
        complaint.assigned_department or "Unassigned",
        complaint.duplicate_of
    ))

    complaint_id = cursor.lastrowid
    ref_id = f"FMS-JAL-{complaint_id:04d}"
    conn.execute("UPDATE complaints SET reference_id = ? WHERE id = ?", (ref_id, complaint_id))

    init_msg = "🚨 URGENT Hazard reported by citizen." if complaint.priority == "Urgent" else "Complaint registered by citizen."
    conn.execute("""
        INSERT INTO complaint_updates (complaint_id, status, message, author)
        VALUES (?, 'Pending', ?, 'Citizen Portal')
    """, (complaint_id, init_msg))

    conn.commit()

    saved = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    conn.close()

    res = dict(saved)
    res["status"] = "Pending"

    return {
        "message": "Complaint received successfully!",
        "complaint": res,
        "id": complaint_id,
        "reference_id": ref_id,
        "status": "Pending",
        "priority": res.get("priority", "Normal")
    }

@app.delete("/complaints/{id_or_ref}")
def delete_complaint(id_or_ref: str):
    conn = get_db_connection()
    row = None
    if id_or_ref.isdigit():
        row = conn.execute("SELECT id, reference_id FROM complaints WHERE id = ?", (int(id_or_ref),)).fetchone()
    if not row:
        row = conn.execute("SELECT id, reference_id FROM complaints WHERE LOWER(reference_id) = LOWER(?)", (id_or_ref,)).fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Complaint '{id_or_ref}' not found")

    cid = row["id"]
    ref_id = row["reference_id"]
    conn.execute("UPDATE complaints SET duplicate_of = NULL WHERE duplicate_of = ?", (cid,))
    conn.execute("DELETE FROM complaint_updates WHERE complaint_id = ?", (cid,))
    conn.execute("DELETE FROM complaints WHERE id = ?", (cid,))
    conn.commit()
    conn.close()

    return {
        "message": f"Complaint {ref_id} deleted successfully",
        "id": cid,
        "reference_id": ref_id
    }

@app.patch("/complaints/{id_or_ref}/status")
def update_status(id_or_ref: str, payload: StatusUpdate):
    conn = get_db_connection()
    row = None
    if id_or_ref.isdigit():
        row = conn.execute("SELECT id, status FROM complaints WHERE id = ?", (int(id_or_ref),)).fetchone()
    if not row:
        row = conn.execute("SELECT id, status FROM complaints WHERE LOWER(reference_id) = LOWER(?)", (id_or_ref,)).fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Complaint '{id_or_ref}' not found")

    cid = row["id"]
    new_status = row["status"]

    if payload.status:
        s = payload.status.lower()
        if "resolved" in s:
            new_status = "Resolved"
        elif "progress" in s:
            new_status = "In Progress"
        else:
            new_status = "Pending"

    message = payload.admin_notes.strip() if payload.admin_notes else f"Status updated to {new_status}"
    author = payload.author or "Municipal Officer"

    conn.execute("""
        UPDATE complaints 
        SET status = ?, 
            admin_notes = COALESCE(?, admin_notes), 
            assigned_department = COALESCE(?, assigned_department),
            priority = COALESCE(?, priority),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (new_status, payload.admin_notes, payload.department, payload.priority, cid))

    conn.execute("""
        INSERT INTO complaint_updates (complaint_id, status, message, author)
        VALUES (?, ?, ?, ?)
    """, (cid, new_status, message, author))

    conn.commit()

    updated = conn.execute("SELECT * FROM complaints WHERE id = ?", (cid,)).fetchone()
    conn.close()

    res = dict(updated)
    res["status"] = new_status

    return {
        "message": "Complaint updated successfully",
        "complaint": res
    }
