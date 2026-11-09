import sqlite3
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
def get_db_connection():
    conn = sqlite3.connect("fixmystreet.db")
    conn.row_factory = sqlite3.Row
    return conn


def create_table():
    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            location TEXT NOT NULL,
            status TEXT DEFAULT 'Submitted',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


create_table()
app = FastAPI(
    title="FixMyStreet API",
    description="Community Problem Reporting System - Jalandhar",
    version="1.0.0"
)

# Allow our Next.js frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
          "http://localhost:3000",
          "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Welcome to FixMyStreet API!",
        "status": "running",
        "location": "Jalandhar, Punjab"
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "FixMyStreet Backend"
    }


class Complaint(BaseModel):
    name: str
    description: str
    category: str
    location: str

@app.post("/report")
def create_report(complaint: Complaint):
    conn = get_db_connection()

    cursor = conn.execute("""
        INSERT INTO complaints
        (name, description, category, location)
        VALUES (?, ?, ?, ?)
    """, (
        complaint.name,
        complaint.description,
        complaint.category,
        complaint.location
    ))

    complaint_id = cursor.lastrowid

    conn.commit()
    conn.close()

    return {
        "message": "Complaint received successfully!",
        "id": complaint_id,
        "name": complaint.name,
        "description": complaint.description,
        "category": complaint.category,
        "location": complaint.location,
        "status": "Submitted"
    }
@app.get("/complaints")
def get_complaints():
    conn = get_db_connection()

    complaints = conn.execute(
        "SELECT * FROM complaints ORDER BY id DESC"
    ).fetchall()

    conn.close()

    return [dict(row) for row in complaints]    