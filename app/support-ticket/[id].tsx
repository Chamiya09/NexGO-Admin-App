import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

const palette = {
  background: '#F4F8F7',
  textPrimary: '#123532',
  textSecondary: '#617C79',
  card: '#FFFFFF',
  border: '#DFE9E7',
  accent: '#008080',
  accentSoft: '#E7F5F3',
  input: '#F7FBFA',
  danger: '#C13B3B',
  dangerSoft: '#FFF1F1',
  warning: '#B27A00',
  warningSoft: '#FFF7E2',
  success: '#157A62',
  successSoft: '#E8F7F0',
  neutral: '#667085',
  neutralSoft: '#F2F4F7',
};

type TicketStatus = 'Pending' | 'Open' | 'In Review' | 'Resolved' | 'Closed';

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
  status: TicketStatus;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

const STATUS_OPTIONS: TicketStatus[] = ['Pending', 'Open', 'In Review', 'Resolved', 'Closed'];

const getStatusTone = (status: TicketStatus) => {
  if (status === 'Pending') return { color: palette.warning, backgroundColor: palette.warningSoft };
  if (status === 'Resolved') return { color: palette.success, backgroundColor: palette.successSoft };
  if (status === 'Closed') return { color: palette.neutral, backgroundColor: palette.neutralSoft };
  if (status === 'In Review') return { color: palette.warning, backgroundColor: palette.warningSoft };
  return { color: palette.accent, backgroundColor: palette.accentSoft };
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function AdminSupportTicketReviewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ticketId = Array.isArray(id) ? id[0] : id;
  const [ticket, setTicket] = useState<AdminSupportTicket | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>('Pending');
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const passengerLabel = useMemo(() => {
    const requester = ticket?.requesterType === 'Driver' ? ticket?.driver : ticket?.passenger;
    const label = ticket?.requesterType === 'Driver' ? 'Driver' : 'Passenger';
    const name = requester?.fullName?.trim();
    const email = requester?.email?.trim();
    const phone = requester?.phoneNumber?.trim();

    const details = [name, email, phone].filter(Boolean).join(' | ');
    return details ? `${label}: ${details}` : `${label} details unavailable`;
  }, [ticket]);

  const loadTicket = useCallback(async () => {
    if (!ticketId) {
      setFeedback('Ticket id is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const response = await authFetch(`${API_BASE_URL}/support-tickets/admin/${ticketId}`);
      const data = await parseApiResponse<{ ticket: AdminSupportTicket }>(response);
      setTicket(data.ticket);
      setSelectedStatus(data.ticket.status);
      setAdminNote(data.ticket.adminNote || '');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to load support ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      void loadTicket();
    }, [loadTicket])
  );

  const saveTicketReview = async () => {
    if (!ticketId || saving) return;

    setSaving(true);
    setFeedback(null);

    try {
      const response = await authFetch(`${API_BASE_URL}/support-tickets/admin/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedStatus,
          adminNote,
        }),
      });
      const data = await parseApiResponse<{ ticket: AdminSupportTicket; message?: string }>(response);
      setTicket(data.ticket);
      setSelectedStatus(data.ticket.status);
      setAdminNote(data.ticket.adminNote || '');
      setFeedback(data.message || 'Support ticket updated.');
      Alert.alert('Ticket updated', 'The support ticket review has been saved.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to update support ticket.');
    } finally {
      setSaving(false);
    }
  };

  const statusTone = getStatusTone(selectedStatus);
  const isUrgent = ticket?.priority === 'Urgent';

  return (
    <SafeAreaView style={styles.safeArea}>
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onRefreshPage={loadTicket}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
          </Pressable>
          <Text style={styles.topBarTitle}>Review Ticket</Text>
          <View style={styles.topBarSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.loadingText}>Loading ticket...</Text>
          </View>
        ) : !ticket ? (
          <View style={styles.loadingCard}>
            <Ionicons name="alert-circle-outline" size={28} color={palette.danger} />
            <Text style={styles.loadingText}>{feedback || 'Ticket not found.'}</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroTitleWrap}>
                  <Text style={styles.ticketId} selectable>{ticket.id}</Text>
                  <Text style={styles.heroTitle}>{ticket.subject}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusTone.backgroundColor }]}>
                  <Text style={[styles.statusBadgeText, { color: statusTone.color }]}>{selectedStatus}</Text>
                </View>
              </View>

              <Text style={styles.description}>{ticket.description}</Text>

              <View style={styles.metaRow}>
                <View style={styles.topicPill}>
                  <Ionicons name="albums-outline" size={14} color={palette.accent} />
                  <Text style={styles.topicText}>{ticket.topic}</Text>
                </View>
                <View style={[styles.priorityPill, isUrgent ? styles.priorityUrgent : styles.priorityNormal]}>
                  <Ionicons
                    name={isUrgent ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                    size={14}
                    color={isUrgent ? palette.danger : palette.accent}
                  />
                  <Text style={[styles.priorityText, { color: isUrgent ? palette.danger : palette.accent }]}>
                    {ticket.priority}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Passenger</Text>
              <Text style={styles.infoText} selectable>{passengerLabel}</Text>
              {!!ticket.rideReference && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.sectionTitle}>Ride Reference</Text>
                  <Text style={styles.infoText} selectable>{ticket.rideReference}</Text>
                </>
              )}
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Timeline</Text>
              <Text style={styles.infoText}>Created {formatDate(ticket.createdAt)}</Text>
              <Text style={styles.infoText}>Updated {formatDate(ticket.updatedAt)}</Text>
              {!!ticket.resolvedAt && <Text style={styles.infoText}>Resolved {formatDate(ticket.resolvedAt)}</Text>}
            </View>

            <View style={styles.reviewCard}>
              <Text style={styles.sectionTitle}>Admin Handling Status</Text>
              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map((status) => {
                  const isSelected = selectedStatus === status;
                  const tone = getStatusTone(status);

                  return (
                    <Pressable
                      key={status}
                      style={[
                        styles.statusOption,
                        {
                          backgroundColor: isSelected ? tone.backgroundColor : palette.input,
                          borderColor: isSelected ? tone.color : palette.border,
                        },
                      ]}
                      onPress={() => setSelectedStatus(status)}>
                      <Text style={[styles.statusOptionText, { color: isSelected ? tone.color : palette.textSecondary }]}>
                        {status}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.sectionTitle}>Admin Note</Text>
              <TextInput
                value={adminNote}
                onChangeText={setAdminNote}
                placeholder="Add the support follow-up, refund decision, or next action."
                placeholderTextColor="#8AA09D"
                multiline
                textAlignVertical="top"
                style={styles.noteInput}
              />

              {!!feedback && <Text style={styles.feedbackText}>{feedback}</Text>}

              <Pressable
                disabled={saving}
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={() => {
                  void saveTicketReview();
                }}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="save-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.saveButtonText}>{saving ? 'Saving Review...' : 'Save Ticket Review'}</Text>
              </Pressable>
            </View>
          </>
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 34,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  topBarSpacer: {
    width: 42,
  },
  loadingCard: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
  },
  loadingText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 15,
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 4,
  },
  ticketId: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  description: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topicPill: {
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  topicText: {
    color: palette.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  priorityPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  priorityUrgent: {
    backgroundColor: palette.dangerSoft,
  },
  priorityNormal: {
    backgroundColor: palette.accentSoft,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '900',
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 15,
    marginBottom: 12,
    gap: 6,
  },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 15,
    gap: 11,
  },
  sectionTitle: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  infoText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#EAF0EF',
    marginVertical: 7,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  noteInput: {
    minHeight: 128,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: palette.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  feedbackText: {
    color: palette.accent,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
