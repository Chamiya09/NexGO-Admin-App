import React, { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type AdminOsmLatLng = {
  latitude: number;
  longitude: number;
};

export type AdminOsmRegion = AdminOsmLatLng & {
  latitudeDelta?: number;
  longitudeDelta?: number;
};

export type AdminOsmMarker = {
  id: string;
  coordinate: AdminOsmLatLng;
  color?: string;
  iconUrl?: string;
  label?: string;
  heading?: number;
  isOnline?: boolean;
  selected?: boolean;
};

type Props = {
  region: AdminOsmRegion;
  markers: AdminOsmMarker[];
  onMapReady?: () => void;
  onPress?: () => void;
  onMarkerPress?: (id: string) => void;
  style?: React.CSSProperties;
};

function toPoint(point: AdminOsmLatLng): [number, number] {
  return [point.latitude, point.longitude];
}

function regionToZoom(region: AdminOsmRegion) {
  const delta = Math.max(region.latitudeDelta ?? 0.12, region.longitudeDelta ?? 0.12);
  return Math.max(3, Math.min(18, Math.round(Math.log2(360 / delta))));
}

function createVehicleIcon(marker: AdminOsmMarker) {
  const color = marker.color || '#008080';
  const heading = Number(marker.heading || 0);
  const opacity = marker.isOnline === false ? 0.55 : 1;
  const selectedRing = marker.selected
    ? '0 0 0 4px rgba(0,128,128,.2), 0 8px 18px rgba(0,0,0,.28)'
    : '0 5px 14px rgba(0,0,0,.24)';
  const label = escapeHtml(marker.label || 'Driver');
  const markerBody = marker.iconUrl
    ? `<img src="${escapeHtml(marker.iconUrl)}" alt="${label}" style="width:34px;height:34px;object-fit:contain;display:block;transform:rotate(${heading}deg);" />`
    : `<span style="display:block;transform:rotate(${heading}deg);font-size:17px;font-weight:900;color:#fff;">▲</span>`;

  return L.divIcon({
    className: '',
    html: `<div style="
      width:42px;height:42px;border-radius:14px;
      display:grid;place-items:center;
      background:#ffffff;border:2px solid ${color};
      box-shadow:${selectedRing};
      opacity:${opacity};
    ">${markerBody}</div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => (
    {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char] || char
  ));
}

function Recenter({ region }: { region: AdminOsmRegion }) {
  const map = useMap();

  useEffect(() => {
    map.setView(toPoint(region), regionToZoom(region), { animate: true });
  }, [map, region]);

  return null;
}

export function CustomOsmMap({ region, markers, onMapReady, onPress, onMarkerPress, style }: Props) {
  return (
    <MapContainer
      center={toPoint(region)}
      zoom={regionToZoom(region)}
      style={{ width: '100%', height: '100%', ...style }}
      zoomControl
      attributionControl
      whenReady={onMapReady}>
      <Recenter region={region} />
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
        maxZoom={19}
      />
      <MapClickHandler onPress={onPress} />
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={toPoint(marker.coordinate)}
          icon={createVehicleIcon(marker)}
          eventHandlers={{
            click: () => onMarkerPress?.(marker.id),
          }}
        />
      ))}
    </MapContainer>
  );
}

function MapClickHandler({ onPress }: { onPress?: () => void }) {
  const map = useMap();

  useEffect(() => {
    if (!onPress) return;
    map.on('click', onPress);
    return () => {
      map.off('click', onPress);
    };
  }, [map, onPress]);

  return null;
}
