import React, { useCallback, useMemo, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, parseApiResponse } from '@/lib/api';

const palette = {
  background: '#F4F8F7',
  textPrimary: '#123532',
  textSecondary: '#617C79',
  card: '#FFFFFF',
  border: '#DFE9E7',
  accent: '#14988F',
  accentSoft: '#E7F5F3',
  input: '#F7FBFA',
  danger: '#C13B3B',
  dangerSoft: '#FFF4F4',
  warning: '#D97706',
  warningSoft: '#FFF8EC',
  success: '#157A62',
  successSoft: '#E9F8EF',
};

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

type AdminReviewsResponse = {
  reviews?: AdminRideReview[];
};

async function parseReviewsResponse(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Review manager backend route is not active. Restart the backend server and refresh.');
    }

    throw new Error(data?.message || 'Unable to load review queue.');
  }

  return data as AdminReviewsResponse;
}

const FILTERS: { label: string; value: ReviewStatus }[] = [
  { label: 'Pending', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
];

const formatVehicle = (review: AdminRideReview) => {
  const vehicle = review.driver?.vehicle;
  const name = [vehicle?.make, vehicle?.model].filter(Boolean).join(' ');
  return name || vehicle?.category || review.vehicleType || 'Vehicle not available';
};

const buildReviewsUrl = (status: ReviewStatus) =>
  `${API_BASE_URL}/rides/admin/reviews?status=${status}&refresh=${Date.now()}`;

export default function AdminReviewManagerScreen() {
  const [activeFilter, setActiveFilter] = useState<ReviewStatus>('review');
  const [reviews, setReviews] = useState<AdminRideReview[]>([]);
  const [summaryReviews, setSummaryReviews] = useState<AdminRideReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const totals = useMemo(() => {
    const pendingCount = summaryReviews.filter((review) => review.status === 'review').length;
    const approvedCount = summaryReviews.filter((review) => review.status === 'approved').length;
    return { pendingCount, approvedCount, totalCount: summaryReviews.length };
  }, [summaryReviews]);

  const loadReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    setReviews([]);

    try {
      const response = await fetch(buildReviewsUrl(activeFilter), {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await parseReviewsResponse(response);
      const savedReviews = data.reviews ?? [];

      setReviews(savedReviews);

      try {
        const summaryResponse = await fetch(buildReviewsUrl('all'), {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const summaryData = await parseReviewsResponse(summaryResponse);
        setSummaryReviews(summaryData.reviews ?? savedReviews);
      } catch {
        setSummaryReviews(savedReviews);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to load review queue.');
    } finally {
      setIsLoadingReviews(false);
    }
  }, [activeFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadReviews();
    }, [loadReviews])
  );

  const handleFilterChange = (filter: ReviewStatus) => {
    setFeedback(null);
    setActiveFilter(filter);
  };


  const updateReviewStatus = async (review: AdminRideReview, status: 'approved' | 'rejected') => {
    if (updatingReviewId) return;

    setUpdatingReviewId(review.rideId);
    setFeedback(null);

    try {
      const response = await fetch(`${API_BASE_URL}/rides/admin/reviews/${review.rideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await parseApiResponse<{ review: AdminRideReview; message?: string }>(response);
      const updatedReview = data.review;

      setReviews((current) =>
        current.map((item) => (item.rideId === updatedReview.rideId ? updatedReview : item))
      );
      setSummaryReviews((current) => {
        if (current.some((item) => item.rideId === updatedReview.rideId)) {
          return current.map((item) => (item.rideId === updatedReview.rideId ? updatedReview : item));
        }

        return [updatedReview, ...current];
      });
      setFeedback(
        status === 'approved'
          ? 'Review approved for public driver profile.'
          : 'Review marked as rejected.'
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to update review status.');
    } finally {
      setUpdatingReviewId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onRefreshPage={loadReviews}>
        <View style={styles.topBar}>
          <Pressable style={[styles.backButton, { borderColor: palette.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: palette.textPrimary }]}>Reviews</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
              <Ionicons name="star-half-outline" size={26} color={palette.accent} />
            </View>

            <View style={styles.heroIdentity}>
              <Text style={[styles.heroName, { color: palette.textPrimary }]}>Review & Rating Management</Text>
              <Text style={[styles.heroSubline, { color: palette.textSecondary }]}>
                Moderate passenger feedback before it appears on public driver profiles.
              </Text>
            </View>
          </View>

          <View style={[styles.heroBadge, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="shield-checkmark-outline" size={15} color={palette.accent} />
            <Text style={[styles.heroBadgeText, { color: palette.accent }]}>Approval control</Text>
          </View>

          <Text style={[styles.heroHint, { color: palette.textSecondary }]}>
            Approve only fair, useful, and policy-safe ride reviews. Rejected reviews stay hidden from public driver profiles.
          </Text>
        </View>

        <View style={styles.metricGrid}>
          <MetricCard label="Pending" value={String(totals.pendingCount)} icon="time-outline" />
          <MetricCard label="Approved" value={String(totals.approvedCount)} icon="checkmark-circle-outline" />
          <MetricCard label="Total" value={String(totals.totalCount)} icon="list-outline" />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline, { color: palette.textSecondary }]}>REVIEW FILTER</Text>
          <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>Manage review queue</Text>
        </View>

        <View style={[styles.groupCard, styles.filterCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.filterRow}>
            {FILTERS.map((filter) => {
              const selected = activeFilter === filter.value;

              return (
                <Pressable
                  key={filter.value}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: selected ? palette.accent : palette.input,
                      borderColor: selected ? palette.accent : palette.border,
                    },
                  ]}
                  onPress={() => handleFilterChange(filter.value)}>
                  <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : palette.textPrimary }]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>REVIEWS</Text>

        {isLoadingReviews ? (
          <View style={[styles.loadingCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ActivityIndicator size="small" color={palette.accent} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading review queue...</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="star-outline" size={24} color={palette.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>No reviews found</Text>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              Pull to refresh or change the filter to inspect another moderation state.
            </Text>
          </View>
        ) : (
          <View style={styles.reviewList}>
            {reviews.map((review) => (
              <ReviewRow
                key={review.rideId}
                review={review}
                isUpdating={updatingReviewId === review.rideId}
                onApprove={() => updateReviewStatus(review, 'approved')}
                onReject={() => updateReviewStatus(review, 'rejected')}
              />
            ))}
          </View>
        )}

        {feedback ? (
          <View style={[styles.feedbackCard, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
            <Ionicons name="information-circle-outline" size={17} color={palette.accent} />
            <Text style={[styles.feedbackText, { color: palette.textPrimary }]}>{feedback}</Text>
          </View>
        ) : null}
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.metricCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Ionicons name={icon} size={17} color={palette.accent} />
      <Text style={[styles.metricValue, { color: palette.textPrimary }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ReviewRow({
  review,
  isUpdating,
  onApprove,
  onReject,
}: {
  review: AdminRideReview;
  isUpdating: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.reviewRow,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.reviewTopRow}>
        <View style={styles.reviewMain}>
          <View style={[styles.reviewIcon, { backgroundColor: palette.warningSoft }]}>
            <Ionicons name="star" size={18} color={palette.warning} />
          </View>
          <View style={styles.reviewTextWrap}>
            <Text style={[styles.reviewName, { color: palette.textPrimary }]} numberOfLines={1}>
              {review.driver?.fullName || 'Driver not available'}
            </Text>
            <Text style={[styles.reviewSubtext, { color: palette.textSecondary }]} numberOfLines={2}>
              {review.passenger?.fullName || 'Passenger'} | {formatVehicle(review)}
            </Text>
          </View>
        </View>

        <StatusBadge status={review.status} />
      </View>

      <View style={styles.reviewFooter}>
        <View style={styles.ratingMiniWrap}>
          <StarStrip rating={review.rating} />
          <Text style={[styles.ratingMiniText, { color: palette.warning }]}>{review.rating}.0</Text>
        </View>

        <View style={styles.rowButtons}>
          <Pressable
            style={[styles.rowActionButton, { backgroundColor: palette.dangerSoft, borderColor: '#F1D6D6' }, isUpdating ? styles.disabledButton : null]}
            disabled={isUpdating}
            onPress={onReject}>
            <Ionicons name="close-circle-outline" size={15} color={palette.danger} />
            <Text style={[styles.rowDeleteText, { color: palette.danger }]}>Reject</Text>
          </Pressable>

          <Pressable
            style={[styles.rowActionButton, { backgroundColor: palette.accentSoft, borderColor: palette.border }, isUpdating ? styles.disabledButton : null]}
            disabled={isUpdating}
            onPress={onApprove}>
            <Ionicons name="checkmark-circle-outline" size={15} color={palette.accent} />
            <Text style={[styles.rowEditText, { color: palette.accent }]}>Approve</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: AdminRideReview['status'] }) {
  const config = {
    review: { label: 'Pending', bg: palette.warningSoft, text: palette.warning },
    approved: { label: 'Approved', bg: palette.successSoft, text: palette.success },
    rejected: { label: 'Rejected', bg: palette.dangerSoft, text: palette.danger },
  }[status];

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.text }]} numberOfLines={1}>{config.label}</Text>
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
          size={14}
          color={star <= rating ? '#F5A623' : '#B7C7C5'}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  topBar: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  topBarSpacer: {
    width: 38,
    height: 38,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIdentity: {
    flex: 1,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroSubline: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 8,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  sectionTitleInline: {
    marginBottom: 0,
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 12,
    marginBottom: 12,
  },
  filterCard: {
    padding: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterButton: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 126,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  loadingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  reviewList: {
    gap: 10,
    marginBottom: 12,
  },
  reviewRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reviewMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  reviewIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  reviewName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  reviewSubtext: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  statusBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAF1EF',
    flexWrap: 'wrap',
  },
  ratingMiniWrap: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 0,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingMiniText: {
    fontSize: 12,
    fontWeight: '900',
  },
  rowButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 1,
  },
  rowActionButton: {
    minWidth: 84,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  rowEditText: {
    fontSize: 12,
    fontWeight: '900',
  },
  rowDeleteText: {
    fontSize: 12,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
  feedbackCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
});
