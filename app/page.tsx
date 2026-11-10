'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  ClipboardList, Clock3, LocateFixed, MapPin, Menu, MessageCircle, ShieldCheck,
  Sparkles, Trees, X, Zap, Search, Eye, AlertCircle, Camera, CheckCircle2,
  SlidersHorizontal, RefreshCw, Map as MapIcon, List, ImageIcon, AlertTriangle, Flame
} from 'lucide-react';
import ImageUploader from '@/components/ImageUploader';
import ComplaintTrackerView from '@/components/ComplaintTrackerView';

// Dynamically import Leaflet maps to avoid SSR window issues
const InteractiveIssueMap = dynamic(
  () => import('@/components/InteractiveIssueMap'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '460px', background: '#ece8de', display: 'grid', placeItems: 'center', color: '#777', borderRadius: '6px', border: '1px solid var(--line)' }}>
        <div style={{ textAlign: 'center' }}>
          <MapPin size={28} color="var(--orange)" style={{ margin: '0 auto 8px', animation: 'bouncePin 1s infinite alternate' }} />
          <span style={{ font: '11px var(--mono)', letterSpacing: '1px', display: 'block' }}>INITIALIZING OPENSTREETMAP TILES...</span>
        </div>
      </div>
    ),
  }
);

const LocationPickerMap = dynamic(
  () => import('@/components/LocationPickerMap'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '220px', background: '#ece8de', display: 'grid', placeItems: 'center', color: '#777', borderRadius: '4px' }}>
        <span style={{ font: '11px var(--mono)' }}>Loading location picker...</span>
      </div>
    ),
  }
);

import type { ComplaintRecord, ComplaintUpdate } from '@/lib/db';

type ComplaintItem = ComplaintRecord;

const categoryChoices = [
  { id: 'Road & Pavement', label: 'Road & Pavement', icon: '🚧' },
  { id: 'Waste & Cleanliness', label: 'Waste & Garbage', icon: '🗑️' },
  { id: 'Streetlights', label: 'Streetlights', icon: '💡' },
  { id: 'Drainage', label: 'Drainage & Sewers', icon: '🌊' },
  { id: 'Water Leakage', label: 'Water Leakage', icon: '💧' },
  { id: 'Other', label: 'Other Issue', icon: '📍' },
];

function Brand() {
  return (
    <Link className="brand" href="/" aria-label="FixMyStreet home">
      <span className="brand-mark"><span /></span>
      <span>fixmy<span className="brand-light">street</span></span>
    </Link>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  
  // View mode in Community section: List or Interactive Map
  const [communityViewMode, setCommunityViewMode] = useState<'map' | 'list'>('map');

  // Complaints state & filtering
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<ComplaintItem | null>(null);

  // Tracking state
  const [trackId, setTrackId] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedRecord, setTrackedRecord] = useState<ComplaintItem | null>(null);
  const [trackError, setTrackError] = useState('');

  // Report Form state
  const [reportName, setReportName] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportCat, setReportCat] = useState('Road & Pavement');
  const [reportLoc, setReportLoc] = useState('');
  const [reportCoords, setReportCoords] = useState<{ lat?: number; lng?: number }>({ lat: 31.3260, lng: 75.5762 });
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [reportUrgent, setReportUrgent] = useState(false);
  const [quickDuplicates, setQuickDuplicates] = useState<any[]>([]);
  const [dismissQuickDupWarning, setDismissQuickDupWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<ComplaintItem | null>(null);
  const [reportError, setReportError] = useState('');

  // Fetch initial complaints
  async function loadComplaints() {
    try {
      setLoadingComplaints(true);
      const res = await fetch('/api/complaints');
      if (res.ok) {
        const data = await res.json();
        setComplaints(data);
      }
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoadingComplaints(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  // Handle Complaint Tracking
  async function handleTrack(e?: React.FormEvent, customId?: string) {
    if (e) e.preventDefault();
    const query = (customId || trackId).trim();

    if (!query) {
      setTrackError('Please enter a Complaint ID or Reference number.');
      setTrackedRecord(null);
      return;
    }

    setTrackingLoading(true);
    setTrackError('');
    setTrackedRecord(null);

    try {
      const res = await fetch(`/api/complaints/${encodeURIComponent(query)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `No report found for "${query}". Check the reference ID.`);
      }
      const data = await res.json();
      setTrackedRecord(data);
      setTrackId(data.reference_id || query);
    } catch (err) {
      setTrackError(err instanceof Error ? err.message : 'Could not retrieve complaint.');
    } finally {
      setTrackingLoading(false);
    }
  }

  // Debounced duplicate detection for quick report form
  useEffect(() => {
    if (!reportLoc.trim() && !reportCoords.lat) {
      setQuickDuplicates([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/complaints/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: reportCat,
            location: reportLoc.trim(),
            latitude: reportCoords.lat,
            longitude: reportCoords.lng,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setQuickDuplicates(data.duplicates || []);
          setDismissQuickDupWarning(false);
        }
      } catch (err) {
        console.error('Error checking duplicates in quick form:', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [reportCat, reportLoc, reportCoords.lat, reportCoords.lng]);

  // Handle Location picked from Interactive Map
  function handleLocationPicked(lat: number, lng: number, placeLabel?: string) {
    setReportCoords({ lat, lng });
    if (placeLabel) {
      setReportLoc(placeLabel);
    } else if (!reportLoc) {
      setReportLoc(`Pinned location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  }

  // Handle Report Submission
  async function handleSubmitReport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setReportError('');
    setReportSuccess(null);

    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          description: reportDesc,
          category: reportCat,
          location: reportLoc,
          latitude: reportCoords.lat,
          longitude: reportCoords.lng,
          image_url: reportImage,
          priority: reportUrgent ? 'Urgent' : 'Normal',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint.');
      }

      setReportSuccess(data.complaint);
      // Reset inputs
      setReportName('');
      setReportDesc('');
      setReportLoc('');
      setReportImage(null);
      setReportUrgent(false);
      setQuickDuplicates([]);
      // Refresh complaints feed
      loadComplaints();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Something went wrong submitting your issue.');
    } finally {
      setSubmitting(false);
    }
  }

  // Stepper calculations for tracking
  const stepperStages = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];
  function getStageProgress(status?: string): number {
    if (!status) return 0;
    const s = status.toLowerCase();
    if (s.includes('resolved')) return 3;
    if (s.includes('progress')) return 2;
    if (s.includes('review') || s.includes('assigned')) return 1;
    return 0;
  }

  // Multi-criteria filtered issues list (Category, Status, Urgency, Search)
  const filteredComplaints = complaints.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      item.category.toLowerCase().includes(selectedCategory.toLowerCase());
    
    const matchesStatus =
      selectedStatus === 'All' ||
      item.status.toLowerCase() === selectedStatus.toLowerCase();

    const matchesUrgent =
      !urgentOnly ||
      (item.priority && item.priority.toLowerCase() === 'urgent');

    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.reference_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.priority && item.priority.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesStatus && matchesUrgent && matchesSearch;
  });

  const faqs = [
    ['What can I report?', 'You can report public-space issues such as potholes, damaged road surfaces, overflowing waste bins, water pipe bursts, drainage blockages, and non-functioning streetlights.'],
    ['How do interactive maps help my report?', 'With our live OpenStreetMap integration, you can click or drag directly on the map to pinpoint exact street coordinates. Field maintenance teams use these coordinates to navigate directly to the hazard.'],
    ['Can I upload photos from my smartphone?', 'Yes! You can attach photographs directly from your camera or gallery. Photos help dispatchers evaluate severity, equipment needed, and road obstruction.'],
    ['Does FixMyStreet send complaints directly to the municipality?', 'During the pilot in Jalandhar, reports are structured, assigned reference IDs, and routed to Ward supervisors and local maintenance teams.'],
  ];

  return (
    <main id="top">
      {/* Announcement Bar */}
      <div className="announcement">
        <span className="announcement-dot" /> PILOT PROJECT <span className="announcement-sep">/</span> JALANDHAR, PUNJAB <ArrowUpRight size={12} />
      </div>

      {/* Site Header */}
      <header className="site-header wrap">
        <Brand />
        <nav className={menuOpen ? 'nav nav-open' : 'nav'} aria-label="Main navigation">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#community" onClick={() => setMenuOpen(false)}>Interactive Map & Issues</a>
          <Link href="/track" onClick={() => setMenuOpen(false)}>Track Complaint</Link>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQs</a>
          <Link href="/admin" onClick={() => setMenuOpen(false)}>Municipal Portal</Link>
        </nav>
        <div className="header-actions">
          <Link className="login-link" href="/admin">
            Officer Login <ArrowUpRight size={14} />
          </Link>
          <a className="button button-dark button-small" href="#report">
            Report an issue <ArrowUpRight size={14} />
          </a>
        </div>
        <button
          className="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Hero Section with Live Map Preview */}
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEIGHBOURHOOD, YOUR VOICE</div>
          <h1>A better street<br />starts with <em>you.</em></h1>
          <p className="hero-lede">
            Spot a pothole, broken streetlight, or illegal waste dumping? Pin it on our live interactive map, upload a photo, and watch the civic resolution journey unfold.
          </p>
          <div className="hero-buttons">
            <a className="button button-orange" href="#report">
              Report a problem <ArrowUpRight size={16} />
            </a>
            <a className="text-link" href="#community">
              Explore live map <ArrowDownRight size={16} />
            </a>
          </div>
          <div className="hero-note">
            <span className="avatar-stack"><i>J</i><i>P</i><i>+</i></span>
            <span>Real-time GPS pinpoints & photos<br /><strong>for faster municipal repairs.</strong></span>
          </div>
        </div>

        {/* Hero Interactive Map */}
        <div className="hero-visual">
          <div className="visual-label">
            <span className="live-dot" /> LIVE JALANDHAR CIVIC MAP — CLICK ANY MARKER
          </div>
          <InteractiveIssueMap
            issues={complaints.slice(0, 8)}
            selectedIssue={selectedIssue}
            onSelectIssue={(issue) => setSelectedIssue(issue as ComplaintItem)}
            height="380px"
          />
          <div className="visual-caption">Real-time OpenStreetMap showing active community reports in Jalandhar.</div>
        </div>

        <div className="hero-index"><span>01</span> / A MORE CONNECTED COMMUNITY</div>
      </section>

      {/* Marquee Ticker */}
      <section className="ticker">
        <div className="ticker-inner">
          <span>NOTICE IT</span><span className="ticker-star">✳</span>
          <span>PIN IT ON MAP</span><span className="ticker-star">✳</span>
          <span>PHOTO UPLOAD</span><span className="ticker-star">✳</span>
          <span>TRACK IT</span><span className="ticker-star">✳</span>
          <span>MUNICIPAL RESOLUTION</span><span className="ticker-star">✳</span>
          <span>MAKE IT BETTER</span>
        </div>
      </section>

      {/* How it Works */}
      <section className="intro section-pad wrap" id="how-it-works">
        <div className="section-meta"><span>01 / THE IDEA</span><span>SMALL ACTION. SHARED IMPACT.</span></div>
        <div className="intro-grid">
          <h2>Good streets don't<br />happen <em>by accident.</em></h2>
          <div className="intro-text">
            <p>Every pothole, blocked drain or broken streetlight affects someone's day. But too often, complaints get lost in bureaucracy.</p>
            <p>We combine interactive satellite/street maps, verifiable photo evidence, and public reference IDs to ensure accountability from notice to fix.</p>
            <a className="text-link" href="#process">Get to know the process <ArrowUpRight size={15} /></a>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="process-section" id="process">
        <div className="wrap section-pad">
          <div className="section-meta light-meta"><span>02 / HOW IT WORKS</span><span>FOUR STEPS. ONE BETTER STREET.</span></div>
          <div className="process-heading">
            <h2>From noticed<br />to <em>sorted.</em></h2>
            <p>No complicated forms. No wondering what happened next. Just a clearer way to get local problems moving.</p>
          </div>
          <div className="steps-grid">
            <article className="step">
              <span className="step-number">01</span>
              <div className="step-icon"><MessageCircle /></div>
              <h3>Spot something?</h3>
              <p>Notice an issue in your neighbourhood? Open FixMyStreet and tell us what is going on.</p>
              <span className="step-foot">YOU KNOW YOUR STREET <ArrowUpRight size={14} /></span>
            </article>
            <article className="step">
              <span className="step-number">02</span>
              <div className="step-icon"><Camera /></div>
              <h3>Pin & Snap.</h3>
              <p>Drop a pin on our interactive map and attach a photo to show the exact hazard.</p>
              <span className="step-foot">GEO-TAGGED EVIDENCE <ArrowUpRight size={14} /></span>
            </article>
            <article className="step">
              <span className="step-number">03</span>
              <div className="step-icon"><ClipboardList /></div>
              <h3>Follow the progress.</h3>
              <p>Get a reference number (e.g. FMS-JAL-0003) and see live inspection and crew updates.</p>
              <span className="step-foot">STAY IN THE LOOP <ArrowUpRight size={14} /></span>
            </article>
            <article className="step">
              <span className="step-number">04</span>
              <div className="step-icon"><Check /></div>
              <h3>See the difference.</h3>
              <p>Check the resolution photo and note as the municipal team completes the fix.</p>
              <span className="step-foot">BETTER, TOGETHER <ArrowUpRight size={14} /></span>
            </article>
          </div>
        </div>
      </section>

      {/* Community Section — Interactive Map & List Toggle */}
      <section className="community-section section-pad wrap" id="community">
        <div className="section-meta">
          <span>03 / YOUR COMMUNITY</span>
          <span>LIVE INTERACTIVE CIVIC MAP</span>
        </div>
        
        <div className="community-heading">
          <div>
            <h2>What's happening<br />around <em>you?</em></h2>
            <p>Live, transparent civic reports logged by citizens across Jalandhar.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: '#ece8de', borderRadius: '4px', padding: '3px', border: '1px solid #dedbd0' }}>
              <button
                onClick={() => setCommunityViewMode('map')}
                style={{
                  background: communityViewMode === 'map' ? '#fff' : 'transparent',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'var(--mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: communityViewMode === 'map' ? 'var(--ink)' : '#777',
                  boxShadow: communityViewMode === 'map' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <MapIcon size={13} /> Interactive Map
              </button>
              <button
                onClick={() => setCommunityViewMode('list')}
                style={{
                  background: communityViewMode === 'list' ? '#fff' : 'transparent',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'var(--mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: communityViewMode === 'list' ? 'var(--ink)' : '#777',
                  boxShadow: communityViewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <List size={13} /> List View
              </button>
            </div>

            <button
              onClick={loadComplaints}
              className="text-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <RefreshCw size={13} style={{ display: 'inline', marginRight: 4 }} /> Refresh
            </button>
          </div>
        </div>

        {/* Multi-Criteria Filter and Search Bar */}
        <div className="community-toolbar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="community-search-bar" style={{ flex: 1, minWidth: '280px' }}>
              <Search size={16} color="#888" />
              <input
                type="text"
                placeholder="Search reports by area, issue, category, or ref ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Urgency Quick Toggle */}
            <button
              className={`filter-chip ${urgentOnly ? 'active' : ''}`}
              onClick={() => setUrgentOnly(!urgentOnly)}
              style={{
                background: urgentOnly ? '#b52b20' : '#faebea',
                color: urgentOnly ? '#fff' : '#b52b20',
                borderColor: urgentOnly ? '#b52b20' : '#f5b8b3',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Flame size={13} /> {urgentOnly ? 'Showing Urgent Only' : 'Filter: 🔥 Urgent Only'}
            </button>
          </div>

          {/* Category Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ font: '9px var(--mono)', color: '#888', letterSpacing: '0.5px' }}>CATEGORY:</span>
            {['All', 'Road & Pavement', 'Waste & Cleanliness', 'Streetlights', 'Drainage', 'Water Leakage'].map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status Chips & Active Filter Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #e8e4da', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ font: '9px var(--mono)', color: '#888', letterSpacing: '0.5px' }}>STATUS:</span>
              {['All', 'Pending', 'In Progress', 'Resolved'].map((st) => (
                <button
                  key={st}
                  className={`filter-chip ${selectedStatus === st ? 'active' : ''}`}
                  onClick={() => setSelectedStatus(st)}
                  style={{ fontSize: '10px', padding: '5px 10px' }}
                >
                  {st === 'All' ? 'All Statuses' : st}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '10px var(--mono)', color: '#777' }}>
              <span>Showing {filteredComplaints.length} of {complaints.length} issues</span>
              {(selectedCategory !== 'All' || selectedStatus !== 'All' || urgentOnly || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedCategory('All');
                    setSelectedStatus('All');
                    setUrgentOnly(false);
                    setSearchQuery('');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--orange-dark)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* View Mode: Interactive Map */}
        {communityViewMode === 'map' ? (
          <div>
            <InteractiveIssueMap
              issues={filteredComplaints}
              selectedIssue={selectedIssue}
              onSelectIssue={(issue) => setSelectedIssue(issue as ComplaintItem)}
              height="500px"
            />
            <p className="sample-note">
              Displaying {filteredComplaints.length} geo-tagged issues on OpenStreetMap. Click any marker to view photo, description, and status.
            </p>
          </div>
        ) : (
          /* View Mode: List */
          <div className="issue-list">
            {loadingComplaints ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#888' }}>
                Loading active community issues...
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: '#888' }}>
                No issues found matching current search and filter criteria.
              </div>
            ) : (
              filteredComplaints.map((issue, i) => {
                const tone =
                  issue.status === 'Resolved'
                    ? 'sage'
                    : issue.status === 'In Progress'
                    ? 'orange'
                    : 'blue';

                const isUrgent = (issue.priority || '').toLowerCase() === 'urgent';

                return (
                  <article
                    className="issue-row"
                    key={issue.id}
                    onClick={() => setSelectedIssue(issue)}
                    title="Click to view details and resolution status"
                  >
                    <span className="issue-number">0{i + 1}</span>
                    <div className={`issue-symbol ${tone}`}>
                      {issue.image_url ? (
                        <img
                          src={issue.image_url}
                          alt="Thumbnail"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px' }}
                        />
                      ) : issue.category.toLowerCase().includes('road') || issue.category.toLowerCase().includes('pothole') ? (
                        <Zap />
                      ) : issue.category.toLowerCase().includes('waste') ? (
                        <Trees />
                      ) : (
                        <Sparkles />
                      )}
                    </div>
                    <div className="issue-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span className="card-kicker" style={{ margin: 0 }}>
                          {issue.reference_id || `FMS-JAL-${String(issue.id).padStart(4, '0')}`} · {issue.category.toUpperCase()}
                        </span>
                        {isUrgent && (
                          <span className="badge-priority badge-priority-urgent" style={{ fontSize: '9px', padding: '1px 5px' }}>
                            🔥 URGENT
                          </span>
                        )}
                        {issue.duplicate_of ? (
                          <span className="badge-duplicate-child" style={{ fontSize: '9px', padding: '1px 5px' }}>
                            ⚠️ Duplicate
                          </span>
                        ) : null}
                      </div>
                      <h3>{issue.description.slice(0, 75)}{issue.description.length > 75 ? '...' : ''}</h3>
                      <span className="issue-place">
                        <MapPin size={12} /> {issue.location} · <em>Reported by {issue.name}</em>
                      </span>
                    </div>
                    <div className={`issue-status ${tone}`}>
                      <i /> {issue.status}
                    </div>
                    <span className="issue-age">
                      {new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <Eye className="issue-arrow" size={18} />
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Issue Detail Modal with Full Image Preview */}
      {selectedIssue && (
        <div className="issue-modal-backdrop" onClick={() => setSelectedIssue(null)}>
          <div className="issue-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="issue-modal-close" onClick={() => setSelectedIssue(null)}>
              <X size={20} />
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span className="tracker-id-pill">{selectedIssue.reference_id}</span>
              <span className={`badge-status badge-${selectedIssue.status.toLowerCase().replace(' ', '-')}`}>
                {selectedIssue.status}
              </span>
              {selectedIssue.priority && selectedIssue.priority.toLowerCase() === 'urgent' && (
                <span className="badge-priority badge-priority-urgent">
                  🔥 URGENT HAZARD
                </span>
              )}
              {selectedIssue.duplicate_of && (
                <span className="badge-duplicate-child">
                  ⚠️ Duplicate of {selectedIssue.master_reference_id || `FMS-JAL-${selectedIssue.duplicate_of}`}
                </span>
              )}
            </div>

            {/* Attached Photo */}
            {selectedIssue.image_url && (
              <div style={{ width: '100%', height: '220px', borderRadius: '6px', overflow: 'hidden', margin: '14px 0', border: '1px solid #dedbd0', background: '#f5f3ed' }}>
                <img
                  src={selectedIssue.image_url}
                  alt="Issue photo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <h2 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '24px', margin: '10px 0 16px' }}>
              {selectedIssue.category}: {selectedIssue.location}
            </h2>
            <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.7, marginBottom: '20px' }}>
              {selectedIssue.description}
            </p>

            <div className="tracker-details-grid">
              <div>
                <dt>REPORTED BY</dt>
                <dd>{selectedIssue.name}</dd>
              </div>
              <div>
                <dt>SUBMITTED DATE</dt>
                <dd>{new Date(selectedIssue.created_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt>LOCATION</dt>
                <dd>{selectedIssue.location}</dd>
              </div>
              <div>
                <dt>GPS COORDINATES</dt>
                <dd>
                  {selectedIssue.latitude && selectedIssue.longitude
                    ? `${selectedIssue.latitude.toFixed(4)}° N, ${selectedIssue.longitude.toFixed(4)}° E`
                    : 'Approximate area'}
                </dd>
              </div>
            </div>

            {selectedIssue.admin_notes && (
              <div className="tracker-admin-note">
                <strong>Municipal Action Note:</strong> {selectedIssue.admin_notes}
              </div>
            )}

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button
                className="button button-orange"
                onClick={() => {
                  setTrackId(selectedIssue.reference_id);
                  handleTrack(undefined, selectedIssue.reference_id);
                  setSelectedIssue(null);
                  document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Track in Tracker <ArrowDownRight size={14} />
              </button>
              <button
                className="button button-dark"
                onClick={() => setSelectedIssue(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Section with Interactive Pin-Drop Map & Image Uploader */}
      <section className="report-section section-pad wrap" id="report">
        <div className="section-meta">
          <span>REPORT AN ISSUE</span>
          <span>YOUR VOICE MATTERS</span>
        </div>

        <div className="report-card-container">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> TAKE ACTION TODAY</div>
            <h2 style={{ fontSize: 'clamp(40px, 5vw, 62px)', margin: '20px 0 16px' }}>
              Tell us what needs<br /><em>fixing.</em>
            </h2>
            <p style={{ fontSize: '14px', lineHeight: 1.8, color: '#66645b', marginBottom: '25px' }}>
              Use the interactive pin-drop map below to mark the precise spot. Attach a photo so municipal dispatchers can verify the hazard and deploy equipment immediately.
            </p>
            <div style={{ background: '#faf9f5', border: '1px solid #dedbd0', padding: '20px', borderRadius: '6px' }}>
              <strong style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>Interactive Location & Photo:</strong>
              <p style={{ fontSize: '11px', color: '#77756c', lineHeight: 1.7, margin: 0 }}>
                Dropping a pin on the map embeds exact GPS coordinates directly into the work order ticket. Uploading a photo allows the road crew to bring the right materials on the very first trip.
              </p>
            </div>
            <div style={{ marginTop: '24px' }}>
              <Link href="/report" className="text-link">
                Open dedicated full-page reporting screen <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* Clean Form Card */}
          <div className="report-form">
            {reportSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle2 size={48} color="#5a7d61" style={{ margin: '0 auto 16px' }} />
                <span className="card-kicker">REPORT RECORDED</span>
                <h3 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: '26px', margin: '8px 0 14px' }}>
                  Thank you for speaking up!
                </h3>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '18px' }}>
                  Your complaint reference number is:
                </p>
                <div style={{ background: '#f4ece4', padding: '12px', borderRadius: '4px', display: 'inline-block', font: '600 18px var(--mono)', color: 'var(--orange-dark)' }}>
                  {reportSuccess.reference_id}
                </div>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '16px' }}>
                  Our maintenance dispatch system has logged this under <strong>{reportSuccess.category}</strong>.
                </p>
                <div style={{ marginTop: '24px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    className="button button-orange"
                    onClick={() => {
                      setTrackId(reportSuccess.reference_id);
                      handleTrack(undefined, reportSuccess.reference_id);
                      document.getElementById('track')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    Track Report Now <ArrowDownRight size={14} />
                  </button>
                  <button
                    className="button button-dark"
                    onClick={() => setReportSuccess(null)}
                  >
                    Submit Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport}>
                <div className="form-field">
                  <label htmlFor="rep-name">Your Full Name</label>
                  <input
                    id="rep-name"
                    className="form-input"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    required
                    placeholder="e.g. Jasleen Kaur"
                  />
                </div>

                <div className="form-field">
                  <label>Select Issue Category</label>
                  <div className="category-selector-grid">
                    {categoryChoices.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        className={`cat-choice-btn ${reportCat === c.id ? 'selected' : ''}`}
                        onClick={() => setReportCat(c.id)}
                      >
                        <span style={{ fontSize: '16px' }}>{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location Picker Map */}
                <div className="form-field">
                  <label>Pin Location on Interactive Map</label>
                  <p className="field-hint">Click anywhere on the map or use GPS to set the exact position.</p>
                  <LocationPickerMap
                    initialLat={reportCoords.lat}
                    initialLng={reportCoords.lng}
                    onLocationSelected={handleLocationPicked}
                    height="200px"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="rep-loc">Street / Landmark Address</label>
                  <input
                    id="rep-loc"
                    className="form-input"
                    value={reportLoc}
                    onChange={(e) => setReportLoc(e.target.value)}
                    required
                    placeholder="e.g. Near Model Town Park, Link Road"
                  />
                </div>

                {/* Real-time duplicate detection warning banner */}
                {quickDuplicates.length > 0 && !dismissQuickDupWarning && (
                  <div className="duplicate-alert-box" style={{ margin: '14px 0' }}>
                    <div className="duplicate-alert-header">
                      <span className="duplicate-alert-title" style={{ fontSize: '11px' }}>
                        <AlertTriangle size={15} color="#d99214" />
                        POTENTIAL DUPLICATE DETECTED ({quickDuplicates.length} NEARBY)
                      </span>
                      <button
                        type="button"
                        onClick={() => setDismissQuickDupWarning(true)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}
                        title="Dismiss"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#6e541b', lineHeight: 1.4 }}>
                      A similar {reportCat} issue is already on file nearby:
                    </p>
                    {quickDuplicates.slice(0, 1).map((dup) => (
                      <div key={dup.id} className="duplicate-item-card" style={{ padding: '8px 10px' }}>
                        <div>
                          <strong style={{ font: '600 11px var(--mono)', color: 'var(--orange-dark)' }}>{dup.reference_id}</strong>
                          <span style={{ fontSize: '11px', color: '#555', display: 'block' }}>
                            {dup.location} · <em>Status: {dup.status}</em>
                          </span>
                        </div>
                        <Link
                          href={`/track?id=${encodeURIComponent(dup.reference_id)}`}
                          target="_blank"
                          style={{ font: '600 10px var(--mono)', color: 'var(--orange-dark)', display: 'flex', alignItems: 'center', gap: '3px' }}
                        >
                          Track Issue <ArrowUpRight size={11} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {/* Urgency Hazard Toggle */}
                <div className="form-field">
                  <div
                    className={`urgency-toggle-card ${reportUrgent ? 'is-urgent' : ''}`}
                    onClick={() => setReportUrgent(!reportUrgent)}
                    style={{ padding: '12px' }}
                  >
                    <input
                      type="checkbox"
                      checked={reportUrgent}
                      onChange={(e) => setReportUrgent(e.target.checked)}
                      style={{ marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <strong style={{ fontSize: '12px', color: reportUrgent ? '#b52b20' : 'var(--ink)' }}>
                          {reportUrgent ? '🔥 Urgent Public Hazard (Life/Safety Risk)' : 'Mark as Urgent Safety Hazard'}
                        </strong>
                        {reportUrgent && <span className="badge-priority badge-priority-urgent" style={{ fontSize: '8px', padding: '1px 5px' }}>URGENT</span>}
                      </div>
                      <span style={{ fontSize: '10px', color: '#888', display: 'block', marginTop: '2px' }}>
                        For open live wires, missing manhole covers, deep road cave-ins.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="rep-desc">Describe the Problem</label>
                  <textarea
                    id="rep-desc"
                    className="form-textarea"
                    rows={3}
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    required
                    placeholder="Describe severity, hazards, or landmark details..."
                  />
                </div>

                {/* Real Image Uploader */}
                <div className="form-field">
                  <label>Attach Photograph</label>
                  <ImageUploader
                    currentImageUrl={reportImage}
                    onImageUploaded={(url) => setReportImage(url)}
                  />
                </div>

                {reportError && (
                  <div style={{ color: '#b34235', fontSize: '12px', marginBottom: '14px' }}>
                    <AlertCircle size={14} style={{ display: 'inline', marginRight: 4 }} /> {reportError}
                  </div>
                )}

                <button
                  type="submit"
                  className="button button-orange"
                  style={{ width: '100%', cursor: submitting ? 'wait' : 'pointer' }}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting Report...' : 'Submit Complaint'} <ArrowUpRight size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Live Complaint Tracker Section */}
      <section className="track-section" id="track">
        <div className="wrap track-inner">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> LIVE CIVIC STATUS TRACKER</div>
            <h2>Know where<br />things <em>stand.</em></h2>
            <p>
              Every report receives a unique complaint ID. Follow the real-time journey through <strong>Pending ➔ In Progress ➔ Resolved</strong> with chronological dispatch notes and date of submission.
            </p>
            <div style={{ margin: '14px 0' }}>
              <Link href="/track" className="text-link" style={{ fontSize: '12px' }}>
                Open Dedicated Tracking Portal & Share Links <ArrowUpRight size={13} />
              </Link>
            </div>
            <div className="demo-pills">
              <span style={{ font: '9px var(--mono)', color: '#888' }}>TRY DEMO IDS:</span>
              <button className="demo-pill-btn" onClick={() => { setTrackId('FMS-JAL-0003'); handleTrack(undefined, 'FMS-JAL-0003'); }}>
                FMS-JAL-0003 (In Progress)
              </button>
              <button className="demo-pill-btn" onClick={() => { setTrackId('FMS-JAL-0004'); handleTrack(undefined, 'FMS-JAL-0004'); }}>
                FMS-JAL-0004 (Pending)
              </button>
              <button className="demo-pill-btn" onClick={() => { setTrackId('FMS-JAL-0006'); handleTrack(undefined, 'FMS-JAL-0006'); }}>
                FMS-JAL-0006 (Resolved)
              </button>
            </div>
          </div>

          <form className="track-card" onSubmit={handleTrack}>
            <div className="track-card-icon"><Clock3 /></div>
            <span className="card-kicker">COMPLAINT TRACKER</span>
            <h3>Got a report ID?</h3>
            <p>Enter your reference number (e.g. FMS-JAL-0003 or #1) to verify progress.</p>
            
            <label htmlFor="track-id">YOUR REFERENCE NUMBER</label>
            <div className="track-input">
              <input
                id="track-id"
                value={trackId}
                onChange={(e) => {
                  setTrackId(e.target.value);
                  setTrackError('');
                }}
                placeholder="e.g. FMS-JAL-0003"
              />
              <button type="submit" aria-label="Check complaint" disabled={trackingLoading}>
                {trackingLoading ? '...' : <ArrowUpRight size={19} />}
              </button>
            </div>

            {trackError && <span className="track-message" role="status">{trackError}</span>}

            {/* Live Complaint Tracking Result View */}
            {trackedRecord && (
              <div style={{ marginTop: '24px' }}>
                <ComplaintTrackerView complaint={trackedRecord} />
              </div>
            )}

            <span className="track-secure">
              <ShieldCheck size={13} /> Your report details stay protected under Jalandhar Civic Services.
            </span>
          </form>
        </div>
      </section>

      {/* Values Section */}
      <section className="values-section section-pad wrap">
        <div className="section-meta"><span>04 / WHAT WE BELIEVE</span><span>BUILT ON TRUST</span></div>
        <div className="values-grid">
          <h2>Better systems.<br /><em>Better streets.</em></h2>
          <div className="value-card">
            <span>01</span>
            <ShieldCheck />
            <h3>Transparency matters.</h3>
            <p>Clear, unedited updates help citizens understand exactly when and how their complaints get solved.</p>
          </div>
          <div className="value-card">
            <span>02</span>
            <MapPin />
            <h3>Local knowledge counts.</h3>
            <p>The residents living on each lane are the first and most qualified observers of neighbourhood safety.</p>
          </div>
          <div className="value-card">
            <span>03</span>
            <CircleHelp />
            <h3>Every report has a voice.</h3>
            <p>A simple, zero-friction interface ensures all citizens—regardless of digital experience—can participate.</p>
          </div>
        </div>
      </section>

      {/* FAQs Section */}
      <section className="faq-section section-pad" id="faq">
        <div className="wrap faq-grid">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> A FEW THINGS YOU MIGHT WONDER</div>
            <h2>Good questions.<br /><em>Honest answers.</em></h2>
            <p>Something else on your mind? We would love to hear from you.</p>
            <a className="text-link" href="mailto:hello@fixmystreet.example">Get in touch <ArrowUpRight size={15} /></a>
          </div>
          <div className="faq-list">
            {faqs.map(([q, a], i) => (
              <article className={`faq-item ${faqOpen === i ? 'faq-active' : ''}`} key={q}>
                <button
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  aria-expanded={faqOpen === i}
                >
                  <span>{q}</span>
                  <ChevronDown size={18} />
                </button>
                {faqOpen === i && <p>{a}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section wrap" id="get-started">
        <div className="cta-pattern" />
        <div className="cta-content">
          <span className="cta-kicker"><span /> JALANDHAR PILOT</span>
          <h2>Your street.<br />Your say. <em>Let's fix it.</em></h2>
          <p>Change starts when someone speaks up. Be that someone.</p>
          <a className="button button-light" href="#report">
            Report an issue now <ArrowUpRight size={16} />
          </a>
          <span className="cta-small">Live community civic engagement · Jalandhar, Punjab</span>
        </div>
        <div className="cta-side-note">
          A LITTLE CARE<br />GOES A LONG WAY <ArrowDownRight size={17} />
        </div>
      </section>

      {/* Footer */}
      <footer className="footer wrap">
        <div className="footer-top">
          <div>
            <Brand />
            <p>A clearer way to care for the<br />places we call home.</p>
          </div>
          <div className="footer-links">
            <div>
              <span>EXPLORE</span>
              <a href="#how-it-works">How it works</a>
              <a href="#community">Community Issues</a>
              <a href="#track">Track a Report</a>
              <a href="#faq">FAQs</a>
            </div>
            <div>
              <span>PORTALS</span>
              <a href="#report">Report Issue</a>
              <Link href="/report">Full Report Page</Link>
              <Link href="/admin">Municipal Portal</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 FIXMYSTREET. COMMUNITY CIVIC REPORTING INITIATIVE.</span>
          <span>JALANDHAR, PUNJAB <MapPin size={12} /></span>
          <a href="#top">BACK TO TOP ↑</a>
        </div>
      </footer>
    </main>
  );
}
