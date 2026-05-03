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
import MapView, { Callout, Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';

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
  email?: string;
  phoneNumber: string;
  profileImageUrl?: string;
  status?: string;
  isOnline?: boolean;
  vehicle?: {
    category?: string;
    make?: string;
    model?: string;
    plateNumber?: string;
    color?: string;
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
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

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
  const selectedDriver = selectedDriverId
    ? visibleMapDrivers.find((driver) => String(driver.driverId || driver.id) === selectedDriverId) || null
    : null;

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
                onPress={() => setSelectedDriverId(null)}
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
                      onPress={(event) => {
                        event.stopPropagation?.();
                        setSelectedDriverId(String(driver.driverId || driver.id));
                      }}>
                      <Image
                        source={getVehicleMarkerSource(vehicleCategory)}
                        style={[
                          styles.vehicleMarkerImage,
                          !driver.isOnline ? styles.vehicleMarkerImageOffline : null,
                          getVehicleHeadingStyle(driver.heading),
                        ]}
                      />
                      <Callout tooltip>
                        <DriverMapCallout driver={driver} />
                      </Callout>
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

            {selectedDriver ? <DriverDetailsCard driver={selectedDriver} compact={isMedium} /> : null}
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

            <View style={[styles.mapModalBody, isWide ? styles.mapModalBodyWide : null]}>
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
                  onPress={() => setSelectedDriverId(null)}
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
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setSelectedDriverId(String(driver.driverId || driver.id));
                        }}>
                        <Image
                          source={getVehicleMarkerSource(vehicleCategory)}
                          style={[
                            styles.vehicleMarkerImage,
                            !driver.isOnline ? styles.vehicleMarkerImageOffline : null,
                            getVehicleHeadingStyle(driver.heading),
                          ]}
                        />
                        <Callout tooltip>
                          <DriverMapCallout driver={driver} />
                        </Callout>
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

              {selectedDriver ? <DriverDetailsCard driver={selectedDriver} expanded /> : null}
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

function formatDriverId(driver: DriverLocationRecord) {
  return String(driver.driverId || driver.id || '').slice(-6).toUpperCase() || 'N/A';
}

function formatSignalTime(updatedAt?: number) {
  const timestamp = Number(updatedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'No signal time';
  }

  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCoordinate(value?: number) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) {
    return 'N/A';
  }

  return coordinate.toFixed(5);
}

function DriverDetailsCard({
  driver,
  compact = false,
  expanded = false,
}: {
  driver: DriverLocationRecord;
  compact?: boolean;
  expanded?: boolean;
}) {
  const vehicleCategory = getVehicleCategory(driver);
  const initials = String(driver.fullName || 'D')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const isOnline = Boolean(driver.isOnline);

  return (
    <View style={[styles.driverDetailsCard, compact ? styles.driverDetailsCardCompact : null, expanded ? styles.driverDetailsCardExpanded : null]}>
      <View style={styles.driverDetailsHeader}>
        <View style={styles.driverAvatar}>
          <Text style={styles.driverAvatarText}>{initials || 'D'}</Text>
        </View>
        <View style={styles.driverDetailsTitleWrap}>
          <Text style={styles.driverDetailsEyebrow}>SELECTED DRIVER</Text>
          <Text style={styles.driverDetailsName} numberOfLines={1}>
            {driver.fullName || 'Driver'}
          </Text>
          <Text style={styles.driverDetailsSubline} numberOfLines={1}>
            {formatVehicle(driver.vehicle)}
          </Text>
        </View>
        <View style={[styles.driverLivePill, isOnline ? styles.driverLivePillOnline : styles.driverLivePillOffline]}>
          <View style={[styles.driverLiveDot, isOnline ? styles.driverLiveDotOnline : styles.driverLiveDotOffline]} />
          <Text style={[styles.driverLivePillText, isOnline ? styles.driverLivePillTextOnline : styles.driverLivePillTextOffline]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <View style={styles.driverDetailsGrid}>
        <DriverDetailItem icon="finger-print-outline" label="Driver ID" value={formatDriverId(driver)} />
        <DriverDetailItem icon="car-sport-outline" label="Vehicle" value={vehicleCategory || driver.vehicleCategory || 'Vehicle'} />
        <DriverDetailItem icon="barcode-outline" label="Plate" value={driver.vehicle?.plateNumber || 'No plate'} />
        <DriverDetailItem icon="color-palette-outline" label="Color" value={driver.vehicle?.color || 'Not set'} />
        <DriverDetailItem icon="call-outline" label="Phone" value={driver.phoneNumber || 'No phone'} />
        <DriverDetailItem icon="time-outline" label="Signal" value={formatSignalTime(driver.updatedAt)} />
      </View>

      <View style={styles.driverLocationPanel}>
        <View style={styles.driverLocationTitleRow}>
          <Ionicons name="location-outline" size={15} color={teal} />
          <Text style={styles.driverLocationTitle}>Current position</Text>
        </View>
        <View style={styles.driverCoordinateRow}>
          <Text style={styles.driverCoordinateText}>Lat {formatCoordinate(driver.latitude)}</Text>
          <Text style={styles.driverCoordinateText}>Lng {formatCoordinate(driver.longitude)}</Text>
        </View>
      </View>
    </View>
  );
}

function DriverDetailItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.driverDetailItem}>
      <View style={styles.driverDetailIcon}>
        <Ionicons name={icon} size={14} color={teal} />
      </View>
      <View style={styles.driverDetailTextWrap}>
        <Text style={styles.driverDetailLabel}>{label}</Text>
        <Text style={styles.driverDetailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function DriverMapCallout({ driver }: { driver: DriverLocationRecord }) {
  const vehicleCategory = getVehicleCategory(driver);
  const vehicleLabel = vehicleCategory || driver.vehicleCategory || driver.vehicle?.category || 'Vehicle';
  const plateLabel = driver.vehicle?.plateNumber || 'No plate';

  return (
    <View style={styles.calloutWrap}>
      <View style={styles.calloutCard}>
        <View style={styles.calloutTopRow}>
          <View style={styles.calloutVehicleIcon}>
            <Image source={getVehicleMarkerSource(vehicleCategory)} style={styles.calloutVehicleImage} />
          </View>
          <View style={styles.calloutTextWrap}>
            <Text style={styles.calloutName} numberOfLines={1}>
              {driver.fullName || 'Driver'}
            </Text>
            <View style={styles.calloutMetaRow}>
              <Text style={styles.calloutVehicleText} numberOfLines={1}>
                {vehicleLabel}
              </Text>
              <View style={styles.calloutMetaDivider} />
              <Text style={styles.calloutPlateText} numberOfLines={1}>
                {plateLabel}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.calloutFooter}>
          <View style={[styles.calloutStatusDot, driver.isOnline ? styles.calloutStatusDotOnline : null]} />
          <Text style={styles.calloutStatusText}>{driver.isOnline ? 'Live tracking' : 'Last known location'}</Text>
        </View>
      </View>
      <View style={styles.calloutArrow} />
    </View>
  );
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
  driverDetailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 12,
    gap: 12,
  },
  driverDetailsCardCompact: {
    width: 270,
    alignSelf: 'stretch',
  },
  driverDetailsCardExpanded: {
    width: 320,
    alignSelf: 'stretch',
  },
  driverDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9E4E0',
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  driverAvatarText: {
    color: teal,
    fontSize: 15,
    fontWeight: '900',
  },
  driverDetailsTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  driverDetailsEyebrow: {
    color: teal,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  driverDetailsName: {
    color: '#102A28',
    fontSize: 15,
    fontWeight: '800',
  },
  driverDetailsSubline: {
    color: '#617C79',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  driverLivePill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
  },
  driverLivePillOnline: {
    backgroundColor: '#E7F5F3',
  },
  driverLivePillOffline: {
    backgroundColor: '#EEF2F1',
  },
  driverLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  driverLiveDotOnline: {
    backgroundColor: teal,
  },
  driverLiveDotOffline: {
    backgroundColor: '#7A908D',
  },
  driverLivePillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  driverLivePillTextOnline: {
    color: teal,
  },
  driverLivePillTextOffline: {
    color: '#617C79',
  },
  driverDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  driverDetailItem: {
    flex: 1,
    flexBasis: 120,
    minWidth: 116,
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverDetailIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  driverDetailTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  driverDetailLabel: {
    color: '#7A908D',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  driverDetailValue: {
    color: '#102A28',
    fontSize: 11,
    fontWeight: '800',
  },
  driverLocationPanel: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#C9E4E0',
    backgroundColor: '#E7F5F3',
    padding: 10,
    gap: 8,
  },
  driverLocationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  driverLocationTitle: {
    color: '#123532',
    fontSize: 12,
    fontWeight: '900',
  },
  driverCoordinateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  driverCoordinateText: {
    flexGrow: 1,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    color: '#617C79',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  calloutWrap: {
    alignItems: 'center',
    paddingBottom: 6,
  },
  calloutCard: {
    width: 250,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  calloutTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calloutVehicleIcon: {
    width: 44,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9E4E0',
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  calloutVehicleImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  calloutTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  calloutName: {
    color: '#102A28',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    marginBottom: 3,
  },
  calloutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  calloutVehicleText: {
    color: '#123532',
    fontSize: 14,
    fontWeight: '900',
    flexShrink: 1,
  },
  calloutMetaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#CFE4E0',
  },
  calloutPlateText: {
    color: '#123532',
    fontSize: 14,
    fontWeight: '900',
    flexShrink: 1,
  },
  calloutFooter: {
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: '#F7FBFA',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  calloutStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#7A908D',
  },
  calloutStatusDotOnline: {
    backgroundColor: teal,
  },
  calloutStatusText: {
    color: '#617C79',
    fontSize: 10,
    fontWeight: '900',
  },
  calloutArrow: {
    width: 18,
    height: 18,
    marginTop: -9,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
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
  mapModalBody: {
    flex: 1,
    gap: 12,
  },
  mapModalBodyWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  mapModalShell: {
    flex: 1,
    minHeight: 380,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8F0EF',
  },
});
