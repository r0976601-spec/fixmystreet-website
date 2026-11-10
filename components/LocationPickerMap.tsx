'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet';
import { LocateFixed, MapPin, Check } from 'lucide-react';

interface LocationPickerMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelected: (lat: number, lng: number, placeLabel?: string) => void;
  height?: string;
}

export default function LocationPickerMap({
  initialLat = 31.3260,
  initialLng = 75.5762,
  onLocationSelected,
  height = '240px',
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });
  const [detecting, setDetecting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function init() {
      if (!containerRef.current) return;

      // Clean up previous instance or stale leaflet ID
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapRef.current = null;
      }

      if ((containerRef.current as any)._leaflet_id) {
        delete (containerRef.current as any)._leaflet_id;
      }

      const L = (await import('leaflet')).default;
      if (!isMounted || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
      });

      // Reliable OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // High-visibility draggable Pin Icon
      const pinIcon = L.divIcon({
        className: 'custom-picker-pin',
        html: `
          <div class="picker-pin-wrapper">
            <div class="picker-pin-head">📍</div>
            <div class="picker-pin-shadow"></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 34],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.bindTooltip('Drag or click map to move pin', {
        direction: 'top',
        offset: [0, -32],
        permanent: false,
      });

      markerRef.current = marker;

      // Reverse geocode helper
      async function tryReverseGeocode(lat: number, lng: number) {
        try {
          setGeocoding(true);
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
            headers: { 'Accept': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const road = addr.road || addr.suburb || addr.neighbourhood || addr.residential;
            const city = addr.city || addr.town || 'Jalandhar';
            if (road) {
              const label = `${road}, ${city}`;
              onLocationSelected(lat, lng, label);
              return;
            }
          }
        } catch (e) {
          // Fallback to coordinates
        } finally {
          setGeocoding(false);
        }
        onLocationSelected(lat, lng);
      }

      // When marker is dragged
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCurrentCoords({ lat: pos.lat, lng: pos.lng });
        tryReverseGeocode(pos.lat, pos.lng);
      });

      // When map is clicked
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setCurrentCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        tryReverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;

      // Invalidate map size to prevent gray tiles
      const invalidate = () => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      };

      setTimeout(invalidate, 100);
      setTimeout(invalidate, 300);
      setTimeout(invalidate, 700);

      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          invalidate();
        });
        resizeObserver.observe(containerRef.current);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapRef.current = null;
      }
      if (containerRef.current && (containerRef.current as any)._leaflet_id) {
        delete (containerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  function handleLocateMe() {
    if (!navigator.geolocation) {
      alert('GPS is not supported by your browser.');
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });

        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }

        onLocationSelected(lat, lng, `Current GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        setDetecting(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setDetecting(false);
        alert('Could not retrieve GPS coordinates. You can click on the map directly to place the pin.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: '6px', overflow: 'hidden', border: '1px solid #dedbd1' }}>
      <div ref={containerRef} style={{ width: '100%', height }} />

      {/* Floating GPS button */}
      <button
        type="button"
        onClick={handleLocateMe}
        disabled={detecting}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 400,
          background: '#fff',
          border: '1px solid #d4d0c5',
          borderRadius: '4px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          font: '10px var(--mono)',
          cursor: detecting ? 'wait' : 'pointer',
          color: 'var(--ink)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
        }}
      >
        <LocateFixed size={13} color="var(--orange)" />
        {detecting ? 'Locating...' : 'Use My GPS'}
      </button>

      {/* Coordinate status bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 400,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(4px)',
          border: '1px solid #dedbd0',
          padding: '4px 10px',
          borderRadius: '16px',
          font: '10px var(--mono)',
          color: '#555',
          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <MapPin size={11} color="var(--orange)" />
        <span>
          {currentCoords.lat.toFixed(4)}° N, {currentCoords.lng.toFixed(4)}° E
        </span>
        {geocoding && <span style={{ color: 'var(--orange-dark)' }}>(resolving address...)</span>}
      </div>
    </div>
  );
}
