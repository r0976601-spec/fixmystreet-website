'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, ArrowUpRight, Check, Copy, LocateFixed,
  MapPin, Sparkles, X, AlertCircle, Camera, AlertTriangle, Flame
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';

const LocationPickerMap = dynamic(
  () => import('@/components/LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '240px', background: '#f0ece3', display: 'grid', placeItems: 'center', color: '#777', borderRadius: '6px' }}>
        <span style={{ font: '11px var(--mono)' }}>Loading OpenStreetMap pin drop...</span>
      </div>
    ),
  }
);

const categories = [
  { id: 'Road & Pavement', icon: '🚧', name: 'Road & Pavement', desc: 'Potholes, broken paving, open trenches' },
  { id: 'Waste & Cleanliness', icon: '🗑️', name: 'Waste & Garbage', desc: 'Overflowing bins, illegal dumping, litter' },
  { id: 'Streetlights', icon: '💡', name: 'Streetlights', desc: 'Damaged poles, blacked out lamps, flickering' },
  { id: 'Drainage', icon: '🌊', name: 'Drainage & Sewers', desc: 'Clogged gratings, overflow, bad odors' },
  { id: 'Water Leakage', icon: '💧', name: 'Water Pipe Burst', desc: 'Supply pipe leaks, road water pooling' },
  { id: 'Other', icon: '📍', name: 'Other Hazard', desc: 'Fallen trees, dangerous signage, encroachments' },
];

interface DuplicateItem {
  id: number;
  reference_id: string;
  name: string;
  category: string;
  location: string;
  status: string;
  priority?: string;
  distanceMeters?: number | null;
  matchReason: string;
}

export default function ReportPage() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Road & Pavement');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({ lat: 31.3260, lng: 75.5762 });
  const [image, setImage] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  
  // Duplicate detection state
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [potentialDuplicates, setPotentialDuplicates] = useState<DuplicateItem[]>([]);
  const [dismissDuplicateWarning, setDismissDuplicateWarning] = useState(false);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [createdComplaint, setCreatedComplaint] = useState<{
    id: number;
    reference_id: string;
    category: string;
    location: string;
    status: string;
    priority?: string;
    image_url?: string | null;
  } | null>(null);

  function handleLocationPicked(lat: number, lng: number, placeLabel?: string) {
    setCoordinates({ lat, lng });
    if (placeLabel) {
      setLocation(placeLabel);
    } else if (!location) {
      setLocation(`Model Town / Jalandhar (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  }

  // Real-time Duplicate Detection debounced check
  useEffect(() => {
    if (!location.trim() && !coordinates.lat) {
      setPotentialDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingDuplicates(true);
        const res = await fetch('/api/complaints/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            location: location.trim(),
            latitude: coordinates.lat,
            longitude: coordinates.lng,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setPotentialDuplicates(data.duplicates || []);
          setDismissDuplicateWarning(false);
        }
      } catch (err) {
        console.error('Error checking duplicates:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [category, location, coordinates.lat, coordinates.lng]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!category || !description.trim() || !location.trim()) {
      setError('Please complete all required fields.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          location: location.trim(),
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          image_url: image,
          priority: isUrgent ? 'Urgent' : 'Normal',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint.');
      }

      setCreatedComplaint(data.complaint || {
        id: data.id,
        reference_id: data.reference_id,
        category,
        location,
        status: data.status,
        priority: data.priority,
        image_url: image,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting report.');
    } finally {
      setSubmitting(false);
    }
  }

  function copyReferenceId() {
    if (createdComplaint?.reference_id) {
      navigator.clipboard.writeText(createdComplaint.reference_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Success view
  if (createdComplaint) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--paper)', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '540px', width: '100%', textAlign: 'center', background: '#fff', padding: '48px 36px', border: '1px solid var(--line)', borderRadius: '8px', boxShadow: '0 12px 35px rgba(0,0,0,0.04)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eaf2eb', color: '#457952', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Check size={30} />
          </div>

          {createdComplaint.image_url && (
            <div style={{ width: '100%', height: '160px', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px', border: '1px solid #dedbd0' }}>
              <img src={createdComplaint.image_url} alt="Attached hazard" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ font: '10px var(--mono)', color: 'var(--orange-dark)', letterSpacing: '2px' }}>
              CIVIC REPORT RECORDED
            </span>
            {createdComplaint.priority === 'Urgent' && (
              <span className="badge-priority badge-priority-urgent">
                🔥 URGENT HAZARD
              </span>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '32px', fontWeight: 500, margin: '8px 0 14px' }}>
            Thank you for speaking up.
          </h1>
          <p style={{ color: '#68655c', fontSize: '13px', lineHeight: 1.7, marginBottom: '20px' }}>
            Your geo-tagged report and photograph are now logged with municipal maintenance dispatch.
          </p>
          
          <div style={{ background: '#faf8f3', border: '1px solid #dedbd0', borderRadius: '6px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ textAlign: 'left' }}>
              <span style={{ font: '9px var(--mono)', color: '#888', display: 'block' }}>REFERENCE TRACKING ID</span>
              <strong style={{ font: '600 20px var(--mono)', color: 'var(--orange-dark)' }}>
                {createdComplaint.reference_id}
              </strong>
            </div>
            <button
              onClick={copyReferenceId}
              style={{ background: '#fff', border: '1px solid #d4cfc3', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', font: '11px var(--mono)' }}
            >
              <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link
              href={`/track?id=${encodeURIComponent(createdComplaint.reference_id)}`}
              className="button button-orange"
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              Track Status & Latest Updates <ArrowUpRight size={14} />
            </Link>
            <Link
              href="/"
              className="button button-dark"
              style={{ width: '100%', boxSizing: 'border-box' }}
            >
              Return to Community Feed
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: 'var(--paper)', minHeight: '100vh', color: 'var(--ink)' }}>
      {/* Header */}
      <header style={{ padding: '22px 7%', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
        <Link href="/" className="brand">
          <span className="brand-mark"><span /></span>
          <span>fixmy<span className="brand-light">street.</span></span>
        </Link>
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <Link href="/track" style={{ fontSize: '13px', color: '#666' }}>
            Track Complaint
          </Link>
          <Link href="/" style={{ color: '#77746d', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <section style={{ maxWidth: '820px', margin: 'auto', padding: '50px 24px 90px' }}>
        <div style={{ font: '10px var(--mono)', color: 'var(--orange-dark)', letterSpacing: '2.5px', marginBottom: '8px' }}>
          JALANDHAR PILOT · CIVIC REPORTING
        </div>

        <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'clamp(36px, 5vw, 54px)', lineHeight: 1.08, margin: '12px 0 16px' }}>
          Make your neighbourhood <span style={{ color: 'var(--orange)', fontStyle: 'italic' }}>better.</span>
        </h1>

        <p style={{ color: '#77746d', fontSize: '14px', lineHeight: 1.8, maxWidth: '620px', marginBottom: '36px' }}>
          Pin the exact street hazard on our interactive OpenStreetMap and attach a clear photograph. The municipal maintenance crew receives the exact geo-coordinates.
        </p>

        <form onSubmit={handleSubmit} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', padding: '36px', boxShadow: '0 8px 30px rgba(0,0,0,0.03)' }}>
          
          {/* 01. Reporter Name */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              01. Your Full Name
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>
              Used by field teams to authenticate the ticket.
            </p>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gurpreet Singh"
              required
            />
          </div>

          {/* 02. Category */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              02. What kind of issue is it?
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 14px' }}>
              Select the category that best matches what you observed.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {categories.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  style={{
                    padding: '14px',
                    textAlign: 'left',
                    background: category === item.id ? '#faede6' : '#faf9f5',
                    border: category === item.id ? '1.5px solid var(--orange)' : '1px solid #dedbd1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--ink)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '22px', display: 'block', marginBottom: '6px' }}>{item.icon}</span>
                  <strong style={{ fontSize: '13px', display: 'block', marginBottom: '2px' }}>{item.name}</strong>
                  <span style={{ fontSize: '11px', color: '#777', lineHeight: 1.3, display: 'block' }}>{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 03. Interactive Map Pin Drop */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              03. Pin the Location on the Interactive Map
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>
              Click or drag the marker anywhere across Jalandhar to set the exact coordinates.
            </p>
            <LocationPickerMap
              initialLat={coordinates.lat}
              initialLng={coordinates.lng}
              onLocationSelected={handleLocationPicked}
              height="260px"
            />
          </div>

          {/* 04. Location Street Name */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              04. Street, Colony, or Landmark
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 10px' }}>
              Add nearby references (e.g. Model Town Park gate 2, near bus shelter).
            </p>
            <input
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Model Town Road, near Gurudwara roundabout"
              required
            />
          </div>

          {/* REAL-TIME DUPLICATE DETECTION WARNING */}
          {potentialDuplicates.length > 0 && !dismissDuplicateWarning && (
            <div className="duplicate-alert-box">
              <div className="duplicate-alert-header">
                <span className="duplicate-alert-title">
                  <AlertTriangle size={16} color="#d99214" />
                  POTENTIAL DUPLICATE DETECTED ({potentialDuplicates.length} MATCHING {potentialDuplicates.length === 1 ? 'REPORT' : 'REPORTS'})
                </span>
                <button
                  type="button"
                  onClick={() => setDismissDuplicateWarning(true)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}
                  title="Dismiss warning and proceed"
                >
                  <X size={15} />
                </button>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6e541b', lineHeight: 1.5 }}>
                A similar {category} issue has already been reported in this immediate area. Check existing tickets before submitting:
              </p>
              {potentialDuplicates.slice(0, 2).map((dup) => (
                <div key={dup.id} className="duplicate-item-card">
                  <div>
                    <span style={{ font: '600 11px var(--mono)', color: 'var(--orange-dark)' }}>{dup.reference_id}</span>
                    <strong style={{ fontSize: '12px', marginLeft: '6px' }}>{dup.category}</strong>
                    <span style={{ fontSize: '11px', color: '#666', display: 'block', marginTop: '2px' }}>
                      📍 {dup.location} {dup.distanceMeters != null ? `(~${dup.distanceMeters}m away)` : ''} · Status: <strong>{dup.status}</strong>
                    </span>
                  </div>
                  <Link
                    href={`/track?id=${encodeURIComponent(dup.reference_id)}`}
                    target="_blank"
                    style={{
                      font: '600 11px var(--mono)',
                      color: 'var(--orange-dark)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Track Existing Issue <ArrowUpRight size={13} />
                  </Link>
                </div>
              ))}
              <span style={{ fontSize: '11px', color: '#888', display: 'block', marginTop: '8px', fontStyle: 'italic' }}>
                If your report concerns a different hazard, you may freely proceed with submission below.
              </span>
            </div>
          )}

          {/* 05. Urgency & Hazard Priority Toggle */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              05. Urgency & Public Safety Level
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>
              Helps municipal dispatchers prioritize immediate life-safety hazards.
            </p>
            <div
              className={`urgency-toggle-card ${isUrgent ? 'is-urgent' : ''}`}
              onClick={() => setIsUrgent(!isUrgent)}
            >
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '13px', color: isUrgent ? '#b52b20' : 'var(--ink)' }}>
                    {isUrgent ? '🔥 Marked as Urgent Public Safety Hazard' : 'Mark as Urgent Hazard (Immediate Danger to Public)'}
                  </strong>
                  {isUrgent && <span className="badge-priority badge-priority-urgent">🔥 URGENT</span>}
                </div>
                <p style={{ fontSize: '11px', color: '#777', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Examples: Live exposed electrical wire, missing drain manhole cover, road cave-in on fast traffic lane, or burst main flooding highway.
                </p>
              </div>
            </div>
          </div>

          {/* 06. Photo Upload */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              06. Attach Photograph of the Hazard
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 12px' }}>
              Take or upload a photo showing the pothole, streetlight pole, or overflow. Max 5MB.
            </p>
            <ImageUploader
              currentImageUrl={image}
              onImageUploaded={(url) => setImage(url)}
            />
          </div>

          {/* 07. Description */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              07. Problem Description
            </label>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 10px' }}>
              Detail severity, pedestrian/traffic risk, or when it started.
            </p>
            <textarea
              className="form-textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Large pothole with exposed sharp gravel on the bicycle and motorcycle lane. Multiple vehicles have suffered tire damage."
              maxLength={1000}
              required
            />
            <span style={{ fontSize: '11px', color: '#999', display: 'block', textAlign: 'right', marginTop: '4px' }}>
              {description.length}/1000
            </span>
          </div>

          {error && (
            <div style={{ color: '#b34235', background: '#fae9e6', padding: '12px 16px', borderRadius: '4px', fontSize: '13px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            className="button button-orange"
            style={{ width: '100%', padding: '16px', fontSize: '14px', cursor: submitting ? 'wait' : 'pointer' }}
            disabled={submitting}
          >
            {submitting ? 'Submitting to Municipal Database...' : 'Submit Civic Report'} <ArrowUpRight size={16} />
          </button>
        </form>
      </section>
    </main>
  );
}
