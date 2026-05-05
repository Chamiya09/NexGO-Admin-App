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
  Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

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
    profileImageUrl?: string;
  } | null;
  driver?: {
    fullName?: string;
    phoneNumber?: string;
    profileImageUrl?: string;
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

const buildReviewsUrl = (status: ReviewStatus) =>
  `${API_BASE_URL}/rides/admin/reviews?status=${status}&refresh=${Date.now()}`;

export default function AdminReviewManagerScreen() {
  const [activeFilter, setActiveFilter] = useState<ReviewStatus>('review');
  const [reviews, setReviews] = useState<AdminRideReview[]>([]);
  const [summaryReviews, setSummaryReviews] = useState<AdminRideReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [detailsReview, setDetailsReview] = useState<AdminRideReview | null>(null);
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
      const response = await authFetch(buildReviewsUrl(activeFilter), {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = await parseReviewsResponse(response);
      const savedReviews = data.reviews ?? [];

      setReviews(savedReviews);

      try {
        const summaryResponse = await authFetch(buildReviewsUrl('all'), {
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
      const response = await authFetch(`${API_BASE_URL}/rides/admin/reviews/${review.rideId}`, {
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
                onViewDetails={() => setDetailsReview(review)}
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

      {detailsReview ? (
        <View style={styles.popupOverlay}>
          <Pressable style={styles.popupBackdrop} onPress={() => setDetailsReview(null)} />
          <View style={styles.popupCard}>
            <View style={styles.popupHeader}>
              <View style={styles.popupHeaderMain}>
                <View style={[styles.popupIcon, { backgroundColor: palette.accentSoft }]}>
                  <ProfileAvatar imageUrl={detailsReview.driver?.profileImageUrl} name={detailsReview.driver?.fullName} fallback="D" size={40} />
                </View>
                <View style={styles.popupTitleWrap}>
                  <Text style={[styles.popupTitle, { color: palette.textPrimary }]}>Review Details</Text>
                  <Text style={[styles.popupSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>
                    {detailsReview.driver?.fullName || 'Driver not available'}
                  </Text>
                </View>
              </View>
              <Pressable style={[styles.popupCloseButton, { borderColor: palette.border }]} onPress={() => setDetailsReview(null)}>
                <Ionicons name="close" size={18} color={palette.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.popupMessageBox, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Text style={[styles.popupSectionLabel, { color: palette.textSecondary }]}>REVIEW MESSAGE</Text>
              <View style={styles.popupRatingRow}>
                <StarStrip rating={detailsReview.rating} />
                <Text style={[styles.popupRatingText, { color: palette.warning }]}>{detailsReview.rating}.0 rating</Text>
                <StatusBadge status={detailsReview.status} />
              </View>
              <Text style={[styles.popupMessageText, { color: palette.textPrimary }]}>
                {detailsReview.comment || 'No written review message.'}
              </Text>
            </View>

            <View style={[styles.popupDetailsBox, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Text style={[styles.popupSectionLabel, { color: palette.textSecondary }]}>RIDE DETAILS</Text>
              <DetailLine icon="person-outline" label="Passenger" value={detailsReview.passenger?.fullName || 'Passenger not available'} />
              <DetailLine icon="call-outline" label="Passenger phone" value={detailsReview.passenger?.phoneNumber || 'Not available'} />
              <DetailLine icon="mail-outline" label="Passenger email" value={detailsReview.passenger?.email || 'Not available'} />
              <DetailLine icon="car-outline" label="Driver" value={detailsReview.driver?.fullName || 'Driver not available'} />
              <DetailLine icon="pricetag-outline" label="Vehicle" value={formatVehicle(detailsReview)} />
              <DetailLine icon="barcode-outline" label="Plate" value={detailsReview.driver?.vehicle?.plateNumber || 'No plate'} />
              <DetailLine icon="calendar-outline" label="Submitted" value={formatDate(detailsReview.submittedAt || detailsReview.reviewedAt)} />
              <DetailLine icon="time-outline" label="Moderated" value={formatDate(detailsReview.moderatedAt)} />
            </View>
          </View>
        </View>
      ) : null}
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

function ProfileAvatar({
  imageUrl,
  name,
  fallback,
  size,
}: {
  imageUrl?: string;
  name?: string;
  fallback: string;
  size: number;
}) {
  const initial = (name || fallback).trim().charAt(0).toUpperCase() || fallback;

  return (
    <View style={[styles.profileAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.profileAvatarImage} />
      ) : (
        <Text style={styles.profileAvatarText}>{initial}</Text>
      )}
    </View>
  );
}

function ReviewRow({
  review,
  isUpdating,
  onViewDetails,
  onApprove,
  onReject,
}: {
  review: AdminRideReview;
  isUpdating: boolean;
  onViewDetails: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const canModerate = review.status === 'review';
  const submittedLabel = formatDate(review.submittedAt || review.reviewedAt);
  const vehicleLabel = formatVehicle(review);
  const tone = getReviewTone(review.status);

  return (
    <View style={styles.reviewRow}>
      <View style={[styles.reviewAccent, { backgroundColor: tone.text }]} />
      <View style={styles.reviewTopRow}>
        <View style={styles.reviewMain}>
          <View style={[styles.ratingTile, { backgroundColor: tone.soft, borderColor: tone.border }]}>
            <Text style={[styles.ratingTileValue, { color: tone.text }]}>{review.rating}.0</Text>
            <View style={styles.ratingTileStars}>
              <StarStrip rating={review.rating} size={9} />
            </View>
          </View>
          <View style={styles.reviewTextWrap}>
            <View style={styles.reviewIdentityLine}>
              <ProfileAvatar imageUrl={review.driver?.profileImageUrl} name={review.driver?.fullName} fallback="D" size={28} />
              <Text style={styles.reviewName} numberOfLines={1}>
                {review.driver?.fullName || 'Driver not available'}
              </Text>
            </View>
            <Text style={styles.reviewSubtext} numberOfLines={1}>
              Passenger: {review.passenger?.fullName || 'Passenger not available'}
            </Text>
            <View style={styles.reviewMetaLine}>
              <Ionicons name="calendar-outline" size={12} color={palette.textSecondary} />
              <Text style={styles.reviewMetaText} numberOfLines={1}>{submittedLabel}</Text>
            </View>
          </View>
        </View>

        <StatusBadge status={review.status} />
      </View>

      <View style={styles.messageBox}>
        <View style={styles.messageHeader}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={palette.accent} />
          <Text style={styles.messageLabel}>PASSENGER REVIEW</Text>
        </View>
        <Text style={styles.messageText} numberOfLines={3}>
          {review.comment || 'No written review message.'}
        </Text>
      </View>

      <View style={styles.reviewInfoGrid}>
        <ReviewInfoPill icon="car-outline" label="Vehicle" value={vehicleLabel} />
        <ReviewInfoPill icon="barcode-outline" label="Plate" value={review.driver?.vehicle?.plateNumber || 'No plate'} />
        <ReviewInfoPill icon="call-outline" label="Passenger" value={review.passenger?.phoneNumber || 'No phone'} />
      </View>

      <View style={styles.reviewFooter}>
        <View style={styles.rowButtons}>
          <Pressable
            style={[styles.rowActionButton, styles.detailsButton]}
            hitSlop={6}
            onPress={onViewDetails}>
            <Ionicons name="eye-outline" size={15} color={palette.textSecondary} />
            <Text style={styles.rowNeutralText}>Details</Text>
          </Pressable>

          {canModerate ? (
            <>
              <Pressable
                style={[styles.rowActionButton, styles.rejectButton, isUpdating ? styles.disabledButton : null]}
                disabled={isUpdating}
                hitSlop={6}
                onPress={onReject}>
                <Ionicons name="close-circle-outline" size={15} color={palette.danger} />
                <Text style={styles.rowDeleteText}>Reject</Text>
              </Pressable>

              <Pressable
                style={[styles.rowActionButton, styles.approveButton, isUpdating ? styles.disabledButton : null]}
                disabled={isUpdating}
                hitSlop={6}
                onPress={onApprove}>
                <Ionicons name="checkmark-circle-outline" size={15} color={palette.accent} />
                <Text style={styles.rowEditText}>Approve</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function getReviewTone(status: AdminRideReview['status']) {
  if (status === 'approved') {
    return { soft: palette.successSoft, border: '#CAEBD8', text: palette.success };
  }

  if (status === 'rejected') {
    return { soft: palette.dangerSoft, border: '#F1D6D6', text: palette.danger };
  }

  return { soft: palette.warningSoft, border: '#F3E0BC', text: palette.warning };
}

function ReviewInfoPill({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.reviewInfoPill}>
      <Ionicons name={icon} size={13} color={palette.accent} />
      <View style={styles.reviewInfoTextWrap}>
        <Text style={styles.reviewInfoLabel}>{label}</Text>
        <Text style={styles.reviewInfoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailLine}>
      <Ionicons name={icon} size={14} color={palette.accent} />
      <Text style={[styles.detailLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: palette.textPrimary }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
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

function StarStrip({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    gap: 12,
    overflow: 'hidden',
  },
  reviewAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: palette.accent,
  },
  reviewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 58,
  },
  reviewMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
  },
  ratingTile: {
    width: 66,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: palette.warningSoft,
    borderWidth: 1,
    borderColor: '#F3E0BC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    flexShrink: 0,
  },
  ratingTileValue: {
    color: palette.warning,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 3,
  },
  ratingTileStars: {
    width: 54,
    alignItems: 'center',
  },
  reviewTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  reviewIdentityLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  profileAvatar: {
    backgroundColor: '#E7F5F3',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileAvatarText: {
    color: '#14988F',
    fontSize: 12,
    fontWeight: '900',
  },
  reviewName: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 2,
  },
  reviewSubtext: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  reviewMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  reviewMetaText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  messageBox: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
    padding: 10,
    gap: 7,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageLabel: {
    color: palette.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  messageText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  reviewInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewInfoPill: {
    flexGrow: 1,
    flexBasis: '48%',
    minWidth: 132,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reviewInfoTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  reviewInfoLabel: {
    color: palette.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  reviewInfoValue: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailLabel: {
    width: 104,
    fontSize: 11,
    fontWeight: '800',
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  statusBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
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
    width: '100%',
  },
  rowActionButton: {
    flexGrow: 1,
    flexBasis: 96,
    minWidth: 96,
    minHeight: 34,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  detailsButton: {
    backgroundColor: palette.input,
    borderColor: palette.border,
  },
  approveButton: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.border,
  },
  rejectButton: {
    backgroundColor: palette.dangerSoft,
    borderColor: '#F1D6D6',
  },
  rowEditText: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  rowDeleteText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '900',
  },
  rowNeutralText: {
    color: palette.textSecondary,
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
  popupOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  popupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 53, 50, 0.36)',
  },
  popupCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 14,
    gap: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  popupHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  popupIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  popupTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  popupSubtitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  popupCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupMessageBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  popupSectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  popupRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  popupRatingText: {
    fontSize: 12,
    fontWeight: '900',
  },
  popupMessageText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  popupDetailsBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
});
