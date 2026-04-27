import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { API_BASE_URL, parseApiResponse } from '@/lib/api';
import {
  AdminDriverLocation,
  getAdminSocket,
  requestDriverLocationSnapshot,
} from '@/lib/adminSocket';

const teal = '#008080';
const systemVehicleCategories = ['All', 'Tuk', 'Bike', 'Mini', 'Car', 'Van'] as const;

type DriverUser = {
  id: string;
  fullName: string;
  phoneNumber: string;
  status?: string;
  vehicle?: {
    category?: string;
    make?: string;
    model?: string;
    plateNumber?: string;
  } | null;
};

type DriverLocation = AdminDriverLocation;

type DriverMapRecord = DriverUser & DriverLocation;

export default function LiveMapScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [driverLocations, setDriverLocations] = useState<Record<string, DriverLocation>>({});
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadDrivers = async () => {
      setLoadingDrivers(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`${API_BASE_URL}/driver-auth/drivers`);
        const data = await parseApiResponse<{ drivers: DriverUser[] }>(response);

        if (isMounted) {
          setDrivers(data.drivers);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load driver list.');
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

  const trackedDrivers = useMemo<DriverMapRecord[]>(
    () =>
      drivers
        .map((driver) => {
          const location = driverLocations[driver.id];
          return location ? { ...driver, ...location } : null;
        })
        .filter((driver): driver is DriverMapRecord => Boolean(driver)),
    [drivers, driverLocations]
  );

  const filteredDrivers = useMemo(
    () =>
      selectedCategory === 'All'
        ? trackedDrivers
        : trackedDrivers.filter((driver) => normalizePassengerVehicleCategory(driver) === selectedCategory),
    [selectedCategory, trackedDrivers]
  );

  const onlineDrivers = filteredDrivers.filter((driver) => driver.isOnline);
  const initialRegion =
    filteredDrivers[0]
      ? {
          latitude: filteredDrivers[0].latitude,
          longitude: filteredDrivers[0].longitude,
          latitudeDelta: 0.18,
          longitudeDelta: 0.18,
        }
      : {
          latitude: 6.9271,
          longitude: 79.8612,
          latitudeDelta: 0.22,
          longitudeDelta: 0.22,
        };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Live Driver Monitor</Text>
          <Text style={styles.pageSubtitle}>
            Track driver locations in realtime and watch online fleet coverage across the network.
          </Text>
        </View>

        <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
          <View style={[styles.mapCard, isWide ? styles.mapCardWide : null]}>
            <View style={styles.mapHeader}>
              <View style={styles.mapTitleGroup}>
                <Text style={styles.mapTitle}>Driver Location Map</Text>
                <Text style={styles.mapSubtitle}>
                  Filter the fleet by vehicle category and follow live driver movement.
                </Text>
              </View>
              <View style={styles.mapHeaderSide}>
                <View style={styles.mapBadge}>
                  <Ionicons
                    name={socketConnected ? 'radio-outline' : 'cloud-offline-outline'}
                    size={15}
                    color={teal}
                  />
                  <Text style={styles.mapBadgeText}>{socketConnected ? 'Realtime live' : 'Reconnecting'}</Text>
                </View>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}>
              {systemVehicleCategories.map((category) => {
                const isActive = selectedCategory === category;

                return (
                  <TouchableOpacity
                    key={category}
                    activeOpacity={0.85}
                    onPress={() => setSelectedCategory(category)}
                    style={[
                      styles.filterChip,
                      isActive ? styles.filterChipActive : null,
                      !isActive ? styles.filterChipInactive : null,
                    ]}>
                    <Text
                      style={[
                        styles.filterChipLabel,
                        isActive ? styles.filterChipLabelActive : null,
                        !isActive ? styles.filterChipLabelInactive : null,
                      ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loadingDrivers ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={teal} />
                <Text style={styles.loadingText}>Loading drivers...</Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.errorState}>
                <Ionicons name="alert-circle-outline" size={18} color="#C13B3B" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : (
              <View style={styles.mapShell}>
                <MapView
                  style={styles.map}
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  initialRegion={initialRegion}
                  showsUserLocation={false}
                  showsMyLocationButton={false}>
                  {filteredDrivers.map((driver) => (
                    <Marker
                      key={driver.id}
                      coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
                      title={driver.fullName}
                      description={`${formatVehicle(driver.vehicle)} | ${driver.vehicle?.plateNumber || 'No plate'}`}>
                      <View style={[styles.driverPin, !driver.isOnline ? styles.driverPinOffline : null]}>
                        <Ionicons name="car-sport" size={15} color="#FFFFFF" />
                      </View>
                    </Marker>
                  ))}
                </MapView>

                {filteredDrivers.length === 0 ? (
                  <View style={styles.mapEmptyState}>
                    <Ionicons name="locate-outline" size={24} color={teal} />
                    <Text style={styles.mapEmptyTitle}>
                      {selectedCategory === 'All' ? 'No live drivers yet' : `No ${selectedCategory} drivers live`}
                    </Text>
                    <Text style={styles.mapEmptyText}>
                      {selectedCategory === 'All'
                        ? 'Driver locations will appear here once the driver app starts broadcasting.'
                        : 'Try another category or wait for a driver in this fleet type to come online.'}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={[styles.sideCard, isWide ? styles.sideCardWide : null]}>
            <Text style={styles.sideEyebrow}>LIVE DRIVERS</Text>
            <Text style={styles.sideTitle}>Tracking panel</Text>

            <View style={styles.summaryRow}>
              <SummaryCard label="Tracked" value={String(filteredDrivers.length)} />
              <SummaryCard label="Online" value={String(onlineDrivers.length)} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredDrivers.map((driver) => (
                <View key={driver.id} style={styles.rideCard}>
                  <View style={styles.rideTopRow}>
                    <Text style={styles.rideId}>{driver.fullName}</Text>
                    <View style={[styles.statusPill, !driver.isOnline ? styles.statusPillOffline : null]}>
                      <Text style={[styles.statusPillText, !driver.isOnline ? styles.statusPillTextOffline : null]}>
                        {driver.isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rideName}>{formatVehicle(driver.vehicle)}</Text>
                  <Text style={styles.rideMeta}>{driver.vehicle?.plateNumber || 'No plate'} | {driver.phoneNumber || 'No phone'}</Text>
                </View>
              ))}

              {filteredDrivers.length === 0 && !loadingDrivers && !errorMessage ? (
                <View style={styles.emptyListCard}>
                  <Text style={styles.emptyListText}>
                    {selectedCategory === 'All'
                      ? 'Waiting for live driver location updates.'
                      : `No ${selectedCategory} drivers are available in the live feed right now.`}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function formatVehicle(vehicle: DriverUser['vehicle']) {
  if (!vehicle) {
    return 'Vehicle not added';
  }

  return [vehicle.category, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle added';
}

function normalizePassengerVehicleCategory(driver: DriverMapRecord) {
  const rawCategory = (driver.vehicle?.category || driver.vehicleCategory || '').trim().toLowerCase();

  switch (rawCategory) {
    case 'tuk':
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F7',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  header: {
    marginBottom: 18,
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
    maxWidth: 760,
  },
  layout: {
    flex: 1,
    gap: 16,
  },
  layoutWide: {
    flexDirection: 'row',
  },
  mapCard: {
    borderRadius: 24,
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
  mapCardWide: {
    flex: 2,
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  mapTitleGroup: {
    flex: 1,
    minWidth: 0,
  },
  mapTitle: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
  },
  mapSubtitle: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: 4,
  },
  mapHeaderSide: {
    alignItems: 'flex-end',
  },
  mapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapBadgeText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  filterRow: {
    gap: 10,
    paddingBottom: 12,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: teal,
    borderColor: teal,
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE8E7',
  },
  filterChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipLabelActive: {
    color: '#FFFFFF',
  },
  filterChipLabelInactive: {
    color: '#4C6664',
  },
  loadingState: {
    minHeight: 520,
    borderRadius: 22,
    backgroundColor: '#F7FBFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '600',
  },
  errorState: {
    minHeight: 520,
    borderRadius: 22,
    backgroundColor: '#FFF4F4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  errorText: {
    color: '#C13B3B',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  mapShell: {
    minHeight: 520,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E8F0EF',
  },
  map: {
    flex: 1,
    minHeight: 520,
  },
  mapEmptyState: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    padding: 14,
    alignItems: 'center',
  },
  mapEmptyTitle: {
    color: '#102A28',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  mapEmptyText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  driverPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: teal,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  driverPinOffline: {
    backgroundColor: '#93A5A2',
  },
  sideCard: {
    borderRadius: 24,
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
  sideCardWide: {
    flex: 1,
    maxWidth: 360,
  },
  sideEyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  sideTitle: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
  },
  rideCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
    marginBottom: 12,
  },
  rideTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  rideId: {
    color: '#102A28',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillOffline: {
    backgroundColor: '#EDF1F0',
  },
  statusPillText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillTextOffline: {
    color: '#617C79',
  },
  rideName: {
    color: '#102A28',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  rideMeta: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  emptyListCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
  },
  emptyListText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
});
