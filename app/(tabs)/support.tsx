import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, parseApiResponse } from '@/lib/api';

const teal = '#008080';

const requesterFilters = ['Passenger', 'Driver'] as const;
const supportStatuses = ['Pending', 'Open', 'In Review', 'Resolved', 'Closed'] as const;
const ticketFilters = ['All', ...supportStatuses, 'Urgent'] as const;

type RequesterFilterValue = (typeof requesterFilters)[number];
type FilterValue = (typeof ticketFilters)[number];
type SupportStatusValue = (typeof supportStatuses)[number];

const getStatusTone = (status: AdminSupportTicket['status']) => {
  if (status === 'Pending') return { text: '#B27A00', bg: '#FFF7E2', icon: 'time-outline' as const };
  if (status === 'Resolved') return { text: '#157A62', bg: '#E8F7F0', icon: 'checkmark-done-outline' as const };
  if (status === 'Closed') return { text: '#667085', bg: '#F2F4F7', icon: 'lock-closed-outline' as const };
  if (status === 'In Review') return { text: '#B27A00', bg: '#FFF7E2', icon: 'hourglass-outline' as const };
  return { text: teal, bg: '#E7F5F3', icon: 'radio-button-on-outline' as const };
};

type AdminSupportTicket = {
  id: string;
  requesterType?: 'Passenger' | 'Driver';
  passenger?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
  driver?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
  topic: string;
  subject: string;
  description: string;
  rideReference: string;
  priority: 'Normal' | 'Urgent';
  status: 'Pending' | 'Open' | 'In Review' | 'Resolved' | 'Closed';
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export default function AdminSupportScreen() {
  const [activeRequesterFilter, setActiveRequesterFilter] = useState<RequesterFilterValue>('Passenger');
  const [activeFilter, setActiveFilter] = useState<FilterValue>('All');
  const [supportTickets, setSupportTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicket | null>(null);
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [statusUpdatingTicketId, setStatusUpdatingTicketId] = useState<string | null>(null);
  const [adminNoteDraft, setAdminNoteDraft] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/support-tickets/admin`);
      const data = await parseApiResponse<{ tickets: AdminSupportTicket[] }>(response);
      setSupportTickets(data.tickets ?? []);
    } catch {
      setSupportTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadTickets();
    }, [loadTickets])
  );

  const filteredTickets = useMemo(() => {
    const requesterTickets = supportTickets.filter((ticket) => {
      const requesterType = ticket.requesterType || (ticket.driver ? 'Driver' : 'Passenger');
      return requesterType === activeRequesterFilter;
    });

    if (activeFilter === 'All') {
      return requesterTickets;
    }

    return requesterTickets.filter((ticket) => ticket.status === activeFilter || ticket.priority === activeFilter);
  }, [activeFilter, activeRequesterFilter, supportTickets]);

  const summaryCards = useMemo(() => {
    const today = new Date().toDateString();
    const requesterTickets = supportTickets.filter((ticket) => {
      const requesterType = ticket.requesterType || (ticket.driver ? 'Driver' : 'Passenger');
      return requesterType === activeRequesterFilter;
    });
    const openCount = requesterTickets.filter((ticket) =>
      ['Pending', 'Open', 'In Review'].includes(ticket.status)
    ).length;
    const urgentCount = requesterTickets.filter((ticket) => ticket.priority === 'Urgent').length;
    const resolvedTodayCount = requesterTickets.filter(
      (ticket) => ticket.status === 'Resolved' && ticket.resolvedAt && new Date(ticket.resolvedAt).toDateString() === today
    ).length;

    return [
      { label: `${activeRequesterFilter} Pending`, value: String(openCount), icon: 'mail-unread-outline' as const },
      { label: `${activeRequesterFilter} Urgent`, value: String(urgentCount), icon: 'alert-circle-outline' as const },
      { label: 'Resolved Today', value: String(resolvedTodayCount), icon: 'checkmark-done-outline' as const },
    ];
  }, [activeRequesterFilter, supportTickets]);

  const formatTicketTime = (ticket: AdminSupportTicket) => {
    const sourceDate = ticket.resolvedAt || ticket.updatedAt || ticket.createdAt;
    const date = new Date(sourceDate);

    if (Number.isNaN(date.getTime())) {
      return 'Recently updated';
    }

    const label = ticket.status === 'Resolved' || ticket.status === 'Closed' ? ticket.status : ticket.status;
    return `${label} ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  const getPassengerLabel = (ticket: AdminSupportTicket) => {
    const requester = ticket.requesterType === 'Driver' ? ticket.driver : ticket.passenger;
    const name = requester?.fullName?.trim();
    const email = requester?.email?.trim();
    const label = ticket.requesterType === 'Driver' ? 'Driver' : 'Passenger';

    if (name && email) {
      return `${label}: ${name} | ${email}`;
    }

    return name ? `${label}: ${name}` : email ? `${label}: ${email}` : label;
  };

  const openTicketReview = (ticket: AdminSupportTicket) => {
    setSelectedTicket(ticket);
    setAdminNoteDraft(ticket.adminNote || '');
  };

  const updateTicketStatus = async (ticket: AdminSupportTicket, status: SupportStatusValue) => {
    if (statusUpdatingTicketId) return;

    setStatusUpdatingTicketId(ticket.id);
    try {
      const response = await fetch(`${API_BASE_URL}/support-tickets/admin/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: adminNoteDraft.trim() }),
      });
      const data = await parseApiResponse<{ ticket: AdminSupportTicket }>(response);

      setSupportTickets((current) => current.map((item) => (item.id === data.ticket.id ? data.ticket : item)));
      setSelectedTicket(data.ticket);
      setAdminNoteDraft(data.ticket.adminNote || '');
    } finally {
      setStatusUpdatingTicketId(null);
    }
  };

  const resolveTicket = async (ticket: AdminSupportTicket) => {
    if (resolvingTicketId) return;

    setResolvingTicketId(ticket.id);
    try {
      await updateTicketStatus(ticket, 'Resolved');
    } finally {
      setResolvingTicketId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onRefreshPage={loadTickets}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Complaint & Support Tickets</Text>
          <Text style={styles.pageSubtitle}>
            Track escalations, monitor active complaints, and manage support follow-ups from one place.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
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
          <Text style={styles.sectionSubtitle}>Select passenger or driver support, then filter by current handling state</Text>
        </View>

        <View style={styles.requesterSelector}>
          {requesterFilters.map((filter) => {
            const isActive = activeRequesterFilter === filter;
            const ticketCount = supportTickets.filter((ticket) => {
              const requesterType = ticket.requesterType || (ticket.driver ? 'Driver' : 'Passenger');
              return requesterType === filter;
            }).length;

            return (
              <Pressable
                key={filter}
                style={[styles.requesterOption, isActive && styles.requesterOptionActive]}
                onPress={() => setActiveRequesterFilter(filter)}>
                <View style={styles.requesterContent}>
                  <View style={[styles.requesterIcon, isActive && styles.requesterIconActive]}>
                    <Ionicons
                      name={filter === 'Passenger' ? 'person-outline' : 'car-sport-outline'}
                      size={15}
                      color={isActive ? teal : '#617C79'}
                    />
                  </View>
                  <View style={styles.requesterTextWrap}>
                    <Text
                      style={[styles.requesterTitle, isActive && styles.requesterTitleActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit>
                      {filter} Support
                    </Text>
                    <Text style={[styles.requesterSubtitle, isActive && styles.requesterSubtitleActive]} numberOfLines={1}>
                      Support queue
                    </Text>
                  </View>
                </View>
                <View style={[styles.requesterCountBadge, isActive && styles.requesterCountBadgeActive]}>
                  <Text style={[styles.requesterCountText, isActive && styles.requesterCountTextActive]}>
                    {ticketCount}
                  </Text>
                </View>
              </Pressable>
            );
          })}
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

        {loading ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateTitle}>Loading support tickets...</Text>
          </View>
        ) : filteredTickets.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="file-tray-outline" size={30} color={teal} />
            <Text style={styles.emptyStateTitle}>No tickets found</Text>
            <Text style={styles.emptyStateText}>
              {activeRequesterFilter} support tickets will appear here after they are opened.
            </Text>
          </View>
        ) : filteredTickets.map((ticket) => {
          const isUrgent = ticket.priority === 'Urgent';
          const statusTone = getStatusTone(ticket.status);

          return (
            <View key={ticket.id} style={styles.ticketCard}>
              <View style={[styles.ticketAccent, { backgroundColor: isUrgent ? '#C13B3B' : teal }]} />
              <View style={styles.ticketTopRow}>
                <View style={styles.ticketIdentityRow}>
                  <View style={styles.ticketIconWrap}>
                    <Ionicons name="chatbox-ellipses-outline" size={18} color={teal} />
                  </View>
                  <View style={styles.ticketIdWrap}>
                    <Text style={styles.ticketTitle}>{ticket.subject}</Text>
                    <Text style={styles.ticketSource} numberOfLines={1}>{getPassengerLabel(ticket)}</Text>
                  </View>
                </View>

                <View style={styles.ticketBadgeRow}>
                  <View style={[styles.ticketBadge, isUrgent ? styles.ticketBadgeUrgent : styles.ticketBadgeNormal]}>
                    <Ionicons
                      name={isUrgent ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                      size={12}
                      color={isUrgent ? '#C13B3B' : teal}
                    />
                    <Text style={[styles.ticketBadgeText, isUrgent ? styles.ticketBadgeTextUrgent : styles.ticketBadgeTextNormal]}>
                      {ticket.priority}
                    </Text>
                  </View>
                  <View style={[styles.ticketBadge, { backgroundColor: statusTone.bg }]}>
                    <Ionicons name={statusTone.icon} size={12} color={statusTone.text} />
                    <Text style={[styles.ticketBadgeText, { color: statusTone.text }]}>
                      {ticket.status}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.ticketDetail} numberOfLines={3}>{ticket.description}</Text>

              <View style={styles.ticketInfoPanel}>
                <View style={styles.topicPill}>
                  <Ionicons name="albums-outline" size={13} color={teal} />
                  <Text style={styles.topicPillText}>{ticket.topic}</Text>
                </View>
                {!!ticket.rideReference && (
                  <View style={styles.referencePill}>
                    <Ionicons name="receipt-outline" size={13} color="#617C79" />
                    <Text style={styles.rideReference} selectable>
                      Ride {ticket.rideReference}
                    </Text>
                  </View>
                )}
              </View>

              {!!ticket.adminNote && (
                <View style={styles.adminNoteBox}>
                  <Text style={styles.adminNoteLabel}>Admin note</Text>
                  <Text style={styles.adminNoteText}>{ticket.adminNote}</Text>
                </View>
              )}

              <View style={styles.ticketFooter}>
                <Text style={styles.ticketTime}>{formatTicketTime(ticket)}</Text>
                <Pressable style={styles.ticketAction} onPress={() => openTicketReview(ticket)}>
                  <Text style={styles.ticketActionText}>Review</Text>
                  <Ionicons name="arrow-forward" size={15} color={teal} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </RefreshableScrollView>

      <Modal
        visible={Boolean(selectedTicket)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTicket(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedTicket ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleWrap}>
                    <Text style={styles.modalTitle}>{selectedTicket.subject}</Text>
                    <Text style={styles.modalSubtitle}>{getPassengerLabel(selectedTicket)}</Text>
                  </View>
                  <Pressable style={styles.modalCloseButton} onPress={() => setSelectedTicket(null)}>
                    <Ionicons name="close" size={20} color="#617C79" />
                  </Pressable>
                </View>

                <View style={styles.modalBadgeRow}>
                  <View style={[styles.ticketBadge, selectedTicket.priority === 'Urgent' ? styles.ticketBadgeUrgent : styles.ticketBadgeNormal]}>
                    <Text
                      style={[
                        styles.ticketBadgeText,
                        selectedTicket.priority === 'Urgent' ? styles.ticketBadgeTextUrgent : styles.ticketBadgeTextNormal,
                      ]}>
                      {selectedTicket.priority}
                    </Text>
                  </View>
                  <View style={[styles.ticketBadge, selectedTicket.status === 'Resolved' ? styles.ticketBadgeResolved : styles.ticketBadgeOpen]}>
                    <Text
                      style={[
                        styles.ticketBadgeText,
                        selectedTicket.status === 'Resolved' ? styles.ticketBadgeTextResolved : styles.ticketBadgeTextOpen,
                      ]}>
                      {selectedTicket.status}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalSectionLabel}>{selectedTicket.requesterType === 'Driver' ? 'Driver' : 'Passenger'}</Text>
                <Text style={styles.modalInfoText} selectable>
                  {getPassengerLabel(selectedTicket)}
                </Text>

                <Text style={styles.modalSectionLabel}>Topic</Text>
                <Text style={styles.modalInfoText}>{selectedTicket.topic}</Text>

                {!!selectedTicket.rideReference && (
                  <>
                    <Text style={styles.modalSectionLabel}>Ride Reference</Text>
                    <Text style={styles.modalInfoText} selectable>
                      {selectedTicket.rideReference}
                    </Text>
                  </>
                )}

                <Text style={styles.modalSectionLabel}>Complaint Details</Text>
                <Text style={styles.modalDescription}>{selectedTicket.description}</Text>

                <View style={styles.statusManagerCard}>
                  <View style={styles.statusManagerHeader}>
                    <View>
                      <Text style={styles.statusManagerEyebrow}>REALTIME QUEUE</Text>
                      <Text style={styles.statusManagerTitle}>Status Management</Text>
                    </View>
                    <View style={styles.statusManagerLivePill}>
                      <Ionicons name="radio-button-on-outline" size={12} color={teal} />
                      <Text style={styles.statusManagerLiveText}>Live</Text>
                    </View>
                  </View>

                  <View style={styles.statusOptionGrid}>
                    {supportStatuses.map((status) => {
                      const isActive = selectedTicket.status === status;
                      const tone = getStatusTone(status);

                      return (
                        <Pressable
                          key={status}
                          disabled={statusUpdatingTicketId === selectedTicket.id || isActive}
                          style={[
                            styles.statusOption,
                            isActive && styles.statusOptionActive,
                            statusUpdatingTicketId === selectedTicket.id && styles.statusOptionDisabled,
                          ]}
                          onPress={() => {
                            void updateTicketStatus(selectedTicket, status);
                          }}>
                          <Ionicons name={tone.icon} size={14} color={isActive ? '#FFFFFF' : tone.text} />
                          <Text style={[styles.statusOptionText, isActive && styles.statusOptionTextActive]}>
                            {status}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.statusNoteLabel}>Admin Note</Text>
                  <TextInput
                    value={adminNoteDraft}
                    onChangeText={setAdminNoteDraft}
                    placeholder="Add update note for this ticket"
                    placeholderTextColor="#8AA09D"
                    multiline
                    style={styles.statusNoteInput}
                  />
                </View>

                <View style={styles.modalActions}>
                  <Pressable style={styles.modalSecondaryButton} onPress={() => setSelectedTicket(null)}>
                    <Text style={styles.modalSecondaryButtonText}>Close</Text>
                  </Pressable>
                  <Pressable
                    disabled={selectedTicket.status === 'Resolved' || resolvingTicketId === selectedTicket.id}
                    style={[
                      styles.modalResolveButton,
                      (selectedTicket.status === 'Resolved' || resolvingTicketId === selectedTicket.id) && styles.modalResolveButtonDisabled,
                    ]}
                    onPress={() => {
                      void resolveTicket(selectedTicket);
                    }}>
                    {resolvingTicketId === selectedTicket.id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
                    )}
                    <Text style={styles.modalResolveButtonText}>
                      {selectedTicket.status === 'Resolved' ? 'Resolved' : 'Resolve'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  requesterSelector: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 5,
    gap: 5,
    marginBottom: 12,
  },
  requesterOption: {
    flex: 1,
    minHeight: 62,
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  requesterOptionActive: {
    backgroundColor: teal,
  },
  requesterContent: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  requesterIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#F2F7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterIconActive: {
    backgroundColor: '#FFFFFF',
  },
  requesterTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  requesterTitle: {
    color: '#123532',
    fontSize: 11,
    fontWeight: '900',
  },
  requesterTitleActive: {
    color: '#FFFFFF',
  },
  requesterSubtitle: {
    color: '#617C79',
    fontSize: 9,
    fontWeight: '700',
  },
  requesterSubtitleActive: {
    color: '#D8EFED',
  },
  requesterCountBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  requesterCountBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  requesterCountText: {
    color: teal,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  requesterCountTextActive: {
    color: teal,
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
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ticketAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  ticketTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ticketIdentityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ticketIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketIdWrap: {
    flex: 1,
  },
  ticketSource: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
  },
  ticketBadgeRow: {
    alignItems: 'flex-end',
    gap: 8,
  },
  ticketBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  },
  ticketDetail: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 12,
  },
  ticketInfoPanel: {
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
  topicPill: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  topicPillText: {
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
  rideReference: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
  },
  adminNoteBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 10,
    marginBottom: 12,
    gap: 3,
  },
  adminNoteLabel: {
    color: '#123532',
    fontSize: 11,
    fontWeight: '800',
  },
  adminNoteText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
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
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  ticketActionText: {
    color: teal,
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 53, 50, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    padding: 16,
    maxHeight: '86%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  modalTitleWrap: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: '#123532',
    fontSize: 18,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F6F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modalSectionLabel: {
    color: '#123532',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 3,
  },
  modalInfoText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  modalDescription: {
    color: '#617C79',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  statusManagerCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 12,
    marginTop: 14,
  },
  statusManagerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  statusManagerEyebrow: {
    color: teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  statusManagerTitle: {
    color: '#123532',
    fontSize: 14,
    fontWeight: '900',
  },
  statusManagerLivePill: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusManagerLiveText: {
    color: teal,
    fontSize: 10,
    fontWeight: '900',
  },
  statusOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statusOption: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusOptionActive: {
    borderColor: teal,
    backgroundColor: teal,
  },
  statusOptionDisabled: {
    opacity: 0.7,
  },
  statusOptionText: {
    color: '#4C6664',
    fontSize: 11,
    fontWeight: '900',
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  statusNoteLabel: {
    color: '#123532',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  statusNoteInput: {
    minHeight: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    color: '#123532',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: 11,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  modalNoteBox: {
    borderRadius: 12,
    backgroundColor: '#F7FBFA',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    padding: 10,
    marginTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '900',
  },
  modalResolveButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  modalResolveButtonDisabled: {
    opacity: 0.65,
  },
  modalResolveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
});
