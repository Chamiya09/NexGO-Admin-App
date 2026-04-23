import React from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const teal = '#008080';

const activeRides = [
  { id: 'R-2201', driver: 'Kasun Jayasinghe', passenger: 'Ayesha Perera', status: 'In Transit' },
  { id: 'R-2202', driver: 'Dinesh Silva', passenger: 'Nimal Fernando', status: 'Searching' },
  { id: 'R-2203', driver: 'Tharindu Kumar', passenger: 'Shenal De Mel', status: 'Arriving' },
  { id: 'R-2204', driver: 'Ranga Peris', passenger: 'Madhavi K', status: 'In Transit' },
];

export default function LiveMapScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Live Ride Monitor</Text>
          <Text style={styles.pageSubtitle}>
            Track active ride flow, dispatch status, and operator visibility across the network.
          </Text>
        </View>

        <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
          <View style={[styles.mapCard, isWide ? styles.mapCardWide : null]}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapTitle}>Google Maps Live View</Text>
              <View style={styles.mapBadge}>
                <Ionicons name="locate-outline" size={15} color={teal} />
                <Text style={styles.mapBadgeText}>Realtime placeholder</Text>
              </View>
            </View>

            <View style={styles.mapPlaceholder}>
              <View style={[styles.mapRoad, styles.mapRoadPrimary]} />
              <View style={[styles.mapRoad, styles.mapRoadSecondary]} />
              <View style={[styles.mapRoad, styles.mapRoadTertiary]} />
              <View style={[styles.mapPin, styles.mapPinDriver]}>
                <Ionicons name="car-sport" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.mapPin, styles.mapPinPassenger]}>
                <Ionicons name="person" size={15} color="#FFFFFF" />
              </View>
              <Text style={styles.mapOverlayText}>Large live map placeholder for ride supervision</Text>
            </View>
          </View>

          <View style={[styles.sideCard, isWide ? styles.sideCardWide : null]}>
            <Text style={styles.sideEyebrow}>ACTIVE RIDES</Text>
            <Text style={styles.sideTitle}>Dispatch side panel</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {activeRides.map((ride) => (
                <View key={ride.id} style={styles.rideCard}>
                  <View style={styles.rideTopRow}>
                    <Text style={styles.rideId}>{ride.id}</Text>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusPillText}>{ride.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.rideName}>Driver: {ride.driver}</Text>
                  <Text style={styles.rideMeta}>Passenger: {ride.passenger}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
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
    alignItems: 'center',
    marginBottom: 14,
  },
  mapTitle: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
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
  mapPlaceholder: {
    minHeight: 520,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E8F0EF',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapRoad: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E9E6',
    borderWidth: 1,
  },
  mapRoadPrimary: {
    width: 96,
    height: '130%',
    left: '48%',
    top: -90,
    transform: [{ rotate: '28deg' }],
  },
  mapRoadSecondary: {
    width: '130%',
    height: 62,
    left: -80,
    top: '36%',
    transform: [{ rotate: '-10deg' }],
  },
  mapRoadTertiary: {
    width: '120%',
    height: 52,
    left: -50,
    top: '67%',
    transform: [{ rotate: '14deg' }],
  },
  mapPin: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mapPinDriver: {
    top: '38%',
    left: '45%',
    backgroundColor: teal,
  },
  mapPinPassenger: {
    top: '54%',
    left: '58%',
    backgroundColor: '#C13B3B',
  },
  mapOverlayText: {
    color: '#3F5E5B',
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
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
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusPillText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
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
});
