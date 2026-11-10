# FixMyStreet — Civic Issue Reporting & Management Platform

A responsive, production-ready civic reporting and municipal dispatch platform pilot concept for Jalandhar, Punjab.

---

## 🌟 Core Capabilities & Features

### 1. Duplicate Detection (Identify Repeated Complaints)
- **Spatial Proximity Engine**: Computes great-circle distance between complaints using the **Haversine formula** ($\le 350$ meters radius) across OpenStreetMap geo-coordinates.
- **Fuzzy Address Token Matching**: Analyzes neighborhood keywords (e.g. *Model Town*, *Cantt Road*, *Urban Estate*, *BMC Chowk*) to identify duplicates even when filed without exact GPS.
- **Real-Time Citizen Reporting Alerts**: As citizens select a category or pin their location, the system performs a debounced check to `/api/complaints/check-duplicate`. If matching issues exist, a non-blocking alert banner displays existing ticket IDs with direct tracking links so citizens avoid duplicating work.
- **Administrative Merge & Consolidate**:
  - In the Municipal Admin Dashboard, officers can view detected duplicate candidates and merge tickets with a single click.
  - Linked tickets record a canonical audit log on both tickets (`duplicate_of = master_id`).
  - Master tickets display a `📎 X Merged Reports` badge; duplicate tickets show `⚠️ Duplicate of [Master ID]` with a direct link and an option to unmark.

### 2. Priority System (Mark Urgent Complaints)
- **4 Urgency Levels**: `🔥 Urgent`, `High`, `Normal`, and `Low`.
- **Citizen Urgency Toggle**: Citizen reporting forms feature an emergency safety toggle (*"Mark as Urgent Public Safety Hazard"*) for high-risk life-safety situations (open live wires, missing manhole covers, deep craters on fast traffic lanes).
- **Pulsing Map Pins**: Urgent complaints receive a high-visibility red badge (`🚨`) and pulsating ring on OpenStreetMap.
- **Admin Triage & KPI Metrics**:
  - Dedicated red KPI card for `🔥 URGENT HAZARDS` needing emergency dispatch.
  - Triage modal allows municipal officers to escalate or de-escalate complaint priority with logged reason.
  - Visual badges in the table and citizen tracker view (`🔥 URGENT`).

### 3. Multi-Criteria Search & Filter
- **Multi-Faceted Admin Dashboard**:
  - **Category**: *All Categories*, *Road & Pavement*, *Waste & Cleanliness*, *Streetlights*, *Drainage*, *Water Leakage*, *Other*.
  - **Status**: *All*, *Pending*, *In Progress*, *Resolved*.
  - **Priority**: *All*, *🔥 Urgent*, *High*, *Normal*, *Low*.
  - **Department**: Filter by specialized municipal teams (*Roads*, *Sanitation*, *Electrical*, *Drainage*, etc.).
  - **Duplicates**: *All Records*, *⚠️ Duplicates Only*, *Originals Only*.
  - **Real-Time Full-Text Search**: Filters instantly across reference IDs, citizen names, locations, descriptions, departments, and officer notes.
  - **Active Filter Counter**: Displays matching records count with a one-click "Clear Filters" button.
- **Public Community Feed & Map**:
  - Filter both the interactive map pins and list feed simultaneously by Category, Status, and `🔥 Urgent Only`.

---

### 4. Interactive Maps (Leaflet & OpenStreetMap)
- **Community Explorer Map**: Live OpenStreetMap tiles with custom status markers (orange for in-progress, green for resolved, blue for review, pulsing red for urgent).
- **Interactive Pin-Drop Map**: Pinpoint exact coordinates via drag-and-drop marker or one-click GPS geolocation.

### 5. Real Image Upload System
- Multi-part upload endpoint (`/api/upload`) saving to `public/uploads` with drag-and-drop, photo preview, and file validation.

### 6. Comprehensive Complaint Tracking
- **Unique Complaint ID**: Persistent reference code (e.g. `FMS-JAL-0003`) with copy-to-clipboard and permalink sharing.
- **Canonical 3-Stage Workflow**: Clearly progresses across **Pending ➔ In Progress ➔ Resolved**.
- **Chronological Audit Trail**: Full activity timeline (`complaint_updates`) recording inspection notes and crew dispatches.
- Dedicated portal at [`/track`](http://localhost:3000/track).

---

## 🛠️ Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Editorial design system (`Playfair Display`, `DM Sans`, `DM Mono`), custom responsive CSS
- **Maps**: Leaflet & OpenStreetMap (`react-leaflet` / native Leaflet divIcons)
- **Icons**: Lucide React
- **Database**: SQLite (Node.js native `DatabaseSync` + Python `sqlite3`)
- **Backend Options**: Next.js API Routes (built-in) or FastAPI (`backend/main.py`)

---

## 🚀 Running Locally

1. Open this directory:
   ```bash
   cd C:\Users\ASUS\.gemini\antigravity\scratch\fixmystreet-website
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open in your browser:
   - **Public Portal**: [http://localhost:3000](http://localhost:3000)
   - **File a Report**: [http://localhost:3000/report](http://localhost:3000/report)
   - **Municipal Portal**: [http://localhost:3000/admin](http://localhost:3000/admin)
   - **Live Complaint Tracker**: [http://localhost:3000/track](http://localhost:3000/track)

---

## 📡 REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/complaints` | Multi-filter complaints (`?category=`, `?status=`, `?priority=`, `?department=`, `?duplicateFilter=`, `?search=`) |
| `POST` | `/api/complaints` | Submit a new complaint (supports `priority`, `duplicate_of`, `image_url`) |
| `POST` | `/api/complaints/check-duplicate` | Spatial & keyword duplicate detection engine |
| `GET` | `/api/complaints/:id` | Look up complaint by ID or Reference ID (includes audit timeline & duplicate info) |
| `PATCH` | `/api/complaints/:id` | Update status, department, priority, or merge as duplicate (`action: 'mark_duplicate'`) |
| `DELETE` | `/api/complaints/:id` | Permanently delete spam or duplicate complaint |
| `GET` | `/api/stats` | KPI metrics (total, pending, in-progress, resolved, urgent, duplicates) |
| `POST` | `/api/upload` | Multipart image uploader |
