import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  overlay: 'rgba(7, 21, 19, 0.45)',
  danger: '#C13B3B',
  warning: '#D97706',
  warningSoft: '#FFF8EC',
  success: '#157A62',
  successSoft: '#E9F8EF',
};

type CampaignStatus = 'Active' | 'Scheduled' | 'Paused';
type DiscountType = 'Percentage' | 'Fixed';

type PromotionCampaign = {
  id: string;
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: string;
  endDate: string;
  status: CampaignStatus;
  active: boolean;
  imageUrl: string;
};

type PromotionApiCampaign = PromotionCampaign & {
  image?: string;
  imageURL?: string;
  fileUrl?: string;
  secureUrl?: string;
  url?: string;
};

const emptyCampaign: PromotionCampaign = {
  id: '',
  name: '',
  code: '',
  discountType: 'Percentage',
  discountValue: '',
  endDate: '',
  status: 'Active',
  active: true,
  imageUrl: '',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateValue = (value: string) => {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getCalendarDates = (visibleDate: Date) => {
  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const calendarStart = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
};

const normalizePromotion = (promotion: PromotionApiCampaign): PromotionCampaign => ({
  ...promotion,
  imageUrl:
    promotion.imageUrl?.trim() ||
    promotion.image?.trim() ||
    promotion.imageURL?.trim() ||
    promotion.fileUrl?.trim() ||
    promotion.secureUrl?.trim() ||
    promotion.url?.trim() ||
    '',
});

export default function PromotionManagementScreen() {
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [form, setForm] = useState<PromotionCampaign>(emptyCampaign);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [isSavingPromotion, setIsSavingPromotion] = useState(false);
  const [updatingCampaignId, setUpdatingCampaignId] = useState<string | null>(null);
  const [campaignPendingDelete, setCampaignPendingDelete] = useState<PromotionCampaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [visibleCalendarDate, setVisibleCalendarDate] = useState(new Date());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalWarning, setModalWarning] = useState<string | null>(null);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0];

  const totals = useMemo(() => {
    const activeCount = campaigns.filter((campaign) => campaign.status === 'Active' && campaign.active).length;
    const scheduledCount = campaigns.filter((campaign) => campaign.status === 'Scheduled').length;

    return { activeCount, scheduledCount, totalCount: campaigns.length };
  }, [campaigns]);

  const loadPromotions = useCallback(async () => {
    setIsLoadingPromotions(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/promotions`);
      const data = await parseApiResponse<{ promotions: PromotionApiCampaign[] }>(response);

      const savedPromotions = (data.promotions ?? []).map(normalizePromotion);
      setCampaigns(savedPromotions);
      setSelectedCampaignId((current) => {
        if (savedPromotions.some((promotion) => promotion.id === current)) {
          return current;
        }

        return savedPromotions[0]?.id ?? '';
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to load saved promotions.');
    } finally {
      setIsLoadingPromotions(false);
    }
  }, []);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  const handleChange = (field: keyof PromotionCampaign, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    const today = new Date();
    setForm({
      ...emptyCampaign,
      id: `promo-${Date.now()}`,
      endDate: formatDateValue(today),
    });
    setVisibleCalendarDate(today);
    setIsCalendarVisible(false);
    setFeedback(null);
    setModalWarning(null);
    setIsModalVisible(true);
  };

  const openEditModal = (campaign: PromotionCampaign) => {
    setForm(normalizePromotion(campaign));
    setVisibleCalendarDate(parseDateValue(campaign.endDate));
    setIsCalendarVisible(false);
    setFeedback(null);
    setModalWarning(null);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsCalendarVisible(false);
    setIsModalVisible(false);
  };

  const moveCalendarMonth = (offset: number) => {
    setVisibleCalendarDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const selectEndDate = (date: Date) => {
    handleChange('endDate', formatDateValue(date));
    setVisibleCalendarDate(date);
    setIsCalendarVisible(false);
  };

  const pickPromotionImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setFeedback('Gallery permission is required to select a promotion image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }

    setFeedback(null);
    handleChange('imageUrl', result.assets[0].uri);
  };

  const uploadPromotionImage = async (imageUri: string) => {
    if (!imageUri || /^https?:\/\//i.test(imageUri)) {
      return imageUri;
    }

    const fileName = imageUri.split('/').pop() || `promotion-${Date.now()}.jpg`;
    const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';

    const body = new FormData();
    body.append('file', {
      uri: imageUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    const response = await authFetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body,
    });
    const data = await parseApiResponse<{ fileUrl: string }>(response);
    if (!data.fileUrl) {
      throw new Error('Image upload failed. No Cloudinary URL returned.');
    }
    return data.fileUrl;
  };

  const saveCampaign = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.discountValue.trim()) {
      setFeedback('Please add a campaign name, promo code, and discount value.');
      return;
    }

    setIsSavingPromotion(true);
    setFeedback(null);
    setModalWarning(null);

    try {
      let uploadedImageUrl = form.imageUrl.trim();
      if (uploadedImageUrl) {
        try {
          uploadedImageUrl = await uploadPromotionImage(uploadedImageUrl);
        } catch (error) {
          setModalWarning(error instanceof Error ? error.message : 'Image upload failed. Please try again.');
          setIsSavingPromotion(false);
          return;
        }
      }

      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: form.discountValue.trim(),
        imageUrl: uploadedImageUrl,
        endDate: form.endDate.trim(),
      };

      const isExistingPromotion = campaigns.some((campaign) => campaign.id === form.id);
      const response = await authFetch(`${API_BASE_URL}/promotions${isExistingPromotion ? `/${form.id}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse<{ promotion: PromotionApiCampaign; message?: string }>(response);
      const nextCampaign = normalizePromotion(data.promotion);

      setCampaigns((current) => {
        const exists = current.some((campaign) => campaign.id === nextCampaign.id);
        if (exists) {
          return current.map((campaign) => (campaign.id === nextCampaign.id ? nextCampaign : campaign));
        }

        return [nextCampaign, ...current];
      });

      setSelectedCampaignId(nextCampaign.id);
      setFeedback(data.message || (isExistingPromotion ? 'Promotion updated successfully.' : 'Promotion created successfully.'));
      setIsModalVisible(false);
      void loadPromotions();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to create promotion.');
    } finally {
      setIsSavingPromotion(false);
    }
  };

  const deleteCampaign = async (campaign: PromotionCampaign) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/promotions/${campaign.id}/delete`, {
        method: 'POST',
      });
      const data = await parseApiResponse<{ message?: string; id: string }>(response);

      setCampaigns((current) => current.filter((item) => item.id !== campaign.id));
      setSelectedCampaignId((current) => {
        if (current !== campaign.id) {
          return current;
        }

        const nextCampaign = campaigns.find((item) => item.id !== campaign.id);
        return nextCampaign?.id ?? '';
      });
      setFeedback(data.message || 'Promotion deleted successfully.');
      void loadPromotions();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to delete promotion.');
    }
  };

  const confirmDeleteCampaign = (campaign: PromotionCampaign) => {
    setCampaignPendingDelete(campaign);
  };

  const handleConfirmDeleteCampaign = async () => {
    if (!campaignPendingDelete) return;

    setDeletingCampaign(true);
    try {
      await deleteCampaign(campaignPendingDelete);
      setCampaignPendingDelete(null);
    } finally {
      setDeletingCampaign(false);
    }
  };

  const toggleCampaign = async (campaign: PromotionCampaign) => {
    if (updatingCampaignId) {
      return;
    }

    const nextActive = !campaign.active;
    const nextStatus: CampaignStatus = nextActive ? 'Active' : 'Paused';

    setUpdatingCampaignId(campaign.id);
    setFeedback(null);

    try {
      const response = await authFetch(`${API_BASE_URL}/promotions/${campaign.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: nextActive,
          status: nextStatus,
        }),
      });
      const data = await parseApiResponse<{ promotion: PromotionApiCampaign; message?: string }>(response);
      const updatedCampaign = normalizePromotion(data.promotion);

      setCampaigns((current) =>
        current.map((item) => (item.id === updatedCampaign.id ? updatedCampaign : item))
      );
      setFeedback(data.message || `Promotion ${nextActive ? 'activated' : 'paused'} successfully.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to update promotion status.');
    } finally {
      setUpdatingCampaignId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <RefreshableScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onRefreshPage={loadPromotions}>
          <View style={styles.topBar}>
            <Pressable style={[styles.backButton, { borderColor: palette.border }]} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
            </Pressable>
            <Text style={[styles.topBarTitle, { color: palette.textPrimary }]}>Promotions</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.heroTopRow}>
              <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
                <Ionicons name="pricetags-outline" size={26} color={palette.accent} />
              </View>

              <View style={styles.heroIdentity}>
                <Text style={[styles.heroName, { color: palette.textPrimary }]}>Promotion & Discount Management</Text>
                <Text style={[styles.heroSubline, { color: palette.textSecondary }]}>
                  Control promo codes, discount rules, active dates, and campaign usage limits.
                </Text>
              </View>
            </View>

            <View style={[styles.heroBadge, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="sparkles-outline" size={15} color={palette.accent} />
              <Text style={[styles.heroBadgeText, { color: palette.accent }]}>Campaign control</Text>
            </View>

            <Text style={[styles.heroHint, { color: palette.textSecondary }]}>
              Review campaign health before enabling offers that affect passenger fares and platform revenue.
            </Text>
          </View>

          {feedback ? <Text style={[styles.feedback, { color: palette.success }]}>{feedback}</Text> : null}

          <View style={styles.metricsRow}>
            <MetricCard label="Active" value={String(totals.activeCount)} icon="flash-outline" />
            <MetricCard label="Scheduled" value={String(totals.scheduledCount)} icon="calendar-outline" />
            <MetricCard label="Total" value={String(totals.totalCount)} icon="ticket-outline" />
          </View>

          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>PROMOTION SETUP</Text>

          <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.setupHeaderRow}>
              <View style={[styles.detailsHeader, styles.setupDetailsHeader]}>
                <View style={[styles.promotionIntroIcon, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="pricetag-outline" size={20} color={palette.accent} />
                </View>

                <View style={[styles.detailsHeaderText, styles.setupTextWrap]}>
                  <Text style={[styles.detailsTitle, { color: palette.textPrimary }]}>Create promotion record</Text>
                  <Text style={[styles.detailsHint, styles.setupHint, { color: palette.textSecondary }]}>
                    Add the promotion details passengers will use during booking.
                  </Text>
                </View>
              </View>

              <Pressable style={[styles.addPromotionButton, { backgroundColor: palette.accent }]} onPress={openCreateModal}>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.addPromotionButtonText}>Add</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>CAMPAIGNS</Text>

          {isLoadingPromotions ? (
            <View style={[styles.loadingCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <ActivityIndicator size="small" color={palette.accent} />
              <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading saved promotions...</Text>
            </View>
          ) : campaigns.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name="pricetags-outline" size={24} color={palette.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>No promotions saved</Text>
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                Use the Add button above to create your first promotion and save it to the database.
              </Text>
            </View>
          ) : (
            <View style={styles.campaignList}>
              {campaigns.map((campaign) => (
                <PromotionRow
                  key={campaign.id}
                  campaign={campaign}
                  selected={campaign.id === selectedCampaign?.id}
                  onPress={() => setSelectedCampaignId(campaign.id)}
                  onToggle={() => {
                    void toggleCampaign(campaign);
                  }}
                  onEdit={() => openEditModal(campaign)}
                  onDelete={() => confirmDeleteCampaign(campaign)}
                  isUpdating={updatingCampaignId === campaign.id}
                />
              ))}
            </View>
          )}

        </RefreshableScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={[styles.modalOverlay, { backgroundColor: palette.overlay }]}>
          <KeyboardAvoidingView style={styles.modalKeyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={[styles.modalCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>
                      {campaigns.some((campaign) => campaign.id === form.id) ? 'Update Promotion' : 'Create Promotion'}
                    </Text>
                    <Text style={[styles.modalSubtitle, { color: palette.textSecondary }]}>
                      Add the basic details passengers will see when using this offer.
                    </Text>
                  </View>

                  <Pressable style={styles.closeButton} onPress={closeModal}>
                    <Ionicons name="close" size={20} color={palette.textPrimary} />
                  </Pressable>
                </View>

                <FormInput label="Campaign name" value={form.name} onChangeText={(value) => handleChange('name', value)} />
                <FormInput
                  label="Promo code"
                  value={form.code}
                  onChangeText={(value) => handleChange('code', value.toUpperCase())}
                  autoCapitalize="characters"
                />
                <View style={[styles.imagePreviewCard, { backgroundColor: palette.input, borderColor: palette.border }]}>
                  {form.imageUrl.trim() ? (
                    <Image source={{ uri: form.imageUrl.trim() }} style={styles.imagePreview} contentFit="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={24} color={palette.accent} />
                      <Text style={[styles.imagePlaceholderText, { color: palette.textSecondary }]}>Promotion image preview</Text>
                    </View>
                  )}
                </View>

                <Pressable style={[styles.imageSelectButton, { borderColor: palette.border }]} onPress={pickPromotionImage}>
                  <Ionicons name="images-outline" size={18} color={palette.accent} />
                  <Text style={[styles.imageSelectButtonText, { color: palette.accent }]}>
                    {form.imageUrl ? 'Change gallery image' : 'Select image from gallery'}
                  </Text>
                </Pressable>

                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>Discount type</Text>
                <View style={styles.simpleChoiceRow}>
                  {(['Percentage', 'Fixed'] as DiscountType[]).map((type) => {
                    const isSelected = form.discountType === type;

                    return (
                      <Pressable
                        key={type}
                        style={[
                          styles.simpleChoiceButton,
                          {
                            backgroundColor: isSelected ? palette.accent : palette.input,
                            borderColor: isSelected ? palette.accent : palette.border,
                          },
                        ]}
                        onPress={() => handleChange('discountType', type)}>
                        <Text style={[styles.simpleChoiceText, { color: isSelected ? '#FFFFFF' : palette.textPrimary }]}>
                          {type === 'Percentage' ? 'Percentage' : 'Fixed Price'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <FormInput
                  label={form.discountType === 'Percentage' ? 'Discount percentage' : 'Fixed discount amount'}
                  value={form.discountValue}
                  onChangeText={(value) => {
                    const digits = value.replace(/\D/g, '');
                    handleChange('discountValue', form.discountType === 'Percentage' ? digits.slice(0, 3) : digits.slice(0, 6));
                  }}
                  keyboardType="numeric"
                  placeholder={form.discountType === 'Percentage' ? '25' : '300'}
                />
                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>End date</Text>
                <Pressable
                  style={[styles.dateSelectButton, { backgroundColor: palette.input, borderColor: palette.border }]}
                  onPress={() => setIsCalendarVisible((current) => !current)}>
                  <View style={styles.dateSelectLeft}>
                    <Ionicons name="calendar-outline" size={18} color={palette.accent} />
                    <Text style={[styles.dateSelectText, { color: form.endDate ? palette.textPrimary : palette.textSecondary }]}>
                      {form.endDate || 'Select end date'}
                    </Text>
                  </View>
                  <Ionicons name={isCalendarVisible ? 'chevron-up' : 'chevron-down'} size={18} color={palette.textSecondary} />
                </Pressable>

                {isCalendarVisible ? (
                  <View style={[styles.calendarCard, { backgroundColor: palette.input, borderColor: palette.border }]}>
                    <View style={styles.calendarHeader}>
                      <Pressable style={styles.calendarNavButton} onPress={() => moveCalendarMonth(-1)}>
                        <Ionicons name="chevron-back" size={18} color={palette.textPrimary} />
                      </Pressable>
                      <Text style={[styles.calendarTitle, { color: palette.textPrimary }]}>
                        {MONTH_NAMES[visibleCalendarDate.getMonth()]} {visibleCalendarDate.getFullYear()}
                      </Text>
                      <Pressable style={styles.calendarNavButton} onPress={() => moveCalendarMonth(1)}>
                        <Ionicons name="chevron-forward" size={18} color={palette.textPrimary} />
                      </Pressable>
                    </View>

                    <View style={styles.weekRow}>
                      {WEEK_DAYS.map((day) => (
                        <Text key={day} style={[styles.weekDayText, { color: palette.textSecondary }]}>
                          {day}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.calendarGrid}>
                      {getCalendarDates(visibleCalendarDate).map((date) => {
                        const value = formatDateValue(date);
                        const isCurrentMonth = date.getMonth() === visibleCalendarDate.getMonth();
                        const isSelected = value === form.endDate;

                        return (
                          <Pressable
                            key={value}
                            style={[
                              styles.calendarDayButton,
                              isSelected ? { backgroundColor: palette.accent } : null,
                            ]}
                            onPress={() => selectEndDate(date)}>
                            <Text
                              style={[
                                styles.calendarDayText,
                                {
                                  color: isSelected
                                    ? '#FFFFFF'
                                    : isCurrentMonth
                                      ? palette.textPrimary
                                      : palette.textSecondary,
                                  opacity: isCurrentMonth || isSelected ? 1 : 0.45,
                                },
                              ]}>
                              {date.getDate()}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {feedback ? <Text style={[styles.modalFeedback, { color: palette.danger }]}>{feedback}</Text> : null}
                {modalWarning ? <Text style={[styles.modalWarning, { color: palette.warning }]}>{modalWarning}</Text> : null}

                <View style={styles.modalActions}>
                  <Pressable style={[styles.secondaryButton, { borderColor: palette.border }]} onPress={closeModal}>
                    <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      { backgroundColor: palette.accent },
                      isSavingPromotion ? styles.primaryButtonDisabled : null,
                    ]}
                    onPress={saveCampaign}
                    disabled={isSavingPromotion}>
                    <Text style={styles.primaryButtonText}>{isSavingPromotion ? 'Saving...' : 'Save Promotion'}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <ConfirmDialog
        visible={Boolean(campaignPendingDelete)}
        title="Delete promotion"
        message={`Do you want to delete ${campaignPendingDelete?.name || 'this promotion'}?`}
        confirmLabel="Delete"
        destructive
        loading={deletingCampaign}
        icon="trash-outline"
        onCancel={() => {
          if (!deletingCampaign) setCampaignPendingDelete(null);
        }}
        onConfirm={handleConfirmDeleteCampaign}
      />
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

function PromotionRow({
  campaign,
  selected,
  onPress,
  onToggle,
  onEdit,
  onDelete,
  isUpdating,
}: {
  campaign: PromotionCampaign;
  selected: boolean;
  onPress: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const statusColor =
    campaign.status === 'Active' ? palette.success : campaign.status === 'Scheduled' ? palette.warning : palette.textSecondary;
  const statusBg =
    campaign.status === 'Active' ? palette.successSoft : campaign.status === 'Scheduled' ? palette.warningSoft : palette.input;

  return (
    <Pressable
      style={[
        styles.campaignRow,
        {
          backgroundColor: palette.card,
          borderColor: selected ? palette.accent : palette.border,
        },
      ]}
      onPress={onPress}>
      <View style={styles.campaignTopRow}>
        <View style={styles.campaignMain}>
          <View style={[styles.campaignIcon, { backgroundColor: palette.accentSoft }]}>
            {campaign.imageUrl ? (
              <Image source={{ uri: campaign.imageUrl }} style={styles.campaignImage} contentFit="cover" />
            ) : (
              <Ionicons name="ticket-outline" size={18} color={palette.accent} />
            )}
          </View>

          <View style={styles.campaignTextWrap}>
            <Text style={[styles.campaignName, { color: palette.textPrimary }]} numberOfLines={1}>
              {campaign.name}
            </Text>
            <Text style={[styles.campaignSubtext, { color: palette.textSecondary }]} numberOfLines={2}>
              {campaign.code} | {campaign.discountType === 'Percentage' ? `${campaign.discountValue}%` : `LKR ${campaign.discountValue}`}
            </Text>
          </View>
        </View>

        <View style={styles.campaignSwitchWrap}>
          {isUpdating ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <Switch
              value={campaign.active}
              onValueChange={onToggle}
              disabled={isUpdating}
              trackColor={{ false: '#D6E4E1', true: '#BEE6E1' }}
              thumbColor={campaign.active ? palette.accent : '#F8FAFA'}
            />
          )}
        </View>
      </View>

      <View style={styles.rowActionGroup}>
        <View style={styles.rowStatusWrap}>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>{campaign.status}</Text>
          </View>
        </View>
        <View style={styles.rowButtons}>
          <Pressable
            style={[styles.rowActionButton, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}
            onPress={onEdit}>
            <Ionicons name="create-outline" size={15} color={palette.accent} />
            <Text style={[styles.rowEditText, { color: palette.accent }]}>Edit</Text>
          </Pressable>
          <Pressable
            style={[styles.rowActionButton, { backgroundColor: '#FFF4F4', borderColor: '#F1D6D6' }]}
            onPress={onDelete}>
            <Ionicons name="trash-outline" size={15} color={palette.danger} />
            <Text style={[styles.rowDeleteText, { color: palette.danger }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'none',
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'characters';
  placeholder?: string;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={palette.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: palette.input,
            borderColor: palette.border,
            color: palette.textPrimary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  keyboardWrap: {
    flex: 1,
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
    lineHeight: 17,
    fontWeight: '500',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  feedback: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  metricsRow: {
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
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 4,
    marginBottom: 1,
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 2,
  },
  campaignList: {
    gap: 10,
    marginBottom: 12,
  },
  loadingCard: {
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    padding: 18,
    gap: 8,
    marginBottom: 12,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  campaignRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  campaignTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  campaignMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  campaignIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  campaignImage: {
    width: '100%',
    height: '100%',
  },
  campaignTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  campaignName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  campaignSubtext: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  campaignSwitchWrap: {
    minWidth: 54,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowStatusWrap: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  rowActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EAF1EF',
    flexWrap: 'wrap',
  },
  rowButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
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
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: 92,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  groupCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    padding: 12,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  setupDetailsHeader: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  setupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  promotionIntroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  detailsHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  setupTextWrap: {
    paddingRight: 2,
  },
  detailsTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  detailsHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    maxWidth: 220,
  },
  setupHint: {
    maxWidth: undefined,
  },
  addPromotionButton: {
    width: 78,
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexShrink: 0,
    marginTop: 1,
  },
  addPromotionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  modalKeyboardWrap: {
    width: '100%',
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    maxWidth: 220,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    flex: 1,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewCard: {
    height: 118,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 12,
    fontWeight: '700',
  },
  imageSelectButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  imageSelectButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  simpleChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  simpleChoiceButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  simpleChoiceText: {
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  dateSelectButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  dateSelectLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dateSelectText: {
    fontSize: 14,
    fontWeight: '700',
  },
  calendarCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  calendarHeader: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayButton: {
    width: '14.2857%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  switchRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  switchHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  modalFeedback: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalWarning: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
