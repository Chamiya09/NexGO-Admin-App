import React, { useCallback, useMemo, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

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
  style?: StyleProp<ViewStyle>;
};

function toLeafletPoint(point: AdminOsmLatLng): [number, number] {
  return [point.latitude, point.longitude];
}

function regionToZoom(region: AdminOsmRegion) {
  const delta = Math.max(region.latitudeDelta ?? 0.12, region.longitudeDelta ?? 0.12);
  return Math.max(3, Math.min(18, Math.round(Math.log2(360 / delta))));
}

function buildHtml(region: AdminOsmRegion) {
  const center = JSON.stringify(toLeafletPoint(region));
  const zoom = regionToZoom(region);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E8F0EF; }
    .leaflet-control-attribution { display: none; }
    .osm-attribution {
      position: absolute; right: 6px; bottom: 4px; z-index: 999;
      background: rgba(255,255,255,.88); color: #2f4f4d;
      padding: 2px 6px; border-radius: 5px;
      font: 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .vehicle-wrap {
      width: 46px; height: 46px; display: grid; place-items: center;
      filter: drop-shadow(0 5px 10px rgba(0,0,0,.26));
    }
    .vehicle-badge {
      width: 42px; height: 42px; border-radius: 14px;
      display: grid; place-items: center;
      background: #fff; border: 2px solid var(--marker-color, #008080);
      box-sizing: border-box;
    }
    .vehicle-wrap.selected .vehicle-badge {
      box-shadow: 0 0 0 4px rgba(0,128,128,.22);
    }
    .vehicle-wrap.offline {
      opacity: .55;
    }
    .vehicle-badge img {
      width: 34px; height: 34px; object-fit: contain; display: block;
    }
    .vehicle-fallback {
      width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent;
      border-bottom: 18px solid var(--marker-color, #008080);
    }
    .vehicle-label {
      max-width: 140px; margin-top: 2px; transform: translateX(-47px);
      background: #fff; color: #102A28; border-radius: 999px;
      padding: 3px 7px; font: 900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      box-shadow: 0 2px 8px rgba(0,0,0,.16);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="osm-attribution">&copy; OpenStreetMap contributors</div>
  <script>
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: true,
      doubleClickZoom: true
    }).setView(${center}, ${zoom});

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true
    }).addTo(map);

    let markerLayer = L.layerGroup().addTo(map);

    function post(payload) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>"']/g, function(char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }

    function iconFor(marker) {
      const color = marker.color || '#008080';
      const heading = Number(marker.heading || 0);
      const label = escapeHtml(marker.label || 'Driver');
      const classes = [
        'vehicle-wrap',
        marker.selected ? 'selected' : '',
        marker.isOnline === false ? 'offline' : ''
      ].filter(Boolean).join(' ');
      const body = marker.iconUrl
        ? '<img src="' + escapeHtml(marker.iconUrl) + '" alt="' + label + '" style="transform: rotate(' + heading + 'deg)" />'
        : '<div class="vehicle-fallback" style="transform: rotate(' + heading + 'deg)"></div>';

      return L.divIcon({
        className: '',
        html: '<div class="' + classes + '" style="--marker-color:' + color + '"><div class="vehicle-badge">' + body + '</div></div><div class="vehicle-label">' + label + '</div>',
        iconSize: [46, 66],
        iconAnchor: [23, 23]
      });
    }

    function applyData(data) {
      markerLayer.clearLayers();

      (data.markers || []).forEach(function(marker) {
        if (!marker.coordinate) return;
        const latitude = Number(marker.coordinate.latitude);
        const longitude = Number(marker.coordinate.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const item = L.marker([latitude, longitude], {
          icon: iconFor(marker),
          zIndexOffset: marker.selected ? 1000 : 0
        }).addTo(markerLayer);

        item.on('click', function(event) {
          L.DomEvent.stopPropagation(event);
          post({ type: 'markerPress', id: marker.id });
        });
      });

      if (data.region) {
        map.flyTo([data.region.latitude, data.region.longitude], data.zoom || map.getZoom(), {
          duration: 0.35
        });
      }
    }

    function handleCommand(command) {
      if (command.type === 'update') {
        applyData(command);
      }
    }

    map.on('click', function() { post({ type: 'press' }); });
    window.document.addEventListener('message', function(event) { handleCommand(JSON.parse(event.data)); });
    window.addEventListener('message', function(event) { handleCommand(JSON.parse(event.data)); });
    setTimeout(function() { post({ type: 'ready' }); }, 250);
  </script>
</body>
</html>`;
}

export function CustomOsmMap({ region, markers, onMapReady, onPress, onMarkerPress, style }: Props) {
  const webViewRef = useRef<WebView>(null);
  const initialRegionRef = useRef(region);
  const html = useMemo(() => buildHtml(initialRegionRef.current), []);

  const syncMap = useCallback(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        type: 'update',
        region,
        zoom: regionToZoom(region),
        markers,
      })
    );
  }, [markers, region]);

  React.useEffect(() => {
    syncMap();
  }, [syncMap]);

  return (
    <WebView
      ref={webViewRef}
      style={style}
      source={{ html }}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      userAgent="NexGO-Admin/1.0 OSM Leaflet Mobile"
      onLoadEnd={syncMap}
      onMessage={(event) => {
        const payload = JSON.parse(event.nativeEvent.data);
        if (payload.type === 'ready') {
          syncMap();
          onMapReady?.();
        }
        if (payload.type === 'press') onPress?.();
        if (payload.type === 'markerPress') onMarkerPress?.(String(payload.id));
      }}
    />
  );
}
