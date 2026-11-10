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

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import('leaflet')).default;
      if (!isMounted || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        className: 'custom-picker-pin',
        html: `
          <div class="picker-pin-wrapper">
            <div class="picker-pin-head">📍</div>
            <div class="picker-pin-shadow"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([initialLat, initialLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;

      // When marker is dragged
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCurrentCoords({ lat: pos.lat, lng: pos.lng });
        onLocationSelected(pos.lat, pos.lng);
      });

      // When map is clicked
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        setCurrentCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        onLocationSelected(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
    }

    init();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
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
        alert('Could not retrieve GPS coordinates. You can click on the map directly to set the pin.');
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
          top: 10,
          right: 10,
          zIndex: 400,
          background: '#fff',
          border: '1px solid #d4d0c5',
          borderRadius: '4px',
          padding: '6px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          font: '10px var(--mono)',
          color: 'var(--ink)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        }}
      >
        <LocateFixed size={13} color="var(--orange)" />
        {detecting ? 'Locating...' : 'Pin my GPS'}
      </button>

      {/* Helper text footer */}
      <div
        style={{
          padding: '6px 12px',
          background: '#faf8f4',
          borderTop: '1px solid #e8e5dc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: '#666',
        }}
      >
        <span>💡 Click anywhere on the map or drag the pin to set issue location</span>
        <span style={{ font: '10px var(--mono)', color: '#457952' }}>
          {currentCoords.lat.toFixed(4)}° N, {currentCoords.lng.toFixed(4)}° E
        </span>
      </div>
    </div>
  );
}
