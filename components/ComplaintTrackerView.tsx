'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Calendar, Check, CheckCircle2, Clock, Copy, MapPin,
  Share2, ShieldCheck, User, AlertCircle, ArrowUpRight
} from 'lucide-react';
import type { ComplaintRecord } from '@/lib/db';

interface ComplaintTrackerViewProps {
  complaint: ComplaintRecord;
}

export default function ComplaintTrackerView({ complaint }: ComplaintTrackerViewProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Canonical 3-stage status index: Pending = 0, In Progress = 1, Resolved = 2
  const statusLower = (complaint.status || '').toLowerCase();
  const currentStageIndex = statusLower.includes('resolved')
    ? 2
    : statusLower.includes('progress')
    ? 1
    : 0;

  function handleCopyId() {
    navigator.clipboard.writeText(complaint.reference_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareLink() {
    const url = `${window.location.origin}/track?id=${encodeURIComponent(complaint.reference_id)}`;
    navigator.clipboard.writeText(url);
    setShared(true);
    setTimeout(() => setShared(false), 2500);
  }

  // Format date of submission
  const submissionDate = new Date(complaint.created_at);
  const formattedSubmissionDate = submissionDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate relative age
  const diffHours = Math.round((Date.now() - submissionDate.getTime()) / (1000 * 60 * 60));
  const relativeAge =
    diffHours < 1
      ? 'Just now'
      : diffHours === 1
      ? '1 hour ago'
      : diffHours < 24
      ? `${diffHours} hours ago`
      : `${Math.round(diffHours / 24)} days ago`;

  const updates = complaint.updates || [];
  const latestUpdate = updates.length > 0 ? updates[updates.length - 1] : null;

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #dedbd0',
        borderRadius: '8px',
        padding: '32px',
        boxShadow: '0 10px 35px rgba(0,0,0,0.04)',
      }}
    >
      {/* 1. Header with Unique Complaint ID & Status Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '14px',
          paddingBottom: '20px',
          borderBottom: '1px solid #eeebe3',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ font: '10px var(--mono)', color: '#888', letterSpacing: '1px' }}>
              UNIQUE COMPLAINT ID
            </span>
            <button
              onClick={handleCopyId}
              style={{
                background: '#faf8f4',
                border: '1px solid #dfdbd1',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                font: '9px var(--mono)',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Copy size={11} /> {copied ? 'Copied' : 'Copy ID'}
            </button>
            <button
              onClick={handleShareLink}
              style={{
                background: '#faf8f4',
                border: '1px solid #dfdbd1',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                font: '9px var(--mono)',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Share2 size={11} /> {shared ? 'Link Copied!' : 'Share'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2
              style={{
                fontFamily: 'var(--mono)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--orange-dark)',
                margin: '0 0 6px',
                letterSpacing: '1px',
              }}
            >
              {complaint.reference_id}
            </h2>
            {complaint.priority && complaint.priority.toLowerCase() === 'urgent' && (
              <span className="badge-priority badge-priority-urgent" style={{ marginBottom: '6px' }}>
                🔥 URGENT HAZARD
              </span>
            )}
            {complaint.priority && complaint.priority.toLowerCase() === 'high' && (
              <span className="badge-priority badge-priority-high" style={{ marginBottom: '6px' }}>
                HIGH PRIORITY
              </span>
            )}
            {(complaint.duplicate_count || 0) > 0 && (
              <span className="badge-merged-master" style={{ marginBottom: '6px' }}>
                📎 {complaint.duplicate_count} MERGED {complaint.duplicate_count === 1 ? 'REPORT' : 'REPORTS'}
              </span>
            )}
          </div>
          <span style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={13} color="var(--orange)" /> {complaint.location}
          </span>
        </div>

        {/* Status Pill: Pending / In Progress / Resolved */}
        <div style={{ textAlign: 'right' }}>
          <span style={{ font: '9px var(--mono)', color: '#888', display: 'block', marginBottom: '4px' }}>
            CURRENT STATUS
          </span>
          <span
            className={`badge-status badge-${complaint.status.toLowerCase().replace(' ', '-')}`}
            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '16px' }}
          >
            <i style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
            {complaint.status}
          </span>
        </div>
      </div>

      {/* Duplicate Notice Banner if merged into a master ticket */}
      {complaint.duplicate_of && (
        <div
          style={{
            background: '#fffcf4',
            border: '1.5px solid #f3d489',
            borderLeft: '4px solid #d99214',
            borderRadius: '6px',
            padding: '14px 18px',
            margin: '20px 0 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <strong style={{ font: '600 12px var(--mono)', color: '#8c5b05', display: 'block', marginBottom: '2px' }}>
              ⚠️ MERGED WITH MASTER COMPLAINT {complaint.master_reference_id}
            </strong>
            <p style={{ margin: 0, fontSize: '12px', color: '#6e541b', lineHeight: 1.5 }}>
              This complaint was identified as a duplicate and consolidated with an earlier report for the same location.
            </p>
          </div>
          <Link
            href={`/track?id=${encodeURIComponent(complaint.master_reference_id || `FMS-JAL-${complaint.duplicate_of}`)}`}
            className="button button-orange button-small"
            style={{ fontSize: '11px', padding: '8px 14px' }}
          >
            Track Master Complaint <ArrowUpRight size={13} />
          </Link>
        </div>
      )}

      {/* 2. Visual Canonical Stepper: Pending ➔ In Progress ➔ Resolved */}
      <div className="canonical-stepper">
        <div className="canonical-progress-bar">
          <div
            className="canonical-progress-fill"
            style={{ width: `${(currentStageIndex / 2) * 100}%` }}
          />
        </div>

        {/* Step 1: Pending */}
        <div className={`canonical-step-node ${currentStageIndex >= 0 ? 'completed' : ''} ${currentStageIndex === 0 ? 'active' : ''}`}>
          <div className="canonical-step-icon">
            {currentStageIndex > 0 ? <Check size={16} /> : '1'}
          </div>
          <div className="canonical-step-title">Pending</div>
          <span style={{ fontSize: '10px', color: '#999', display: 'block', marginTop: '2px' }}>
            Report logged & queued
          </span>
        </div>

        {/* Step 2: In Progress */}
        <div className={`canonical-step-node ${currentStageIndex >= 1 ? 'completed' : ''} ${currentStageIndex === 1 ? 'active' : ''}`}>
          <div className="canonical-step-icon">
            {currentStageIndex > 1 ? <Check size={16} /> : '2'}
          </div>
          <div className="canonical-step-title">In Progress</div>
          <span style={{ fontSize: '10px', color: '#999', display: 'block', marginTop: '2px' }}>
            Repair crew dispatched
          </span>
        </div>

        {/* Step 3: Resolved */}
        <div className={`canonical-step-node ${currentStageIndex >= 2 ? 'completed' : ''} ${currentStageIndex === 2 ? 'active' : ''}`}>
          <div className="canonical-step-icon">
            {currentStageIndex >= 2 ? <Check size={16} /> : '3'}
          </div>
          <div className="canonical-step-title">Resolved</div>
          <span style={{ fontSize: '10px', color: '#999', display: 'block', marginTop: '2px' }}>
            Fix inspected & closed
          </span>
        </div>
      </div>

      {/* 3. Date of Submission & Issue Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          background: '#faf8f4',
          border: '1px solid #ebe7df',
          borderRadius: '6px',
          padding: '18px 20px',
          margin: '24px 0',
        }}
      >
        <div>
          <span style={{ font: '9px var(--mono)', color: '#888', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <Calendar size={12} /> DATE OF SUBMISSION
          </span>
          <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
            {formattedSubmissionDate}
          </strong>
          <span style={{ fontSize: '11px', color: '#888' }}>({relativeAge})</span>
        </div>

        <div>
          <span style={{ font: '9px var(--mono)', color: '#888', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <User size={12} /> CITIZEN REPORTER
          </span>
          <strong style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
            {complaint.name}
          </strong>
          <span style={{ fontSize: '11px', color: '#888' }}>Category: {complaint.category}</span>
        </div>

        <div>
          <span style={{ font: '9px var(--mono)', color: '#888', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
            <MapPin size={12} /> GEO-COORDINATES
          </span>
          <strong style={{ fontSize: '13px', color: '#457952', fontFamily: 'var(--mono)', display: 'block' }}>
            {complaint.latitude && complaint.longitude
              ? `${complaint.latitude.toFixed(4)}° N, ${complaint.longitude.toFixed(4)}° E`
              : 'Jalandhar Municipal Ward'}
          </strong>
          <span style={{ fontSize: '11px', color: '#888' }}>Priority: {complaint.priority || 'Normal'}</span>
        </div>
      </div>

      {/* Description & Photo */}
      <div style={{ marginBottom: '24px' }}>
        <h4 style={{ font: '11px var(--mono)', letterSpacing: '0.8px', color: '#888', margin: '0 0 8px', textTransform: 'uppercase' }}>
          Problem Description
        </h4>
        <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#333', margin: 0, background: '#fff', padding: '14px', border: '1px solid #eee', borderRadius: '4px' }}>
          "{complaint.description}"
        </p>

        {complaint.image_url && (
          <div style={{ marginTop: '14px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #dedbd0', maxWidth: '340px' }}>
            <img
              src={complaint.image_url}
              alt="Hazard evidence"
              style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
      </div>

      {/* 4. Latest Status Updates Timeline */}
      <div className="tracking-timeline-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span style={{ font: '10px var(--mono)', color: 'var(--orange-dark)', letterSpacing: '1px' }}>
              OFFICIAL ACTIVITY AUDIT LOG
            </span>
            <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '20px', margin: '4px 0 0' }}>
              Latest Status Updates ({updates.length})
            </h3>
          </div>
          <span style={{ font: '10px var(--mono)', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} /> Auto-synced with Ward Maintenance
          </span>
        </div>

        <div className="timeline-feed">
          {updates.map((update, idx) => {
            const isLatest = idx === updates.length - 1;
            const updateDate = new Date(update.created_at);

            return (
              <div
                key={update.id || idx}
                className={`timeline-entry ${isLatest ? 'latest' : ''} ${update.status === 'Resolved' ? 'resolved' : ''}`}
              >
                <div className="timeline-dot">
                  {update.status === 'Resolved' ? '✓' : idx + 1}
                </div>
                <div className="timeline-card">
                  <div className="timeline-card-head">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge-status badge-${update.status.toLowerCase().replace(' ', '-')}`}>
                        {update.status}
                      </span>
                      <span className="timeline-author-pill">{update.author}</span>
                      {isLatest && (
                        <span style={{ font: '8px var(--mono)', background: '#faede6', color: 'var(--orange-dark)', padding: '2px 5px', borderRadius: '2px', fontWeight: 600 }}>
                          LATEST UPDATE
                        </span>
                      )}
                    </div>
                    <span className="timeline-timestamp">
                      {updateDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                      {updateDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="timeline-message">{update.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Assurance */}
      <div
        style={{
          marginTop: '28px',
          paddingTop: '16px',
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#888',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="#5a7d61" /> Protected under Jalandhar Municipal Public Services Act.
        </span>
        <Link href="/" className="text-link" style={{ fontSize: '11px' }}>
          Return to Community Home <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
