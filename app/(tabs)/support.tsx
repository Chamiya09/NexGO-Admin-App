import React, { useMemo, useState } from 'react';
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

const teal = '#008080';

const summaryCards = [
  { label: 'Open Tickets', value: '18', icon: 'mail-unread-outline' as const },
  { label: 'Urgent Cases', value: '4', icon: 'alert-circle-outline' as const },
  { label: 'Resolved Today', value: '11', icon: 'checkmark-done-outline' as const },
];

const ticketFilters = ['All', 'Open', 'Urgent', 'Resolved'] as const;

const supportTickets = [
  {
    id: 'SUP-204',
    title: 'Driver complained about payment mismatch',
    source: 'Driver',
    priority: 'Urgent',
    status: 'Open',
    detail: 'Trip payout total does not match the completed fare breakdown from the ride summary.',
    time: '12 min ago',
  },
  {
    id: 'SUP-198',
    title: 'Passenger reported unsafe driving behavior',
    source: 'Passenger',
    priority: 'Urgent',
    status: 'Open',
    detail: 'Complaint submitted after trip completion with request for follow-up from support.',
    time: '34 min ago',
  },
  {
    id: 'SUP-191',
    title: 'Promo discount not applied during checkout',
    source: 'Passenger',
    priority: 'Normal',
    status: 'Open',
    detail: 'Discount code accepted but final fare calculation did not reflect the promotion.',
    time: '1 hr ago',
  },
  {
    id: 'SUP-176',
    title: 'Account verification inquiry from new driver',
    source: 'Driver',
    priority: 'Normal',
    status: 'Resolved',
    detail: 'Driver contacted support to confirm document review timeline and onboarding status.',
    time: 'Resolved 2 hrs ago',
  },
];

type FilterValue = (typeof ticketFilters)[number];

export default function AdminSupportScreen() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>('All');

  const filteredTickets = useMemo(() => {
    if (activeFilter === 'All') {
      return supportTickets;
    }

    return supportTickets.filter((ticket) => ticket.status === activeFilter || ticket.priority === activeFilter);
  }, [activeFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Complaint & Support Tickets</Text>
          <Text style={styles.pageSubtitle}>
            Track escalations, monitor active complaints, and manage support follow-ups from one place.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>SUPPORT DESK</Text>
              <Text style={styles.heroTitle}>Admin service board</Text>
            </View>
            <View style={styles.heroPill}>
              <Ionicons name="headset-outline" size={15} color={teal} />
              <Text style={styles.heroPillText}>Realtime queue</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            {summaryCards.map((card) => (
              <View key={card.label} style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <Ionicons name={card.icon} size={18} color={teal} />
                </View>
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ticket Queue</Text>
          <Text style={styles.sectionSubtitle}>Filter complaints by current admin handling state</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}>
          {ticketFilters.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <Pressable
                key={filter}
                style={[styles.filterChip, isActive ? styles.filterChipActive : styles.filterChipInactive]}
                onPress={() => setActiveFilter(filter)}>
                <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : styles.filterChipTextInactive]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {filteredTickets.map((ticket) => {
          const isUrgent = ticket.priority === 'Urgent';
          const isResolved = ticket.status === 'Resolved';

          return (
            <View key={ticket.id} style={styles.ticketCard}>
              <View style={styles.ticketTopRow}>
                <View style={styles.ticketIdWrap}>
                  <Text style={styles.ticketId}>{ticket.id}</Text>
                  <Text style={styles.ticketSource}>{ticket.source}</Text>
                </View>

                <View style={styles.ticketBadgeRow}>
                  <View style={[styles.ticketBadge, isUrgent ? styles.ticketBadgeUrgent : styles.ticketBadgeNormal]}>
                    <Text style={[styles.ticketBadgeText, isUrgent ? styles.ticketBadgeTextUrgent : styles.ticketBadgeTextNormal]}>
                      {ticket.priority}
                    </Text>
                  </View>
                  <View style={[styles.ticketBadge, isResolved ? styles.ticketBadgeResolved : styles.ticketBadgeOpen]}>
                    <Text style={[styles.ticketBadgeText, isResolved ? styles.ticketBadgeTextResolved : styles.ticketBadgeTextOpen]}>
                      {ticket.status}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.ticketTitle}>{ticket.title}</Text>
              <Text style={styles.ticketDetail}>{ticket.detail}</Text>

              <View style={styles.ticketFooter}>
                <Text style={styles.ticketTime}>{ticket.time}</Text>
                <Pressable style={styles.ticketAction}>
                  <Text style={styles.ticketActionText}>Review Ticket</Text>
                  <Ionicons name="arrow-forward" size={15} color={teal} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 16,
  },
  pageTitle: {
    color: '#123532',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: teal,
    fontSize: 11,
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
    paddingHorizontal: 10,
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
    paddingHorizontal: 16,
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
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
  },
  ticketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ticketIdWrap: {
    flex: 1,
  },
  ticketId: {
    color: teal,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  ticketSource: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ticketBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ticketBadgeUrgent: {
    backgroundColor: '#FFF1F1',
  },
  ticketBadgeNormal: {
    backgroundColor: '#EEF6F5',
  },
  ticketBadgeResolved: {
    backgroundColor: '#E8F7F0',
  },
  ticketBadgeOpen: {
    backgroundColor: '#FFF7E2',
  },
  ticketBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  ticketBadgeTextUrgent: {
    color: '#C13B3B',
  },
  ticketBadgeTextNormal: {
    color: teal,
  },
  ticketBadgeTextResolved: {
    color: '#157A62',
  },
  ticketBadgeTextOpen: {
    color: '#B27A00',
  },
  ticketTitle: {
    color: '#123532',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  ticketDetail: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  ticketTime: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '600',
  },
  ticketAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketActionText: {
    color: teal,
    fontSize: 12,
    fontWeight: '800',
  },
});
