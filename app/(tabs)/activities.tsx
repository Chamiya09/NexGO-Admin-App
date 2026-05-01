import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

const teal = '#008080';
const tripFilters = [
  { label: 'All', value: 'All', icon: 'layers-outline' as const },
  { label: 'Pending', value: 'Pending', icon: 'time-outline' as const },
  { label: 'Accepted', value: 'Accepted', icon: 'checkmark-circle-outline' as const },
  { label: 'Arrived', value: 'Arrived', icon: 'location-outline' as const },
  { label: 'In Progress', value: 'InProgress', icon: 'navigate-outline' as const },
  { label: 'Completed', value: 'Completed', icon: 'checkmark-done-outline' as const },
  { label: 'Cancelled', value: 'Cancelled', icon: 'close-circle-outline' as const },
] as const;

type TripFilter = (typeof tripFilters)[number]['value'];
type RideStatus = Exclude<TripFilter, 'All'>;

type AdminTrip = {
  id: string;
  passenger?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
  driver?: {
    fullName?: string;
    phoneNumber?: string;
    vehicle?: {
      category?: string;
      plateNumber?: string;
      make?: string;
      model?: string;
    } | null;
  } | null;
  pickup?: {
    name?: string;
  };
  dropoff?: {
    name?: string;
  };
  vehicleType: string;
  price: number;
  status: RideStatus;
  canonicalStatus?: string;
  requestedAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
};

const getStatusTone = (status: string) => {
  if (status === 'Completed') return { text: '#157A62', bg: '#E8F7F0', icon: 'checkmark-done-outline' as const };
  if (status === 'Cancelled') return { text: '#C13B3B', bg: '#FFF1F1', icon: 'close-circle-outline' as const };
  if (status === 'Pending') return { text: '#B27A00', bg: '#FFF7E2', icon: 'time-outline' as const };
  if (status === 'InProgress') return { text: teal, bg: '#E7F5F3', icon: 'navigate-outline' as const };
  return { text: teal, bg: '#E7F5F3', icon: 'radio-button-on-outline' as const };
};

export default function AdminActivitiesScreen() {
  const [activeFilter, setActiveFilter] = useState<TripFilter>('All');
  const [trips, setTrips] = useState<AdminTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await authFetch(`${API_BASE_URL}/rides/admin/trips`);
      const data = await parseApiResponse<{ trips: AdminTrip[] }>(response);
      setTrips(data.trips ?? []);
    } catch (error) {
      setTrips([]);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTrips();
    }, [loadTrips])
  );

  const filteredTrips = useMemo(
    () => (activeFilter === 'All' ? trips : trips.filter((trip) => trip.status === activeFilter)),
    [activeFilter, trips]
  );

  const summaryCards = useMemo(() => {
    const activeCount = trips.filter((trip) => ['Pending', 'Accepted', 'Arrived', 'InProgress'].includes(trip.status)).length;
    const completedCount = trips.filter((trip) => trip.status === 'Completed').length;
    const revenue = trips
      .filter((trip) => trip.status === 'Completed')
      .reduce((total, trip) => total + Number(trip.price || 0), 0);

    return [
      { label: 'Active Trips', value: String(activeCount), icon: 'navigate-outline' as const },
      { label: 'Completed', value: String(completedCount), icon: 'checkmark-done-outline' as const },
      { label: 'Revenue', value: formatMoney(revenue), icon: 'cash-outline' as const },
    ];
  }, [trips]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onRefreshPage={loadTrips}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TRIP ACTIVITY</Text>
          <Text style={styles.pageTitle}>All Trips & Activities</Text>
          <Text style={styles.pageSubtitle}>
            Review every ride request, active trip, completion, and cancellation across the NexGO system.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>SYSTEM RIDES</Text>
              <Text style={styles.heroTitle}>Activity control board</Text>
            </View>
            <View style={styles.heroPill}>
              <Ionicons name="pulse-outline" size={15} color={teal} />
              <Text style={styles.heroPillText}>Live history</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            {summaryCards.map((card) => (
              <View key={card.label} style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <Ionicons name={card.icon} size={18} color={teal} />
                </View>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                  {card.value}
                </Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trip Timeline</Text>
          <Text style={styles.sectionSubtitle}>Filter all system rides by their current operating state</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {tripFilters.map((filter) => {
            const isActive = activeFilter === filter.value;
            const filterCount =
              filter.value === 'All' ? trips.length : trips.filter((trip) => trip.status === filter.value).length;

            return (
              <Pressable
                key={filter.value}
                style={[styles.filterChip, isActive ? styles.filterChipActive : styles.filterChipInactive]}
                onPress={() => setActiveFilter(filter.value)}>
                <Ionicons
                  name={filter.icon}
                  size={13}
                  color={isActive ? '#FFFFFF' : '#4C6664'}
                />
                <Text
                  style={[styles.filterChipText, isActive ? styles.filterChipTextActive : styles.filterChipTextInactive]}
                  numberOfLines={1}>
                  {filter.label}
                </Text>
                <View style={[styles.filterCountBadge, isActive ? styles.filterCountBadgeActive : null]}>
                  <Text style={[styles.filterCountText, isActive ? styles.filterCountTextActive : null]}>
                    {filterCount}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>Loading trips...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="alert-circle-outline" size={30} color="#C13B3B" />
            <Text style={styles.emptyStateTitle}>Trips could not load</Text>
            <Text style={styles.emptyStateText}>{errorMessage}</Text>
            <Pressable style={styles.retryButton} onPress={loadTrips}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : filteredTrips.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="map-outline" size={30} color={teal} />
            <Text style={styles.emptyStateTitle}>No trips found</Text>
            <Text style={styles.emptyStateText}>System trips will appear here as passengers request rides.</Text>
          </View>
        ) : (
          filteredTrips.map((trip) => {
            const tone = getStatusTone(trip.status);
            const routeLabel = `${trip.pickup?.name || 'Pickup'} to ${trip.dropoff?.name || 'Dropoff'}`;

            return (
              <View key={trip.id} style={styles.tripCard}>
                <View style={[styles.tripAccent, { backgroundColor: tone.text }]} />
                <View style={styles.tripTopRow}>
                  <View style={styles.tripIdentityRow}>
                    <View style={styles.tripIconWrap}>
                      <Ionicons name="car-sport-outline" size={18} color={teal} />
                    </View>
                    <View style={styles.tripTitleWrap}>
                      <Text style={styles.tripTitle} numberOfLines={1}>
                        {routeLabel}
                      </Text>
                      <Text style={styles.tripSource} numberOfLines={1}>
                        {formatTripParty(trip)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                    <Ionicons name={tone.icon} size={12} color={tone.text} />
                    <Text style={[styles.statusBadgeText, { color: tone.text }]}>{trip.status}</Text>
                  </View>
                </View>

                <View style={styles.tripInfoPanel}>
                  <View style={styles.infoPill}>
                    <Ionicons name="pricetag-outline" size={13} color={teal} />
                    <Text style={styles.infoPillText}>{trip.vehicleType || 'Vehicle'}</Text>
                  </View>
                  <View style={styles.referencePill}>
                    <Ionicons name="cash-outline" size={13} color="#617C79" />
                    <Text style={styles.referenceText}>{formatMoney(trip.price)}</Text>
                  </View>
                  {trip.driver?.vehicle?.plateNumber ? (
                    <View style={styles.referencePill}>
                      <Ionicons name="barcode-outline" size={13} color="#617C79" />
                      <Text style={styles.referenceText}>{trip.driver.vehicle.plateNumber}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.tripFooter}>
                  <Text style={styles.tripTime}>{formatTripTime(trip)}</Text>
                  <Text style={styles.tripId} selectable>
                    {formatTripId(trip.id)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

function formatMoney(value: number) {
  return `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`;
}

function formatTripId(id: string) {
  return `Trip ${id.slice(-6).toUpperCase()}`;
}

function formatTripParty(trip: AdminTrip) {
  const passenger = trip.passenger?.fullName || 'Passenger';
  const driver = trip.driver?.fullName || 'Driver not assigned';
  return `${passenger} | ${driver}`;
}

function formatTripTime(trip: AdminTrip) {
  const date = new Date(trip.completedAt || trip.acceptedAt || trip.requestedAt);
  if (Number.isNaN(date.getTime())) {
    return 'Recently updated';
  }

  return `${trip.status} ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F7',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
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
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  heroTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  heroTitle: {
    color: '#123532',
    fontSize: 20,
    fontWeight: '800',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexShrink: 0,
  },
  heroPillText: {
    color: teal,
    fontSize: 10,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    color: '#123532',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#123532',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '500',
  },
  filterRow: {
    gap: 10,
    paddingBottom: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  filterChipActive: {
    backgroundColor: teal,
    borderColor: teal,
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DFE8E7',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextInactive: {
    color: '#4C6664',
  },
  filterCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterCountBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  filterCountText: {
    color: teal,
    fontSize: 10,
    fontWeight: '900',
  },
  filterCountTextActive: {
    color: teal,
  },
  emptyStateCard: {
    minHeight: 170,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  emptyStateTitle: {
    color: '#123532',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: teal,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  tripCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  tripAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  tripTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tripIdentityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  tripIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  tripTitle: {
    color: '#123532',
    fontSize: 15,
    fontWeight: '800',
  },
  tripSource: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tripInfoPanel: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  infoPill: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoPillText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  referencePill: {
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  referenceText: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  tripTime: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '600',
  },
  tripId: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
});
