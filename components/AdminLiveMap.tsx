import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';

import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';
import {
  AdminDriverLocation,
  getAdminSocket,
  requestDriverLocationSnapshot,
} from '@/lib/adminSocket';

const teal = '#008080';

const vehicleMarkerImages: Record<'Bike' | 'Tuk' | 'Mini' | 'Car' | 'Van' | 'Default', ImageSourcePropType> = {
  Bike: require('../assets/images/vehicle-markers/bike-top.png'),
  Tuk: require('../assets/images/vehicle-markers/tuk-top.png'),
  Mini: require('../assets/images/vehicle-markers/mini-top.png'),
  Car: require('../assets/images/vehicle-markers/car-top.png'),
  Van: require('../assets/images/vehicle-markers/van-top.png'),
  Default: require('../assets/images/vehicle-markers/car-top.png'),
};

type DriverUser = {
  id: string;
  fullName: string;
  phoneNumber: string;
  vehicle?: {
    category?: string;
    make?: string;
    model?: string;
    plateNumber?: string;
  } | null;
};

type DriverLocation = AdminDriverLocation;

type DriverMapRecord = DriverUser & DriverLocation;
type DriverLocationRecord = DriverMapRecord | (DriverLocation & Partial<DriverUser>);

export function AdminLiveMap() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;
  const isMedium = width >= 720;
  const mapRef = useRef<MapView | null>(null);
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [driverLocations, setDriverLocations] = useState<Record<string, DriverLocation>>({});
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [isLiveMapModalVisible, setIsLiveMapModalVisible] = useState(false);
  const [isDashboardMapReady, setIsDashboardMapReady] = useState(false);
  const [isPopupMapReady, setIsPopupMapReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadDrivers = async () => {
      setLoadingDrivers(true);
      setMapErrorMessage(null);

      try {
        const response = await authFetch(`${API_BASE_URL}/driver-auth/drivers`);
        const data = await parseApiResponse<{ drivers: DriverUser[] }>(response);

        if (isMounted) {
          setDrivers(data.drivers);
        }
      } catch (error) {
        if (isMounted) {
          setMapErrorMessage(error instanceof Error ? error.message : 'Unable to load driver list.');
        }
      } finally {
        if (isMounted) {
          setLoadingDrivers(false);
        }
      }
    };

    loadDrivers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const socket = getAdminSocket();

    const handleConnect = () => {
      setSocketConnected(true);
      requestDriverLocationSnapshot();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    const handleSnapshot = (locations: DriverLocation[]) => {
      setDriverLocations(
        Object.fromEntries(locations.map((location) => [location.driverId, location]))
      );
    };

    const handleUpdate = (location: DriverLocation) => {
      setDriverLocations((current) => ({
        ...current,
        [location.driverId]: location,
      }));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('drivers_location_snapshot', handleSnapshot);
    socket.on('drivers_location_update', handleUpdate);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('drivers_location_snapshot', handleSnapshot);
      socket.off('drivers_location_update', handleUpdate);
    };
  }, []);

  const trackedDrivers = useMemo<DriverLocationRecord[]>(
    () =>
      Object.values(driverLocations)
        .filter(hasValidDriverLocation)
        .map((location) => {
          const matchingDriver = drivers.find((driver) => String(driver.id) === String(location.driverId));
          return matchingDriver
            ? { ...matchingDriver, ...location }
            : {
                ...location,
                id: String(location.driverId),
                fullName: `Driver ${String(location.driverId).slice(-6)}`,
              };
        }),
    [drivers, driverLocations]
  );

  const onlineDrivers = useMemo(
    () => trackedDrivers.filter((driver) => driver.isOnline),
    [trackedDrivers]
  );

  const latestDriverSignal = useMemo(
    () => onlineDrivers[0] || trackedDrivers[0] || null,
    [onlineDrivers, trackedDrivers]
  );

  const visibleMapDrivers = onlineDrivers.length > 0 ? onlineDrivers : trackedDrivers;

  const mapRegion = useMemo(
    () =>
      latestDriverSignal
        ? {
            latitude: latestDriverSignal.latitude,
            longitude: latestDriverSignal.longitude,
            latitudeDelta: trackedDrivers.length > 1 ? 0.18 : 0.08,
            longitudeDelta: trackedDrivers.length > 1 ? 0.18 : 0.08,
          }
        : {
            latitude: 6.9271,
            longitude: 79.8612,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          },
    [latestDriverSignal, trackedDrivers.length]
  );

  useEffect(() => {
    if (!latestDriverSignal) return;
    mapRef.current?.animateToRegion(mapRegion, 450);
  }, [latestDriverSignal, mapRegion]);

  return (
    <>
      <View style={styles.liveMapCard}>
        <View style={[styles.liveMapHeader, isMedium ? styles.liveMapHeaderWide : null]}>
          <View style={styles.liveMapTitleGroup}>
            <Text style={styles.cardEyebrow}>LIVE MAP</Text>
            <Text style={styles.liveMapTitle}>Driver monitor</Text>
            <Text style={styles.liveMapSubtitle}>Realtime fleet positions on OpenStreetMap</Text>
          </View>
          <View style={[styles.liveMapActions, isMedium ? styles.liveMapActionsWide : null]}>
            <View style={styles.liveMapBadge}>
              <Ionicons
                name={socketConnected ? 'radio-outline' : 'cloud-offline-outline'}
                size={14}
                color={teal}
              />
              <Text style={styles.liveMapBadgeText}>{socketConnected ? 'Live' : 'Reconnecting'}</Text>
            </View>
            <Pressable
              style={styles.liveMapOpenButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Show live map popup"
              onPress={() => {
                setIsPopupMapReady(false);
                setIsLiveMapModalVisible(true);
              }}>
              <Ionicons name="expand-outline" size={15} color={teal} />
              <Text style={styles.liveMapOpenButtonText}>Open Map</Text>
            </Pressable>
          </View>
        </View>

        {loadingDrivers && trackedDrivers.length === 0 ? (
          <View style={styles.liveMapState}>
            <ActivityIndicator size="small" color={teal} />
            <Text style={styles.liveMapStateText}>Loading drivers...</Text>
          </View>
        ) : mapErrorMessage && trackedDrivers.length === 0 ? (
          <View style={[styles.liveMapState, styles.liveMapErrorState]}>
            <Ionicons name="alert-circle-outline" size={18} color="#C13B3B" />
            <Text style={[styles.liveMapStateText, styles.liveMapErrorText]}>{mapErrorMessage}</Text>
          </View>
        ) : (
          <View style={[styles.liveMapBody, isMedium ? styles.liveMapBodyWide : null]}>
            <View style={styles.liveMapShell}>
              <MapView
                ref={mapRef}
                style={styles.liveMap}
                provider={PROVIDER_DEFAULT}
                initialRegion={mapRegion}
                mapType={Platform.OS === 'ios' ? 'none' : 'standard'}
                loadingEnabled
                loadingBackgroundColor="#E8F0EF"
                loadingIndicatorColor={teal}
                onMapReady={() => setIsDashboardMapReady(true)}
                showsUserLocation={false}
                showsMyLocationButton={false}
                scrollEnabled
                zoomEnabled
                rotateEnabled
                pitchEnabled>
                <UrlTile
                  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                  flipY={false}
                />
                {visibleMapDrivers.map((driver) => {
                  const vehicleCategory = getVehicleCategory(driver);

                  return (
                    <Marker
                      key={String(driver.driverId || driver.id)}
                      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                      title={driver.fullName || 'Driver'}
                      description={`${vehicleCategory || formatVehicle(driver.vehicle)} | ${driver.vehicle?.plateNumber || 'No plate'}`}>
                      <Image
                        source={getVehicleMarkerSource(vehicleCategory)}
                        style={[
                          styles.vehicleMarkerImage,
                          !driver.isOnline ? styles.vehicleMarkerImageOffline : null,
                          getVehicleHeadingStyle(driver.heading),
                        ]}
                      />
                    </Marker>
                  );
                })}
              </MapView>
              {!isDashboardMapReady ? (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="small" color={teal} />
                </View>
              ) : null}
            </View>

            <View style={[styles.liveMapStats, isMedium ? styles.liveMapStatsWide : null]}>
              <View style={styles.liveMapStat}>
                <View style={styles.liveMapStatIcon}>
                  <Ionicons name="navigate-outline" size={15} color={teal} />
                </View>
                <Text style={styles.liveMapStatValue}>{trackedDrivers.length}</Text>
                <Text style={styles.liveMapStatLabel}>Tracked</Text>
              </View>
              <View style={styles.liveMapStat}>
                <View style={styles.liveMapStatIcon}>
                  <Ionicons name="radio-outline" size={15} color={teal} />
                </View>
                <Text style={styles.liveMapStatValue}>{onlineDrivers.length}</Text>
                <Text style={styles.liveMapStatLabel}>Online</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={isLiveMapModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLiveMapModalVisible(false)}>
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModalCard}>
            <View style={styles.mapModalHeader}>
              <View style={styles.mapModalTitleGroup}>
                <Text style={styles.cardEyebrow}>LIVE MAP</Text>
                <Text style={styles.mapModalTitle}>Driver locations</Text>
              </View>
              <Pressable
                style={styles.mapModalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close live map popup"
                onPress={() => setIsLiveMapModalVisible(false)}>
                <Ionicons name="close" size={21} color="#617C79" />
              </Pressable>
            </View>

            <View style={styles.mapModalShell}>
              <MapView
                style={styles.liveMap}
                provider={PROVIDER_DEFAULT}
                initialRegion={mapRegion}
                mapType={Platform.OS === 'ios' ? 'none' : 'standard'}
                loadingEnabled
                loadingBackgroundColor="#E8F0EF"
                loadingIndicatorColor={teal}
                onMapReady={() => setIsPopupMapReady(true)}
                showsUserLocation={false}
                showsMyLocationButton={false}
                scrollEnabled
                zoomEnabled
                rotateEnabled
                pitchEnabled>
                <UrlTile
                  urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maximumZ={19}
                  flipY={false}
                />
                {visibleMapDrivers.map((driver) => {
                  const vehicleCategory = getVehicleCategory(driver);

                  return (
                    <Marker
                      key={String(driver.driverId || driver.id)}
                      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                      title={driver.fullName || 'Driver'}
                      description={`${vehicleCategory || formatVehicle(driver.vehicle)} | ${driver.vehicle?.plateNumber || 'No plate'}`}>
                      <Image
                        source={getVehicleMarkerSource(vehicleCategory)}
                        style={[
                          styles.vehicleMarkerImage,
                          !driver.isOnline ? styles.vehicleMarkerImageOffline : null,
                          getVehicleHeadingStyle(driver.heading),
                        ]}
                      />
                    </Marker>
                  );
                })}
              </MapView>
              {!isPopupMapReady ? (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="small" color={teal} />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function hasValidDriverLocation(location: DriverLocation): location is DriverLocation {
  return Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude));
}

function getVehicleCategory(driver: DriverLocationRecord) {
  const rawCategory = (driver.vehicle?.category || driver.vehicleCategory || '').trim().toLowerCase();

  switch (rawCategory) {
    case 'tuk':
    case 'tuktuk':
    case 'threewheel':
    case 'three-wheel':
    case 'three wheel':
      return 'Tuk';
    case 'bike':
    case 'motorbike':
    case 'motorcycle':
      return 'Bike';
    case 'mini':
      return 'Mini';
    case 'car':
    case 'sedan':
      return 'Car';
    case 'van':
      return 'Van';
    default:
      return null;
  }
}

function getVehicleMarkerSource(category: ReturnType<typeof getVehicleCategory>) {
  return vehicleMarkerImages[category || 'Default'];
}

function getVehicleHeadingStyle(heading?: number) {
  const nextHeading = Number(heading);

  if (!Number.isFinite(nextHeading)) {
    return null;
  }

  return { transform: [{ rotate: `${nextHeading}deg` }] };
}

function formatVehicle(vehicle: DriverUser['vehicle']) {
  if (!vehicle) {
    return 'Vehicle not added';
  }

  return [vehicle.category, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle added';
}

const styles = StyleSheet.create({
  cardEyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  liveMapCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  liveMapHeader: {
    gap: 12,
    marginBottom: 16,
  },
  liveMapHeaderWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  liveMapTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  liveMapTitle: {
    color: '#102A28',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  liveMapSubtitle: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  liveMapActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    alignSelf: 'flex-start',
  },
  liveMapActionsWide: {
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  liveMapBadge: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  liveMapBadgeText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  liveMapOpenButton: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexShrink: 0,
  },
  liveMapOpenButtonText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  liveMapState: {
    height: 220,
    borderRadius: 18,
    backgroundColor: '#F7FBFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  liveMapErrorState: {
    backgroundColor: '#FFF4F4',
    paddingHorizontal: 18,
  },
  liveMapStateText: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  liveMapErrorText: {
    color: '#C13B3B',
  },
  liveMapShell: {
    height: 250,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E8F0EF',
    flex: 1,
    minWidth: 0,
  },
  liveMap: {
    flex: 1,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8F0EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleMarkerImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  vehicleMarkerImageOffline: {
    opacity: 0.55,
  },
  liveMapBody: {
    gap: 12,
  },
  liveMapBodyWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  liveMapStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    borderRadius: 16,
    backgroundColor: '#F7FBFA',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    padding: 10,
    gap: 10,
  },
  liveMapStatsWide: {
    width: 150,
    flexDirection: 'column',
  },
  liveMapStat: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  liveMapStatIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  liveMapStatValue: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 1,
  },
  liveMapStatLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 42, 40, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  mapModalCard: {
    flex: 1,
    maxHeight: 720,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  mapModalHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  mapModalTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  mapModalTitle: {
    color: '#102A28',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
  },
  mapModalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F6F5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  mapModalShell: {
    flex: 1,
    minHeight: 380,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8F0EF',
  },
});