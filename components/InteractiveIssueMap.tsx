'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { Layers, Maximize2, Minimize2, Navigation, RefreshCw } from 'lucide-react';

export interface MapIssue {
  id: number;
  reference_id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  status: 'Pending' | 'In Progress' | 'Resolved' | 'Submitted' | 'Under Review' | string;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  image_url?: string | null;
  admin_notes?: string | null;
  priority?: string;
  duplicate_of?: number | null;
  master_reference_id?: string | null;
}

interface InteractiveIssueMapProps {
  issues: MapIssue[];
  selectedIssue?: MapIssue | null;
  onSelectIssue?: (issue: MapIssue) => void;
  height?: string;
}

export default function InteractiveIssueMap({
  issues,
  selectedIssue,
  onSelectIssue,
  height = '440px',
}: InteractiveIssueMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<{ [key: number]: LeafletMarker }>({});
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Map safely
  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function initMap() {
      if (!mapContainerRef.current) return;

      // Clean up any existing map or stale Leaflet ID on the DOM container
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('Error removing previous map instance:', e);
        }
        mapRef.current = null;
      }

      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      const L = (await import('leaflet')).default;
      if (!isMounted || !mapContainerRef.current) return;

      // Center on Jalandhar City Center
      const defaultCenter: [number, number] = [31.3260, 75.5762];
      
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
      });

      // Standard, ultra-reliable OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      // Attribution
      L.control.attribution({ position: 'bottomright', prefix: '© OpenStreetMap · FixMyStreet' }).addTo(map);

      // Zoom control at bottom left
      L.control.zoom({ position: 'bottomleft' }).addTo(map);

      mapRef.current = map;
      setMapLoaded(true);

      // Invalidate size on container layout changes to prevent gray/unrendered tiles
      const invalidate = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      };

      setTimeout(invalidate, 100);
      setTimeout(invalidate, 300);
      setTimeout(invalidate, 700);

      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          invalidate();
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // ignore cleanup error
        }
        mapRef.current = null;
      }
      if (mapContainerRef.current && (mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Invalidate map size whenever fullscreen changes
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 150);
    }
  }, [isFullscreen]);

  // Update Markers when issues change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    let isMounted = true;

    async function updateMarkers() {
      const L = (await import('leaflet')).default;
      if (!isMounted || !mapRef.current) return;

      const map = mapRef.current;

      // Clear existing markers
      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const bounds: [number, number][] = [];

      issues.forEach((issue) => {
        // Fallback coordinates across Jalandhar if coordinates not set
        let lat = issue.latitude;
        let lng = issue.longitude;

        if (!lat || !lng) {
          if (issue.category.toLowerCase().includes('road')) {
            lat = 31.3260;
            lng = 75.5762;
          } else if (issue.category.toLowerCase().includes('waste')) {
            lat = 31.3090;
            lng = 75.5920;
          } else if (issue.category.toLowerCase().includes('light')) {
            lat = 31.3340;
            lng = 75.5680;
          } else if (issue.category.toLowerCase().includes('drain')) {
            lat = 31.3180;
            lng = 75.5800;
          } else {
            lat = 31.3220;
            lng = 75.5720;
          }
        }

        bounds.push([lat, lng]);

        const tone =
          issue.status === 'Resolved'
            ? 'green'
            : issue.status === 'In Progress'
            ? 'orange'
            : 'blue';

        const iconEmoji =
          issue.category.toLowerCase().includes('road') || issue.category.toLowerCase().includes('pothole')
            ? '🚧'
            : issue.category.toLowerCase().includes('waste')
            ? '🗑️'
            : issue.category.toLowerCase().includes('light')
            ? '💡'
            : issue.category.toLowerCase().includes('drain')
            ? '🌊'
            : '📍';

        const isUrgent = (issue.priority || '').toLowerCase() === 'urgent';

        const customIcon = L.divIcon({
          className: 'custom-leaflet-marker',
          html: `
            <div class="marker-bubble tone-${tone} ${isUrgent ? 'is-urgent-hazard' : ''}">
              <span class="marker-emoji">${isUrgent ? '🚨' : iconEmoji}</span>
              <span class="marker-pulse"></span>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -34],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        // Priority Badge HTML
        const priorityBadge = isUrgent
          ? '<span style="background:#faebea;color:#b52b20;border:1px solid #f5b8b3;padding:2px 6px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.5px;">🔥 URGENT</span>'
          : issue.priority && issue.priority !== 'Normal'
          ? `<span style="background:#fcf1e8;color:#b85b24;border:1px solid #f6cca8;padding:2px 6px;border-radius:3px;font-size:9px;">${escapeHtml(issue.priority)}</span>`
          : '';

        // Duplicate Notification in popup
        const duplicateNotice = issue.duplicate_of
          ? `<div style="background:#fffcf4;border:1px solid #f3d489;color:#8c5b05;font-size:10px;padding:4px 6px;border-radius:3px;margin:6px 0;">⚠️ Duplicate of ${escapeHtml(issue.master_reference_id || `FMS-JAL-${issue.duplicate_of}`)}</div>`
          : '';

        const popupContent = `
          <div class="map-popup-card">
            ${
              issue.image_url
                ? `<div class="popup-img-wrap"><img src="${issue.image_url}" alt="Issue photo" /></div>`
                : ''
            }
            <div class="popup-body">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span class="popup-id">${issue.reference_id} · ${issue.category.toUpperCase()}</span>
                ${priorityBadge}
              </div>
              <h4 class="popup-title">${escapeHtml(issue.description.slice(0, 75))}${
          issue.description.length > 75 ? '...' : ''
        }</h4>
              <p class="popup-loc">📍 ${escapeHtml(issue.location)}</p>
              ${duplicateNotice}
              <div class="popup-footer" style="margin-bottom:8px;">
                <span class="popup-status status-${tone}">${issue.status}</span>
                <span class="popup-date">${new Date(issue.created_at).toLocaleDateString()}</span>
              </div>
              <div style="display:flex;gap:6px;border-top:1px solid #f0eee8;padding-top:8px;">
                <a href="/track?id=${encodeURIComponent(issue.reference_id)}" style="flex:1;background:#faf8f4;border:1px solid #dedbd0;color:#555;padding:5px 8px;border-radius:3px;font-size:10px;text-align:center;font-family:var(--mono);text-decoration:none;">Track ↗</a>
                <button type="button" id="btn-inspect-${issue.id}" style="flex:1;background:var(--orange);border:1px solid var(--orange-dark);color:#fff;padding:5px 8px;border-radius:3px;font-size:10px;text-align:center;font-family:var(--mono);cursor:pointer;">Details ↗</button>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280, className: 'leaflet-custom-popup' });

        // When popup opens, attach click listener to the "Details" button
        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-inspect-${issue.id}`);
          if (btn && onSelectIssue) {
            btn.onclick = () => {
              onSelectIssue(issue);
            };
          }
        });

        markersRef.current[issue.id] = marker;
      });

      // Safely fit map bounds if distinct coordinates exist
      if (bounds.length > 0 && !selectedIssue) {
        const uniqueLats = new Set(bounds.map((b) => b[0]));
        const uniqueLngs = new Set(bounds.map((b) => b[1]));

        if (uniqueLats.size === 1 && uniqueLngs.size === 1) {
          map.setView(bounds[0], 14);
        } else {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        }
      }
    }

    updateMarkers();

    return () => {
      isMounted = false;
    };
  }, [issues, mapLoaded]);

  // Handle selected issue focus from outside
  useEffect(() => {
    if (!mapRef.current || !selectedIssue) return;

    let lat = selectedIssue.latitude || 31.3260;
    let lng = selectedIssue.longitude || 75.5762;

    mapRef.current.flyTo([lat, lng], 15, { duration: 1.0 });

    const marker = markersRef.current[selectedIssue.id];
    if (marker) {
      marker.openPopup();
    }
  }, [selectedIssue]);

  function resetView() {
    if (mapRef.current) {
      mapRef.current.flyTo([31.3260, 75.5762], 13);
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: isFullscreen ? '100vh' : height,
        borderRadius: isFullscreen ? '0' : '6px',
        overflow: 'hidden',
        border: '1px solid var(--line)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
        transition: 'height 0.3s ease',
        zIndex: isFullscreen ? 9999 : 1,
        ...(isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }
          : {}),
      }}
    >
      {/* Map Target Div */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Toolbar Controls */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 400,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={resetView}
          className="map-control-btn"
          title="Recenter Map on Jalandhar"
        >
          <Navigation size={15} />
        </button>
        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="map-control-btn"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Map Legend Pill */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          left: 14,
          zIndex: 400,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #dedbd0',
          padding: '6px 14px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          font: '10px var(--mono)',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--orange)', display: 'inline-block' }} /> In Progress
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#5a7d61', display: 'inline-block' }} /> Resolved
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b668f', display: 'inline-block' }} /> Pending
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b52b20', fontWeight: 700 }}>
          <i style={{ width: 8, height: 8, borderRadius: '50%', background: '#b52b20', display: 'inline-block' }} /> Urgent
        </span>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
