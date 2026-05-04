import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  style?: ViewStyle;
};

export function CustomOsmMap({ markers, onMapReady, onPress, onMarkerPress, style }: Props) {
  useEffect(() => {
    onMapReady?.();
  }, [onMapReady]);

  return (
    <Pressable style={[styles.container, style]} onPress={onPress}>
      <View pointerEvents="none" style={styles.gridLayer}>
        <View style={[styles.road, styles.roadOne]} />
        <View style={[styles.road, styles.roadTwo]} />
        <View style={[styles.road, styles.roadThree]} />
        <View style={[styles.ring, styles.ringLarge]} />
        <View style={[styles.ring, styles.ringSmall]} />
      </View>

      {markers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="map-outline" size={24} color="#008080" />
          <Text style={styles.emptyTitle}>Waiting for driver signals</Text>
          <Text style={styles.emptyText}>Live positions appear here when drivers are online.</Text>
        </View>
      ) : (
        markers.slice(0, 12).map((marker, index) => (
          <Pressable
            key={marker.id}
            style={[
              styles.marker,
              marker.selected ? styles.markerSelected : null,
              marker.isOnline === false ? styles.markerOffline : null,
              markerPosition(index, markers.length),
            ]}
            onPress={(event) => {
              event.stopPropagation();
              onMarkerPress?.(marker.id);
            }}>
            <View style={[styles.markerBadge, { borderColor: marker.color || '#008080' }]}>
              {marker.iconUrl ? (
                <Image
                  source={{ uri: marker.iconUrl }}
                  style={[
                    styles.markerImage,
                    { transform: [{ rotate: `${Number(marker.heading || 0)}deg` }] },
                  ]}
                />
              ) : (
                <Ionicons name="car-sport" size={20} color={marker.color || '#008080'} />
              )}
            </View>
            <Text style={styles.markerLabel} numberOfLines={1}>
              {marker.label || 'Driver'}
            </Text>
          </Pressable>
        ))
      )}
    </Pressable>
  );
}

function markerPosition(index: number, total: number): ViewStyle {
  if (total === 1) {
    return { left: '45%', top: '42%' };
  }

  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  const radiusX = 35;
  const radiusY = 28;

  return {
    left: `${45 + Math.cos(angle) * radiusX}%`,
    top: `${42 + Math.sin(angle) * radiusY}%`,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#E8F0EF',
  },
  gridLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  road: {
    position: 'absolute',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    opacity: 0.82,
  },
  roadOne: {
    width: '130%',
    left: '-18%',
    top: '24%',
    transform: [{ rotate: '-15deg' }],
  },
  roadTwo: {
    width: '125%',
    left: '-10%',
    top: '58%',
    transform: [{ rotate: '12deg' }],
  },
  roadThree: {
    width: '72%',
    left: '16%',
    top: '76%',
    transform: [{ rotate: '-7deg' }],
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#C7DFDC',
    opacity: 0.8,
  },
  ringLarge: {
    width: 190,
    height: 190,
    borderRadius: 95,
    left: '50%',
    top: '50%',
    marginLeft: -95,
    marginTop: -95,
  },
  ringSmall: {
    width: 94,
    height: 94,
    borderRadius: 47,
    left: '50%',
    top: '50%',
    marginLeft: -47,
    marginTop: -47,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 6,
  },
  emptyTitle: {
    color: '#102A28',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  marker: {
    position: 'absolute',
    width: 74,
    alignItems: 'center',
    gap: 4,
  },
  markerSelected: {
    transform: [{ scale: 1.08 }],
  },
  markerOffline: {
    opacity: 0.58,
  },
  markerBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  markerLabel: {
    maxWidth: 74,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    color: '#102A28',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
  },
});
