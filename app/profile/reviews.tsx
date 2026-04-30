import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, parseApiResponse } from '@/lib/api';

const teal = '#008080';

type ReviewStatus = 'all' | 'review' | 'approved' | 'rejected';

type AdminRideReview = {
  rideId: string;
  rating: number;
  comment: string;
  status: Exclude<ReviewStatus, 'all'>;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  moderatedAt?: string | null;
  vehicleType?: string;
  completedAt?: string | null;
  passenger?: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
  driver?: {
    fullName?: string;
    phoneNumber?: string;
    vehicle?: {
      make?: string;
      model?: string;
      plateNumber?: string;
      category?: string;
    } | null;
  } | null;
};

const FILTERS: { label: string; value: ReviewStatus }[] = [
  { label: 'Pending', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

const formatDate = (iso?: string | null) => {
  if (!iso) return 'Not available';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleDateString('en-LK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatVehicle = (review: AdminRideReview) => {
  const vehicle = review.driver?.vehicle;
  const name = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  return name || vehicle?.category || review.vehicleType || 'Vehicle not available';
};

export default function AdminReviewManagerScreen() {
  const [activeFilter, setActiveFilter] = useState<ReviewStatus>('review');
  const [reviews, setReviews] = useState<AdminRideReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRideId, setUpdatingRideId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/rides/admin/reviews?status=${activeFilter}`);
      const data = await parseApiResponse<{ reviews: AdminRideReview[] }>(response);
      setReviews(data.reviews ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const counts = useMemo(() => {
    const pending = reviews.filter((review) => review.status === 'review').length;
    const approved = reviews.filter((review) => review.status === 'approved').length;
    const rejected = reviews.filter((review) => review.status === 'rejected').length;

    return { pending, approved, rejected };
  }, [reviews]);

  const updateReviewStatus = async (rideId: string, status: Exclude<ReviewStatus, 'all'>) => {
    setUpdatingRideId(rideId);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/rides/admin/reviews/${rideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await parseApiResponse<{ review: AdminRideReview }>(response);

      if (activeFilter === 'all' || data.review.status === activeFilter) {
        setReviews((current) =>
          current.map((review) => (review.rideId === rideId ? data.review : review))
        );
      } else {
        setReviews((current) => current.filter((review) => review.rideId !== rideId));
      }

      setFeedback(status === 'approved' ? 'Review approved for public profile.' : 'Review status updated.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to update review.');
    } finally {
      setUpdatingRideId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onRefreshPage={loadReviews}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#123532" />
          </Pressable>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>ADMIN TOOLS</Text>
            <Text style={styles.pageTitle}>Review & Rating Manager</Text>
            <Text style={styles.pageSubtitle}>
              Approve passenger ride feedback before it appears on public driver profiles.
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard icon="time-outline" label="Pending" value={String(counts.pending)} />
          <SummaryCard icon="checkmark-circle-outline" label="Approved" value={String(counts.approved)} />
          <SummaryCard icon="close-circle-outline" label="Rejected" value={String(counts.rejected)} />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((filter) => (
            <Pressable
              key={filter.value}
              style={[styles.filterButton, activeFilter === filter.value ? styles.filterButtonActive : null]}
              onPress={() => setActiveFilter(filter.value)}>
              <Text style={[styles.filterText, activeFilter === filter.value ? styles.filterTextActive : null]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {feedback ? (
          <View style={styles.feedbackCard}>
            <Ionicons name="information-circle-outline" size={17} color={teal} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={teal} />
            <Text style={styles.stateText}>Loading review queue...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#C13B3B" />
            <Text style={styles.stateErrorText}>{errorMessage}</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="star-outline" size={24} color={teal} />
            <Text style={styles.stateText}>No reviews found for this filter.</Text>
          </View>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <View key={review.rideId} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <View style={styles.reviewTitleWrap}>
                    <Text style={styles.reviewTitle}>{review.driver?.fullName || 'Driver not available'}</Text>
                    <Text style={styles.reviewMeta}>
                      {formatVehicle(review)} | {review.driver?.vehicle?.plateNumber || 'No plate'}
                    </Text>
                  </View>
                  <StatusPill status={review.status} />
                </View>

                <View style={styles.ratingRow}>
                  <StarStrip rating={review.rating} />
                  <Text style={styles.ratingText}>{review.rating}.0 rating</Text>
                </View>

                <Text style={styles.reviewComment}>{review.comment || 'No written comment.'}</Text>

                <View style={styles.detailBlock}>
                  <InfoLine icon="person-outline" label="Passenger" value={review.passenger?.fullName || 'Passenger not available'} />
                  <InfoLine icon="calendar-outline" label="Submitted" value={formatDate(review.submittedAt || review.reviewedAt)} />
                  <InfoLine icon="flag-outline" label="Completed" value={formatDate(review.completedAt)} />
                </View>

                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.rejectButton, updatingRideId === review.rideId ? styles.buttonDisabled : null]}
                    disabled={updatingRideId === review.rideId}
                    onPress={() => updateReviewStatus(review.rideId, 'rejected')}>
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.reopenButton, updatingRideId === review.rideId ? styles.buttonDisabled : null]}
                    disabled={updatingRideId === review.rideId}
                    onPress={() => updateReviewStatus(review.rideId, 'review')}>
                    <Text style={styles.reopenButtonText}>Review</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.approveButton, updatingRideId === review.rideId ? styles.buttonDisabled : null]}
                    disabled={updatingRideId === review.rideId}
                    onPress={() => updateReviewStatus(review.rideId, 'approved')}>
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={17} color={teal} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: AdminRideReview['status'] }) {
  const config = {
    review: { label: 'Pending', bg: '#FFF8EC', text: '#D97706' },
    approved: { label: 'Approved', bg: '#E7F5F3', text: teal },
    rejected: { label: 'Rejected', bg: '#FFF4F4', text: '#C13B3B' },
  }[status];

  return (
    <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusPillText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function StarStrip({ rating }: { rating: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={15}
          color={star <= rating ? '#F5A623' : '#B7C7C5'}
        />
      ))}
    </View>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={15} color={teal} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  pageTitle: {
    color: '#123532',
    fontSize: 24,
    fontWeight: '900',
  },
  pageSubtitle: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  summaryValue: {
    color: '#123532',
    fontSize: 17,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterButton: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: teal,
    borderColor: teal,
  },
  filterText: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '800',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  feedbackCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#E7F5F3',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  feedbackText: {
    flex: 1,
    color: '#123532',
    fontSize: 13,
    fontWeight: '700',
  },
  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: '#617C79',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateErrorText: {
    color: '#C13B3B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  reviewList: {
    gap: 12,
  },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 12,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  reviewTitleWrap: {
    flex: 1,
  },
  reviewTitle: {
    color: '#123532',
    fontSize: 16,
    fontWeight: '900',
  },
  reviewMeta: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    color: '#9A6200',
    fontSize: 12,
    fontWeight: '900',
  },
  reviewComment: {
    color: '#123532',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    backgroundColor: '#F7FBFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    padding: 11,
  },
  detailBlock: {
    gap: 7,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  infoLabel: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '800',
    width: 76,
  },
  infoValue: {
    flex: 1,
    color: '#123532',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    flexWrap: 'wrap',
  },
  rejectButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF4F4',
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    color: '#C13B3B',
    fontSize: 13,
    fontWeight: '900',
  },
  reopenButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reopenButtonText: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '900',
  },
  approveButton: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: teal,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
