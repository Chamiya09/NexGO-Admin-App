import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, parseApiResponse } from '@/lib/api';
import {
  AdminDriverLocation,
  getAdminSocket,
  requestDriverLocationSnapshot,
} from '@/lib/adminSocket';

const teal = '#008080';

const stats = [
  { title: 'Total Revenue Today', value: '$18,420', change: '+12.4%', icon: 'cash-outline' as const },
  { title: 'Active Rides', value: '148', change: '+9 live now', icon: 'car-sport-outline' as const },
  { title: 'Available Drivers', value: '326', change: '81% online', icon: 'people-outline' as const },
  { title: 'Pending Approvals', value: '17', change: 'Needs review', icon: 'document-text-outline' as const },
];

const weeklyRides = [86, 112, 98, 134, 162, 149, 184];

const vehicleMarkerImages: Record<'Bike' | 'Tuk' | 'Mini' | 'Car' | 'Van' | 'Default', ImageSourcePropType> = {
  Bike: require('../../assets/images/vehicle-markers/bike-top.png'),
  Tuk: require('../../assets/images/vehicle-markers/tuk-top.png'),
  Mini: require('../../assets/images/vehicle-markers/mini-top.png'),
  Car: require('../../assets/images/vehicle-markers/car-top.png'),
  Van: require('../../assets/images/vehicle-markers/van-top.png'),
  Default: require('../../assets/images/vehicle-markers/car-top.png'),
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

export default function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;
  const isMedium = width >= 720;
  const chartHeight = 220;
  const maxValue = Math.max(...weeklyRides);
  const mapRef = useRef<MapView | null>(null);
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [driverLocations, setDriverLocations] = useState<Record<string, DriverLocation>>({});
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [mapErrorMessage, setMapErrorMessage] = useState<string | null>(null);
  const [isLiveMapModalVisible, setIsLiveMapModalVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadDrivers = async () => {
      setLoadingDrivers(true);
      setMapErrorMessage(null);

      try {
        const response = await fetch(`${API_BASE_URL}/driver-auth/drivers`);
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <RefreshableScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, isWide ? styles.headerRowWide : null]}>
          <View>
            <Text style={styles.eyebrow}>NEXGO ADMIN</Text>
            <Text style={styles.pageTitle}>Operations Dashboard</Text>
            <Text style={styles.pageSubtitle}>
              Central command for rides, drivers, approvals, and marketplace performance.
            </Text>
          </View>

          <View style={styles.headerBadge}>
            <Ionicons name="pulse-outline" size={16} color={teal} />
            <Text style={styles.headerBadgeText}>System healthy</Text>
          </View>
        </View>

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
                onPress={() => setIsLiveMapModalVisible(true)}>
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

        <View style={[styles.statsGrid, isWide ? styles.statsGridWide : null]}>
          {stats.map((stat) => (
            <View key={stat.title} style={[styles.statCard, isWide ? styles.statCardWide : null]}>
              <View style={styles.statCardTop}>
                <View style={styles.statIconWrap}>
                  <Ionicons name={stat.icon} size={20} color={teal} />
                </View>
                <Text style={styles.statChange}>{stat.change}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statTitle}>{stat.title}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.analyticsRow, isWide ? styles.analyticsRowWide : null]}>
          <View style={[styles.chartCard, isWide ? styles.chartCardMain : null]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>WEEKLY TREND</Text>
                <Text style={styles.cardTitle}>Completed rides</Text>
              </View>
              <View style={styles.cardPill}>
                <Text style={styles.cardPillText}>Last 7 days</Text>
              </View>
            </View>

            <View style={[styles.chartArea, { height: chartHeight }]}>
              <View style={styles.chartGrid}>
                {[0, 1, 2, 3].map((line) => (
                  <View key={line} style={styles.chartGridLine} />
                ))}
              </View>

              <View style={styles.chartBarsRow}>
                {weeklyRides.map((value, index) => {
                  const barHeight = Math.max((value / maxValue) * (chartHeight - 52), 28);
                  return (
                    <View key={`${value}-${index}`} style={styles.chartColumn}>
                      <Text style={styles.chartValue}>{value}</Text>
                      <View style={[styles.chartBar, { height: barHeight }]} />
                      <Text style={styles.chartLabel}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={[styles.chartCard, isWide ? styles.chartCardSide : null]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>QUICK WATCH</Text>
                <Text style={styles.cardTitle}>Ops priorities</Text>
              </View>
            </View>

            <View style={styles.priorityList}>
              <PriorityRow title="Driver document reviews" value="17 waiting" tone="warning" />
              <PriorityRow title="Search-to-match delay" value="2.4 min avg" tone="neutral" />
              <PriorityRow title="High-demand zones" value="Colombo 03, Kandy" tone="accent" />
              <PriorityRow title="Escalated support cases" value="6 open" tone="danger" />
            </View>
          </View>
        </View>
      </RefreshableScrollView>

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
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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

function PriorityRow({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: 'accent' | 'warning' | 'danger' | 'neutral';
}) {
  const toneStyle =
    tone === 'accent'
      ? styles.priorityDotAccent
      : tone === 'warning'
        ? styles.priorityDotWarning
        : tone === 'danger'
          ? styles.priorityDotDanger
          : styles.priorityDotNeutral;

  return (
    <View style={styles.priorityRow}>
      <View style={[styles.priorityDot, toneStyle]} />
      <View style={styles.priorityTextWrap}>
        <Text style={styles.priorityTitle}>{title}</Text>
        <Text style={styles.priorityValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F7',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  headerRow: {
    gap: 14,
    marginBottom: 18,
  },
  headerRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  pageTitle: {
    color: '#102A28',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#617C79',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    maxWidth: 680,
  },
  headerBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  headerBadgeText: {
    color: '#123532',
    fontSize: 13,
    fontWeight: '700',
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
  statsGrid: {
    gap: 14,
    marginBottom: 18,
  },
  statsGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  statCardWide: {
    width: '24%',
    minWidth: 220,
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChange: {
    color: '#157A62',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#102A28',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statTitle: {
    color: '#617C79',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  analyticsRow: {
    gap: 16,
  },
  analyticsRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chartCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  chartCardMain: {
    flex: 1.6,
  },
  chartCardSide: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cardEyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  cardTitle: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
  },
  cardPill: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardPillText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  chartArea: {
    borderRadius: 18,
    backgroundColor: '#F7FBFA',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  chartGrid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-evenly',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chartGridLine: {
    height: 1,
    backgroundColor: '#DCE9E7',
  },
  chartBarsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartValue: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  chartBar: {
    width: '100%',
    maxWidth: 42,
    borderRadius: 14,
    backgroundColor: teal,
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  chartLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  priorityList: {
    gap: 14,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#F7FBFA',
    padding: 12,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  priorityDotAccent: {
    backgroundColor: teal,
  },
  priorityDotWarning: {
    backgroundColor: '#D6A300',
  },
  priorityDotDanger: {
    backgroundColor: '#C13B3B',
  },
  priorityDotNeutral: {
    backgroundColor: '#7A908D',
  },
  priorityTextWrap: {
    flex: 1,
  },
  priorityTitle: {
    color: '#102A28',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  priorityValue: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});
