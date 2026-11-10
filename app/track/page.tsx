'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, Clock3, Search, ShieldCheck,
  AlertCircle, RefreshCw, CheckCircle2, MapPin
} from 'lucide-react';
import ComplaintTrackerView from '@/components/ComplaintTrackerView';
import type { ComplaintRecord } from '@/lib/db';

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [inputQuery, setInputQuery] = useState(searchParams.get('id') || '');
  const [complaint, setComplaint] = useState<ComplaintRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchComplaint(idToSearch: string) {
    const trimmed = idToSearch.trim();
    if (!trimmed) {
      setError('Please enter a Complaint ID or Reference number.');
      setComplaint(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `No complaint found for reference "${trimmed}". Check your ID.`);
      }

      const data = await res.json();
      setComplaint(data);
      setInputQuery(data.reference_id || trimmed);
    } catch (err) {
      setComplaint(null);
      setError(err instanceof Error ? err.message : 'Failed to look up complaint.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-search if ?id= query param is provided in URL
  useEffect(() => {
    const initialId = searchParams.get('id');
    if (initialId) {
      setInputQuery(initialId);
      fetchComplaint(initialId);
    }
  }, [searchParams]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputQuery.trim()) {
      router.push(`/track?id=${encodeURIComponent(inputQuery.trim())}`);
      fetchComplaint(inputQuery.trim());
    }
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px 100px' }}>
      {/* Header Eyebrow */}
      <div style={{ font: '10px var(--mono)', color: 'var(--orange-dark)', letterSpacing: '2px', marginBottom: '8px' }}>
        CIVIC SERVICES · REAL-TIME VERIFICATION
      </div>

      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontWeight: 500,
          fontSize: 'clamp(34px, 5vw, 50px)',
          lineHeight: 1.1,
          margin: '10px 0 16px',
        }}
      >
        Track Your <span style={{ color: 'var(--orange)', fontStyle: 'italic' }}>Complaint.</span>
      </h1>

      <p style={{ color: '#77746d', fontSize: '15px', lineHeight: 1.8, maxWidth: '580px', marginBottom: '32px' }}>
        Enter your unique reference number (e.g. <code>FMS-JAL-0003</code> or <code>#3</code>) to inspect current status, submission timestamp, and chronological field updates.
      </p>

      {/* Search Input Box */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          background: '#fff',
          border: '1px solid #dedbd0',
          borderRadius: '8px',
          padding: '8px',
          display: 'flex',
          gap: '8px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingLeft: '14px' }}>
          <Search size={18} color="#888" />
          <input
            value={inputQuery}
            onChange={(e) => {
              setInputQuery(e.target.value);
              setError('');
            }}
            placeholder="Enter Complaint ID (e.g. FMS-JAL-0003 or 3)..."
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              fontFamily: 'var(--mono)',
              color: 'var(--ink)',
            }}
          />
        </div>
        <button
          type="submit"
          className="button button-orange"
          style={{ padding: '14px 24px', cursor: loading ? 'wait' : 'pointer' }}
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Track Status'} <ArrowUpRight size={15} />
        </button>
      </form>

      {/* Quick Demo ID pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '36px' }}>
        <span style={{ font: '10px var(--mono)', color: '#888' }}>QUICK TEST DEMO IDS:</span>
        <button
          className="demo-pill-btn"
          onClick={() => {
            setInputQuery('FMS-JAL-0003');
            fetchComplaint('FMS-JAL-0003');
          }}
        >
          FMS-JAL-0003 (In Progress)
        </button>
        <button
          className="demo-pill-btn"
          onClick={() => {
            setInputQuery('FMS-JAL-0004');
            fetchComplaint('FMS-JAL-0004');
          }}
        >
          FMS-JAL-0004 (Pending)
        </button>
        <button
          className="demo-pill-btn"
          onClick={() => {
            setInputQuery('FMS-JAL-0006');
            fetchComplaint('FMS-JAL-0006');
          }}
        >
          FMS-JAL-0006 (Resolved)
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            background: '#fceeed',
            border: '1px solid #f2c7c4',
            color: '#b34235',
            padding: '16px 20px',
            borderRadius: '6px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '32px',
          }}
        >
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Results View */}
      {complaint ? (
        <ComplaintTrackerView complaint={complaint} />
      ) : (
        /* Status Explanation Guide */
        <div
          style={{
            background: '#faf8f4',
            border: '1px solid #dedbd0',
            borderRadius: '8px',
            padding: '36px',
            marginTop: '20px',
          }}
        >
          <h3 style={{ fontFamily: 'var(--serif)', fontSize: '20px', margin: '0 0 16px' }}>
            How Complaint Tracking Works
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            <div style={{ background: '#fff', padding: '18px', borderRadius: '6px', border: '1px solid #e8e5dc' }}>
              <span className="badge-status badge-pending" style={{ marginBottom: '8px' }}>
                1. Pending
              </span>
              <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.6, margin: '6px 0 0' }}>
                Your report has been logged with date and geo-coordinates. It is currently in the triage queue for the ward supervisor to inspect.
              </p>
            </div>

            <div style={{ background: '#fff', padding: '18px', borderRadius: '6px', border: '1px solid #e8e5dc' }}>
              <span className="badge-status badge-in-progress" style={{ marginBottom: '8px' }}>
                2. In Progress
              </span>
              <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.6, margin: '6px 0 0' }}>
                Inspection completed. A field maintenance crew, materials, or equipment have been dispatched to resolve the street issue.
              </p>
            </div>

            <div style={{ background: '#fff', padding: '18px', borderRadius: '6px', border: '1px solid #e8e5dc' }}>
              <span className="badge-status badge-resolved" style={{ marginBottom: '8px' }}>
                3. Resolved
              </span>
              <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.6, margin: '6px 0 0' }}>
                Physical repairs are finished and signed off by the sanitary or road inspector. The issue is officially closed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)' }}>
      {/* Header */}
      <header
        style={{
          padding: '22px 7%',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#fff',
        }}
      >
        <Link href="/" className="brand">
          <span className="brand-mark"><span /></span>
          <span>fixmy<span className="brand-light">street.</span></span>
        </Link>
        <div style={{ display: 'flex', gap: '18px', alignItems: 'center' }}>
          <Link href="/report" style={{ fontSize: '13px', color: '#666' }}>
            Submit Report
          </Link>
          <Link href="/admin" style={{ fontSize: '13px', color: '#666' }}>
            Municipal Portal
          </Link>
          <Link href="/" style={{ color: '#77746d', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ArrowLeft size={14} /> Back to home
          </Link>
        </div>
      </header>

      {/* Content with Suspense for useSearchParams */}
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '80px', color: '#888' }}>Loading tracker...</div>}>
        <TrackContent />
      </Suspense>
    </main>
  );
}
