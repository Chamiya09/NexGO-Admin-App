import React from 'react';
import {
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { AdminAnalyticsOverview } from '@/components/AdminAnalyticsOverview';
import { AdminLiveMap } from '@/components/AdminLiveMap';

const teal = '#008080';

export default function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;

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

        <AdminAnalyticsOverview />

        <AdminLiveMap />

      </RefreshableScrollView>
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
  }
});
