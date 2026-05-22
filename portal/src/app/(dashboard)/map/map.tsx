'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import type { InspectionSummary } from '@/lib/features';

declare global {
  interface Window {
    // Leaflet is loaded from CDN; we type it as any to avoid a build-time dep.
    L?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

const STAGE_COLOR: Record<string, string> = {
  lead: '#64748b',
  inspected: '#0284c7',
  quoted: '#7c3aed',
  accepted: '#059669',
  scheduled: '#d97706',
  completed: '#16a34a',
};

export default function MapView({ items }: { items: InspectionSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const inited = useRef(false);

  const draw = () => {
    if (inited.current || !ref.current || !window.L) return;
    const L = window.L;
    const center: [number, number] =
      items.length > 0
        ? [items[0].latitude as number, items[0].longitude as number]
        : [53.349805, -6.26031]; // Dublin fallback
    const map = L.map(ref.current).setView(center, items.length > 0 ? 10 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);
    for (const it of items) {
      const lat = it.latitude as number;
      const lng = it.longitude as number;
      const color = STAGE_COLOR[it.pipelineStage] ?? '#475569';
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.7,
        weight: 2,
      }).addTo(map);
      marker.bindPopup(
        `<div style="font-family:system-ui;font-size:12px">
          <div style="font-weight:600">${escapeHtml(it.customerName || '—')}</div>
          <div style="color:#64748b">${escapeHtml(it.address || '')}</div>
          <div style="margin-top:4px;text-transform:uppercase;font-size:10px;color:${color};font-weight:600">
            ${it.pipelineStage}
          </div>
          <a href="/inspections/${it.id}" style="color:#1e40af;font-size:11px">Open →</a>
        </div>`,
      );
      bounds.extend([lat, lng]);
    }
    if (items.length > 1) map.fitBounds(bounds.pad(0.15));
    inited.current = true;
  };

  useEffect(() => {
    if (window.L) draw();
  });

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        crossOrigin=""
        strategy="afterInteractive"
        onLoad={draw}
      />
      <div
        ref={ref}
        className="h-[600px] w-full rounded-xl border border-slate-200 bg-white shadow-sm"
      />
    </>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
