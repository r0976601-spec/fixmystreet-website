'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Clock, Filter,
  Layers, MapPin, RefreshCw, Search, ShieldCheck, AlertCircle,
  Edit3, Trash2, X, Building2, User, Eye, AlertTriangle, Check,
  Flame, Copy, GitMerge, CheckCheck, Undo2
} from 'lucide-react';
import { MUNICIPAL_DEPARTMENTS, COMPLAINT_CATEGORIES, PRIORITY_LEVELS } from '@/lib/constants';
import type { ComplaintRecord, DuplicateMatch } from '@/lib/db';

interface StatsData {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  urgent: number;
  duplicates: number;
  active: number;
}

export default function AdminPortal() {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Multi-Criteria Filters
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterDept, setFilterDept] = useState<string>('All');
  const [filterCat, setFilterCat] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterDuplicate, setFilterDuplicate] = useState<'all' | 'duplicates_only' | 'originals_only'>('all');
  const [search, setSearch] = useState('');
  
  // Triage & Update modal
  const [editingItem, setEditingItem] = useState<ComplaintRecord | null>(null);
  const [newStatus, setNewStatus] = useState<'Pending' | 'In Progress' | 'Resolved'>('In Progress');
  const [selectedDept, setSelectedDept] = useState<string>('Roads & Pavement Department');
  const [selectedPriority, setSelectedPriority] = useState<string>('Normal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Duplicate Management modal
  const [duplicateModalItem, setDuplicateModalItem] = useState<ComplaintRecord | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateMatch[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<string>('');
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [processingDuplicate, setProcessingDuplicate] = useState(false);

  // Delete Spam / Duplicate modal
  const [deletingItem, setDeletingItem] = useState<ComplaintRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>('Spam or fraudulent submission');
  const [isDeleting, setIsDeleting] = useState(false);

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Feedback toast message
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4500);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [resComplaints, resStats] = await Promise.all([
        fetch('/api/complaints'),
        fetch('/api/stats')
      ]);

      if (resComplaints.ok) {
        const data = await resComplaints.json();
        setComplaints(data);
      }

      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
      showToast('Failed to connect to municipal database', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Update complaint status, department, and priority
  async function handleUpdateStatusAndDept(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/complaints/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          department: selectedDept,
          priority: selectedPriority,
          admin_notes: notes,
          author: 'Municipal Operations',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update complaint');
      }

      showToast(`Complaint ${editingItem.reference_id} updated: Status = ${newStatus}, Priority = ${selectedPriority}`);
      setEditingItem(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error updating complaint', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Open Duplicate Management Modal
  async function openDuplicateModal(item: ComplaintRecord) {
    setDuplicateModalItem(item);
    setSelectedMasterId('');
    setLoadingDuplicates(true);

    try {
      const res = await fetch('/api/complaints/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: item.category,
          location: item.location,
          latitude: item.latitude,
          longitude: item.longitude,
          excludeId: item.id,
          thresholdMeters: 500,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDuplicateCandidates(data.duplicates || []);
        if (data.duplicates && data.duplicates.length > 0) {
          setSelectedMasterId(String(data.duplicates[0].id));
        }
      }
    } catch (err) {
      console.error('Failed to check duplicate candidates:', err);
    } finally {
      setLoadingDuplicates(false);
    }
  }

  // Mark complaint as duplicate
  async function handleMarkAsDuplicate(masterIdToUse?: string) {
    if (!duplicateModalItem) return;
    const targetMasterId = masterIdToUse || selectedMasterId;

    if (!targetMasterId) {
      showToast('Please select or specify a master complaint to merge into.', 'error');
      return;
    }

    setProcessingDuplicate(true);
    try {
      const res = await fetch(`/api/complaints/${duplicateModalItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_duplicate',
          master_id: targetMasterId,
          author: 'Municipal Triage Officer',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark as duplicate');
      }

      showToast(`Complaint ${duplicateModalItem.reference_id} merged as duplicate into master ticket.`);
      setDuplicateModalItem(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error merging duplicate', 'error');
    } finally {
      setProcessingDuplicate(false);
    }
  }

  // Unmark complaint duplicate
  async function handleUnmarkDuplicate(id: number) {
    try {
      const res = await fetch(`/api/complaints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unmark_duplicate',
          author: 'Municipal Triage Officer',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unmark duplicate');
      }

      showToast(`Complaint unmarked as duplicate and restored as an independent ticket.`);
      setDuplicateModalItem(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error unmarking duplicate', 'error');
    }
  }

  // Delete spam or duplicate complaint
  async function handleDeleteComplaint(e: React.FormEvent) {
    e.preventDefault();
    if (!deletingItem) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/complaints/${deletingItem.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete complaint');
      }

      showToast(`Complaint ${deletingItem.reference_id} permanently removed (${deleteReason})`);
      setDeletingItem(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error deleting complaint', 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  function resetAllFilters() {
    setFilterStatus('All');
    setFilterDept('All');
    setFilterCat('All');
    setFilterPriority('All');
    setFilterDuplicate('all');
    setSearch('');
  }

  const hasActiveFilters =
    filterStatus !== 'All' ||
    filterDept !== 'All' ||
    filterCat !== 'All' ||
    filterPriority !== 'All' ||
    filterDuplicate !== 'all' ||
    search.trim().length > 0;

  // Filter complaints
  const filtered = complaints.filter((c) => {
    const matchesStatus =
      filterStatus === 'All' || c.status.toLowerCase() === filterStatus.toLowerCase();
    
    const matchesDept =
      filterDept === 'All' ||
      (c.assigned_department || 'Unassigned').toLowerCase() === filterDept.toLowerCase();

    const matchesCat =
      filterCat === 'All' ||
      c.category.toLowerCase().includes(filterCat.toLowerCase());

    const matchesPriority =
      filterPriority === 'All' ||
      (c.priority || 'Normal').toLowerCase() === filterPriority.toLowerCase();

    const matchesDuplicate =
      filterDuplicate === 'all' ||
      (filterDuplicate === 'duplicates_only' && c.duplicate_of != null && c.duplicate_of > 0) ||
      (filterDuplicate === 'originals_only' && (!c.duplicate_of || c.duplicate_of === 0));

    const matchesSearch =
      !search ||
      c.reference_id.toLowerCase().includes(search.toLowerCase()) ||
      c.location.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      (c.assigned_department || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.priority || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.admin_notes || '').toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesDept && matchesCat && matchesPriority && matchesDuplicate && matchesSearch;
  });

  return (
    <div className="admin-shell">
      {/* Header */}
      <header className="admin-header">
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" className="brand">
              <span className="brand-mark"><span /></span>
              <span>fixmy<span className="brand-light">street</span></span>
            </Link>
            <span style={{ font: '9px var(--mono)', background: '#25251f', color: '#fff', padding: '3px 8px', borderRadius: '3px', letterSpacing: '1px' }}>
              MUNICIPAL OPERATIONS DASHBOARD
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/track" style={{ fontSize: '13px', color: '#555' }}>
              Citizen Tracker
            </Link>
            <button
              onClick={loadData}
              className="btn-detect-loc"
              style={{ padding: '8px 12px' }}
              title="Refresh Records"
            >
              <RefreshCw size={13} /> Refresh Data
            </button>
            <Link href="/" style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <ArrowLeft size={14} /> Back to public site
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ paddingTop: '24px' }}>
        {/* Title & Description */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ font: '10px var(--mono)', color: 'var(--orange-dark)', letterSpacing: '1.5px' }}>
              CENTRAL WORK ORDER CONTROL
            </span>
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: '34px', margin: '4px 0 0' }}>
              Complaints Management
            </h1>
          </div>
          <p style={{ color: '#777', fontSize: '13px', margin: 0, maxWidth: '520px', textAlign: 'right' }}>
            Identify repeated complaints via spatial duplicate detection, triage urgent hazards, assign departments, and track live resolution metrics.
          </p>
        </div>

        {/* Feedback Alert Toast */}
        {feedback && (
          <div
            style={{
              marginTop: '16px',
              background: feedback.type === 'success' ? '#eaf2eb' : '#fceeed',
              border: `1px solid ${feedback.type === 'success' ? '#c2dec6' : '#f2c7c4'}`,
              color: feedback.type === 'success' ? '#35693f' : '#b34235',
              padding: '12px 18px',
              borderRadius: '6px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* KPI Metrics with Priority & Duplicate counts */}
        {stats && (
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <div className="kpi-card">
              <div className="kpi-label">TOTAL COMPLAINTS</div>
              <div className="kpi-num">{stats.total}</div>
            </div>
            
            {/* Urgent Priority KPI */}
            <div className="kpi-card kpi-urgent">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b52b20' }}>
                <Flame size={12} /> URGENT HAZARDS
              </div>
              <div className="kpi-num" style={{ color: '#b52b20' }}>
                {stats.urgent}
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">PENDING TRIAGE</div>
              <div className="kpi-num" style={{ color: '#8a6519' }}>
                {stats.pending}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">IN ACTIVE REPAIR</div>
              <div className="kpi-num" style={{ color: 'var(--orange-dark)' }}>
                {stats.inProgress}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">RESOLVED ISSUES</div>
              <div className="kpi-num" style={{ color: '#457952' }}>
                {stats.resolved}
              </div>
            </div>

            {/* Merged Duplicates KPI */}
            <div className="kpi-card">
              <div className="kpi-label">MERGED DUPLICATES</div>
              <div className="kpi-num" style={{ color: '#6c6553' }}>
                {stats.duplicates}
              </div>
            </div>
          </div>
        )}

        {/* Multi-Criteria Controls: Status, Category, Priority, Department, Duplicates, and Search */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '6px', padding: '18px', margin: '20px 0 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Row 1: Search & Filter Summary */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div className="community-search-bar" style={{ maxWidth: '420px', flex: 1, padding: '8px 12px' }}>
              <Search size={14} color="#888" />
              <input
                type="text"
                placeholder="Search reference, citizen, location, department, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', font: '11px var(--mono)', color: '#777' }}>
              <span>Showing <strong>{filtered.length}</strong> of {complaints.length} work orders</span>
              {hasActiveFilters && (
                <button
                  onClick={resetAllFilters}
                  style={{
                    background: '#f2eee6',
                    border: '1px solid #dcd7ca',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px',
                    color: 'var(--orange-dark)',
                    fontWeight: 600,
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Status & Priority Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderTop: '1px solid #f2eee8', paddingTop: '12px' }}>
            {/* Status Filter */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ font: '10px var(--mono)', color: '#888' }}>STATUS:</span>
              {['All', 'Pending', 'In Progress', 'Resolved'].map((st) => (
                <button
                  key={st}
                  className={`filter-chip ${filterStatus === st ? 'active' : ''}`}
                  onClick={() => setFilterStatus(st)}
                  style={{ fontSize: '11px', padding: '5px 10px' }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ font: '10px var(--mono)', color: '#888', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Flame size={12} /> PRIORITY:
              </span>
              <button
                className={`filter-chip ${filterPriority === 'All' ? 'active' : ''}`}
                onClick={() => setFilterPriority('All')}
                style={{ fontSize: '11px', padding: '5px 10px' }}
              >
                All
              </button>
              <button
                className={`filter-chip ${filterPriority === 'Urgent' ? 'active' : ''}`}
                onClick={() => setFilterPriority('Urgent')}
                style={{
                  fontSize: '11px',
                  padding: '5px 10px',
                  background: filterPriority === 'Urgent' ? '#b52b20' : '#faebea',
                  color: filterPriority === 'Urgent' ? '#fff' : '#b52b20',
                  borderColor: '#f5b8b3',
                  fontWeight: 600,
                }}
              >
                🔥 Urgent
              </button>
              {['High', 'Normal', 'Low'].map((pr) => (
                <button
                  key={pr}
                  className={`filter-chip ${filterPriority === pr ? 'active' : ''}`}
                  onClick={() => setFilterPriority(pr)}
                  style={{ fontSize: '11px', padding: '5px 10px' }}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>

          {/* Row 3: Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', borderTop: '1px solid #f2eee8', paddingTop: '10px' }}>
            <span style={{ font: '10px var(--mono)', color: '#888' }}>CATEGORY:</span>
            <button
              className={`filter-chip ${filterCat === 'All' ? 'active' : ''}`}
              onClick={() => setFilterCat('All')}
              style={{ fontSize: '11px', padding: '4px 9px' }}
            >
              All Categories
            </button>
            {COMPLAINT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`filter-chip ${filterCat === cat ? 'active' : ''}`}
                onClick={() => setFilterCat(cat)}
                style={{ fontSize: '11px', padding: '4px 9px' }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Row 4: Department & Duplicates Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f2eee8', paddingTop: '10px' }}>
            {/* Department */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ font: '10px var(--mono)', color: '#888', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Building2 size={12} /> DEPT:
              </span>
              <button
                className={`filter-chip ${filterDept === 'All' ? 'active' : ''}`}
                onClick={() => setFilterDept('All')}
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                All Departments
              </button>
              {MUNICIPAL_DEPARTMENTS.map((dept) => (
                <button
                  key={dept}
                  className={`filter-chip ${filterDept === dept ? 'active' : ''}`}
                  onClick={() => setFilterDept(dept)}
                  style={{ fontSize: '10px', padding: '4px 8px' }}
                >
                  {dept.replace(' Department', '').replace(' Division', '').replace(' Board', '')}
                </button>
              ))}
            </div>

            {/* Duplicates Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ font: '10px var(--mono)', color: '#888' }}>DUPLICATES:</span>
              <button
                className={`filter-chip ${filterDuplicate === 'all' ? 'active' : ''}`}
                onClick={() => setFilterDuplicate('all')}
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                All
              </button>
              <button
                className={`filter-chip ${filterDuplicate === 'duplicates_only' ? 'active' : ''}`}
                onClick={() => setFilterDuplicate('duplicates_only')}
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                ⚠️ Duplicates Only
              </button>
              <button
                className={`filter-chip ${filterDuplicate === 'originals_only' ? 'active' : ''}`}
                onClick={() => setFilterDuplicate('originals_only')}
                style={{ fontSize: '10px', padding: '4px 8px' }}
              >
                Originals Only
              </button>
            </div>
          </div>
        </div>

        {/* Complaints Data Table */}
        <div className="admin-table-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>REF ID</th>
                <th>PHOTO</th>
                <th>CATEGORY & LOCATION</th>
                <th>PRIORITY</th>
                <th>ASSIGNED DEPT</th>
                <th>STATUS</th>
                <th>OFFICIAL NOTE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    <RefreshCw size={20} className="spin-animate" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading municipal complaints...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    No complaints matching filters. (Try clearing search or resetting filters)
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isUrgent = (item.priority || '').toLowerCase() === 'urgent';
                  const isHigh = (item.priority || '').toLowerCase() === 'high';
                  const isLow = (item.priority || '').toLowerCase() === 'low';

                  return (
                    <tr key={item.id} style={{ background: isUrgent ? '#fffdfb' : undefined }}>
                      {/* Unique Reference ID */}
                      <td>
                        <Link
                          href={`/track?id=${encodeURIComponent(item.reference_id)}`}
                          style={{ font: '600 12px var(--mono)', color: 'var(--orange-dark)', display: 'block' }}
                          title="Click to view citizen tracking timeline"
                        >
                          {item.reference_id} ↗
                        </Link>
                        <span style={{ fontSize: '10px', color: '#888', display: 'block', marginTop: '2px' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        
                        {/* Merged master count badge */}
                        {(item.duplicate_count || 0) > 0 && (
                          <span className="badge-merged-master" style={{ marginTop: '4px' }}>
                            📎 {item.duplicate_count} merged
                          </span>
                        )}
                      </td>

                      {/* Photo Thumbnail */}
                      <td>
                        {item.image_url ? (
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              border: '1px solid #dedbd0',
                              cursor: 'pointer',
                              position: 'relative',
                            }}
                            onClick={() => setPreviewImage(item.image_url!)}
                            title="Click to enlarge photo"
                          >
                            <img
                              src={item.image_url}
                              alt="Evidence"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '4px',
                              background: '#f0ede5',
                              display: 'grid',
                              placeItems: 'center',
                              color: '#aaa',
                              fontSize: '9px',
                              fontFamily: 'var(--mono)',
                            }}
                          >
                            NO PHOTO
                          </div>
                        )}
                      </td>

                      {/* Category & Location & Duplicate Flags */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '13px' }}>{item.category}</strong>
                          
                          {/* Duplicate of badge */}
                          {item.duplicate_of && (
                            <span className="badge-duplicate-child" title={`Consolidated with master ticket ${item.master_reference_id}`}>
                              ⚠️ Duplicate of {item.master_reference_id}
                            </span>
                          )}
                        </div>

                        <span style={{ fontSize: '11px', color: '#555', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                          <MapPin size={11} color="var(--orange)" /> {item.location}
                        </span>

                        {item.latitude && item.longitude && (
                          <span style={{ fontSize: '10px', color: '#457952', fontFamily: 'var(--mono)', display: 'block', marginTop: '2px' }}>
                            {item.latitude.toFixed(4)}° N, {item.longitude.toFixed(4)}° E
                          </span>
                        )}

                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#777', maxWidth: '280px', lineHeight: 1.4 }}>
                          {item.description}
                        </p>

                        <span style={{ fontSize: '10px', color: '#888', marginTop: '3px', display: 'block' }}>
                          Citizen: <strong>{item.name}</strong>
                        </span>
                      </td>

                      {/* Priority Badge */}
                      <td>
                        {isUrgent ? (
                          <span className="badge-priority badge-priority-urgent">
                            🔥 URGENT
                          </span>
                        ) : isHigh ? (
                          <span className="badge-priority badge-priority-high">
                            HIGH
                          </span>
                        ) : isLow ? (
                          <span className="badge-priority badge-priority-low">
                            LOW
                          </span>
                        ) : (
                          <span className="badge-priority badge-priority-normal">
                            NORMAL
                          </span>
                        )}
                      </td>

                      {/* Assigned Department */}
                      <td>
                        <span
                          style={{
                            font: '10px var(--mono)',
                            background: item.assigned_department && item.assigned_department !== 'Unassigned' ? '#eef2f6' : '#f5f3ed',
                            color: item.assigned_department && item.assigned_department !== 'Unassigned' ? '#254e70' : '#888',
                            border: '1px solid #d8d4c7',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'inline-block',
                            maxWidth: '170px',
                            lineHeight: 1.3,
                          }}
                        >
                          {item.assigned_department || 'Unassigned'}
                        </span>
                      </td>

                      {/* Status Pill */}
                      <td>
                        <span className={`badge-status badge-${item.status.toLowerCase().replace(' ', '-')}`}>
                          {item.status}
                        </span>
                      </td>

                      {/* Latest Official Note */}
                      <td>
                        {item.admin_notes ? (
                          <span style={{ fontSize: '11px', color: '#333', lineHeight: 1.4, display: 'block', maxWidth: '200px' }}>
                            {item.admin_notes}
                          </span>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic' }}>
                            No update note logged
                          </span>
                        )}
                      </td>

                      {/* Actions: Triage, Duplicate Management, Delete */}
                      <td>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          {/* 1. Triage Status, Dept & Priority */}
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setNewStatus(item.status);
                              setSelectedDept(item.assigned_department || 'Roads & Pavement Department');
                              setSelectedPriority(item.priority || 'Normal');
                              setNotes(item.admin_notes || '');
                            }}
                            style={{
                              background: '#fff',
                              border: '1px solid #dedbd0',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontFamily: 'var(--mono)',
                              color: 'var(--ink)',
                            }}
                            title="Triage Status, Dept & Priority"
                          >
                            <Edit3 size={11} color="var(--orange)" /> Triage
                          </button>

                          {/* 2. Duplicate Detection & Merge Action */}
                          <button
                            onClick={() => openDuplicateModal(item)}
                            style={{
                              background: item.duplicate_of ? '#fdf6e7' : '#fff',
                              border: `1px solid ${item.duplicate_of ? '#f0d38d' : '#dedbd0'}`,
                              padding: '5px 7px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '11px',
                              fontFamily: 'var(--mono)',
                              color: item.duplicate_of ? '#8c5b05' : '#555',
                            }}
                            title="Duplicate Management & Merge"
                          >
                            <GitMerge size={12} color={item.duplicate_of ? '#d99214' : '#666'} />
                          </button>

                          {/* 3. Delete Spam / Fraud */}
                          <button
                            onClick={() => {
                              setDeletingItem(item);
                              setDeleteReason('Spam or fraudulent submission');
                            }}
                            style={{
                              background: '#fff',
                              border: '1px solid #f2c7c4',
                              padding: '5px 7px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#b34235',
                            }}
                            title="Delete Spam / Duplicate"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* 1. Modal: Triage Status, Priority & Department */}
      {editingItem && (
        <div className="issue-modal-backdrop" onClick={() => setEditingItem(null)}>
          <div className="issue-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="issue-modal-close" onClick={() => setEditingItem(null)}>
              <X size={20} />
            </button>
            <span className="tracker-id-pill">{editingItem.reference_id}</span>

            {editingItem.image_url && (
              <div style={{ width: '100%', height: '140px', borderRadius: '4px', overflow: 'hidden', margin: '12px 0', border: '1px solid #dedbd0' }}>
                <img src={editingItem.image_url} alt="Work order evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '8px 0 4px' }}>
              Triage & Update Complaint
            </h2>
            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 20px' }}>
              {editingItem.category} at {editingItem.location} (Reported by {editingItem.name})
            </p>

            <form onSubmit={handleUpdateStatusAndDept}>
              {/* Status Selector: Pending / In Progress / Resolved */}
              <div className="form-field">
                <label>01. Update Complaint Status</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {(['Pending', 'In Progress', 'Resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`cat-choice-btn ${newStatus === st ? 'selected' : ''}`}
                      onClick={() => setNewStatus(st)}
                      style={{ textAlign: 'center', padding: '12px 8px' }}
                    >
                      <strong style={{ fontSize: '12px' }}>{st}</strong>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Selector: Urgent / High / Normal / Low */}
              <div className="form-field">
                <label>02. Set Priority Level</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'Urgent', label: '🔥 Urgent', color: '#b52b20', bg: '#faebea' },
                    { id: 'High', label: 'High', color: '#b85b24', bg: '#fcf1e8' },
                    { id: 'Normal', label: 'Normal', color: '#5c5950', bg: '#f2eee6' },
                    { id: 'Low', label: 'Low', color: '#8c897f', bg: '#f6f5f0' },
                  ].map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => setSelectedPriority(pr.id)}
                      style={{
                        padding: '10px 6px',
                        borderRadius: '4px',
                        border: selectedPriority === pr.id ? `2px solid ${pr.color}` : '1px solid #dedbd0',
                        background: selectedPriority === pr.id ? pr.bg : '#fff',
                        cursor: 'pointer',
                        textAlign: 'center',
                        fontWeight: selectedPriority === pr.id ? 700 : 500,
                        color: selectedPriority === pr.id ? pr.color : '#444',
                        fontFamily: 'var(--mono)',
                        fontSize: '11px',
                      }}
                    >
                      {pr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department Assignment */}
              <div className="form-field">
                <label htmlFor="dept-select">03. Assign to Municipal Department</label>
                <select
                  id="dept-select"
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  style={{ background: '#fff' }}
                >
                  {MUNICIPAL_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#888', display: 'block', marginTop: '4px' }}>
                  Routes tickets to ward field crews and logs assignment in citizen timeline.
                </span>
              </div>

              {/* Official Status Update Note */}
              <div className="form-field">
                <label htmlFor="modal-notes">04. Official Resolution Note (Logged to Citizen Timeline)</label>
                <textarea
                  id="modal-notes"
                  className="form-textarea"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Ward 14 asphalt repair crew dispatched. Patching scheduled for 2:00 PM."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  type="submit"
                  className="button button-orange"
                  style={{ flex: 1 }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save & Publish Update'}
                </button>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Duplicate Detection & Merge Management */}
      {duplicateModalItem && (
        <div className="issue-modal-backdrop" onClick={() => setDuplicateModalItem(null)}>
          <div className="issue-modal-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <button className="issue-modal-close" onClick={() => setDuplicateModalItem(null)}>
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8c5b05', marginBottom: '8px' }}>
              <GitMerge size={20} />
              <strong style={{ font: '11px var(--mono)', letterSpacing: '1px' }}>DUPLICATE DETECTION & MERGE</strong>
            </div>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '4px 0 6px' }}>
              Manage {duplicateModalItem.reference_id}
            </h2>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.5, margin: '0 0 16px' }}>
              {duplicateModalItem.category} at <strong>{duplicateModalItem.location}</strong>
            </p>

            {/* If already marked as duplicate */}
            {duplicateModalItem.duplicate_of ? (
              <div style={{ background: '#fffcf4', border: '1px solid #f3d489', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <AlertTriangle size={16} color="#d99214" />
                  <strong style={{ font: '12px var(--mono)', color: '#8c5b05' }}>
                    Currently Merged as Duplicate of {duplicateModalItem.master_reference_id}
                  </strong>
                </div>
                <p style={{ fontSize: '12px', color: '#685121', margin: '0 0 14px' }}>
                  Field work and resolution updates for this complaint are linked to the master complaint.
                </p>
                <button
                  type="button"
                  onClick={() => handleUnmarkDuplicate(duplicateModalItem.id)}
                  style={{
                    background: '#fff',
                    border: '1px solid #d99214',
                    color: '#8c5b05',
                    padding: '8px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    font: '600 11px var(--mono)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Undo2 size={13} /> Unmark Duplicate & Reopen as Independent Ticket
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 10px' }}>
                  Detected Duplicate Candidates in Proximity:
                </h3>

                {loadingDuplicates ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#888', font: '12px var(--mono)' }}>
                    Scanning spatial index for matching complaints...
                  </div>
                ) : duplicateCandidates.length === 0 ? (
                  <div style={{ padding: '18px', background: '#faf8f4', border: '1px solid #e5e1d7', borderRadius: '6px', color: '#666', fontSize: '12px', marginBottom: '20px' }}>
                    ✓ No spatial or keyword duplicate complaints detected within 500m radius.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {duplicateCandidates.map((cand) => (
                      <div
                        key={cand.id}
                        style={{
                          background: selectedMasterId === String(cand.id) ? '#fffaf0' : '#fff',
                          border: selectedMasterId === String(cand.id) ? '2px solid #d99214' : '1px solid #dedbd0',
                          borderRadius: '6px',
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                        onClick={() => setSelectedMasterId(String(cand.id))}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ font: '600 12px var(--mono)', color: 'var(--orange-dark)' }}>
                              {cand.reference_id}
                            </strong>
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{cand.category}</span>
                            <span style={{ font: '9px var(--mono)', background: '#f5efe1', color: '#8c5b05', padding: '2px 6px', borderRadius: '3px' }}>
                              {cand.matchReason}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#666', display: 'block', marginTop: '3px' }}>
                            📍 {cand.location} · Status: <strong>{cand.status}</strong> · Citizen: {cand.name}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsDuplicate(String(cand.id));
                          }}
                          className="button button-orange button-small"
                          style={{ fontSize: '11px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                          disabled={processingDuplicate}
                        >
                          Merge into this Master
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual Master Ref Selection */}
                <div className="form-field" style={{ borderTop: '1px solid #eee', paddingTop: '16px' }}>
                  <label htmlFor="manual-master">Or Manually Enter Master Complaint ID to Merge Into</label>
                  <input
                    id="manual-master"
                    className="form-input"
                    value={selectedMasterId}
                    onChange={(e) => setSelectedMasterId(e.target.value)}
                    placeholder="e.g. 3 or FMS-JAL-0003"
                  />
                  <span style={{ fontSize: '11px', color: '#888', display: 'block', marginTop: '4px' }}>
                    Consolidates this ticket as a duplicate under the specified master work order.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="button button-orange"
                    style={{ flex: 1 }}
                    onClick={() => handleMarkAsDuplicate()}
                    disabled={processingDuplicate || !selectedMasterId}
                  >
                    {processingDuplicate ? 'Merging...' : 'Confirm Duplicate Merge'}
                  </button>
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={() => setDuplicateModalItem(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Modal: Delete Spam or Duplicate Complaint */}
      {deletingItem && (
        <div className="issue-modal-backdrop" onClick={() => setDeletingItem(null)}>
          <div className="issue-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <button className="issue-modal-close" onClick={() => setDeletingItem(null)}>
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b34235', marginBottom: '8px' }}>
              <AlertTriangle size={20} />
              <strong style={{ font: '11px var(--mono)', letterSpacing: '1px' }}>CONFIRM COMPLAINT DELETION</strong>
            </div>

            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '24px', margin: '4px 0 10px' }}>
              Delete {deletingItem.reference_id}?
            </h2>
            <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, marginBottom: '20px' }}>
              You are about to permanently remove complaint <strong>{deletingItem.reference_id}</strong> ("{deletingItem.description.slice(0, 60)}...") from the municipal database.
            </p>

            <form onSubmit={handleDeleteComplaint}>
              <div className="form-field">
                <label htmlFor="del-reason">Reason for Removal</label>
                <select
                  id="del-reason"
                  className="form-select"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                >
                  <option value="Spam or fraudulent submission">Spam or fraudulent submission</option>
                  <option value="Duplicate complaint already logged">Duplicate complaint already logged</option>
                  <option value="Invalid GPS coordinates or test submission">Invalid GPS coordinates or test submission</option>
                  <option value="Inappropriate / offensive content">Inappropriate / offensive content</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: '#b34235',
                    color: '#fff',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '4px',
                    cursor: isDeleting ? 'wait' : 'pointer',
                    font: '600 13px var(--mono)',
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
                <button
                  type="button"
                  className="button button-dark"
                  onClick={() => setDeletingItem(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Image Full View Modal */}
      {previewImage && (
        <div className="issue-modal-backdrop" onClick={() => setPreviewImage(null)}>
          <div style={{ maxWidth: '640px', width: '100%', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                background: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <X size={18} />
            </button>
            <img
              src={previewImage}
              alt="Full preview"
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', background: '#000' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
