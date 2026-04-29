import React, { useMemo, useState } from 'react';
import {
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
  maxDiscount: string;
  minFare: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  usedCount: number;
  status: CampaignStatus;
  audience: string;
  active: boolean;
  imageUrl: string;
};

const emptyCampaign: PromotionCampaign = {
  id: '',
  name: '',
  code: '',
  discountType: 'Percentage',
  discountValue: '',
  maxDiscount: '',
  minFare: '',
  startDate: '',
  endDate: '',
  usageLimit: '',
  usedCount: 0,
  status: 'Active',
  audience: 'All passengers',
  active: true,
  imageUrl: '',
};

const initialCampaigns: PromotionCampaign[] = [
  {
    id: 'welcome-25',
    name: 'Welcome Ride Saver',
    code: 'WELCOME25',
    discountType: 'Percentage',
    discountValue: '25',
    maxDiscount: '500',
    minFare: '1200',
    startDate: '2026-04-01',
    endDate: '2026-05-15',
    usageLimit: '1000',
    usedCount: 428,
    status: 'Active',
    audience: 'New passengers',
    active: true,
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=80',
  },
  {
    id: 'weekend-300',
    name: 'Weekend City Drop',
    code: 'WEEKEND300',
    discountType: 'Fixed',
    discountValue: '300',
    maxDiscount: '300',
    minFare: '1500',
    startDate: '2026-05-03',
    endDate: '2026-06-01',
    usageLimit: '750',
    usedCount: 0,
    status: 'Scheduled',
    audience: 'Colombo riders',
    active: true,
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&q=80',
  },
  {
    id: 'loyal-15',
    name: 'Loyal Rider Boost',
    code: 'LOYAL15',
    discountType: 'Percentage',
    discountValue: '15',
    maxDiscount: '350',
    minFare: '1000',
    startDate: '2026-03-10',
    endDate: '2026-04-30',
    usageLimit: '500',
    usedCount: 312,
    status: 'Paused',
    audience: 'Repeat passengers',
    active: false,
    imageUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=600&q=80',
  },
];

export default function PromotionManagementScreen() {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState(initialCampaigns[0]?.id ?? '');
  const [form, setForm] = useState<PromotionCampaign>(emptyCampaign);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0];

  const totals = useMemo(() => {
    const activeCount = campaigns.filter((campaign) => campaign.status === 'Active' && campaign.active).length;
    const totalRedemptions = campaigns.reduce((sum, campaign) => sum + campaign.usedCount, 0);
    const scheduledCount = campaigns.filter((campaign) => campaign.status === 'Scheduled').length;

    return { activeCount, totalRedemptions, scheduledCount };
  }, [campaigns]);

  const handleChange = (field: keyof PromotionCampaign, value: string | boolean) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    setForm({
      ...emptyCampaign,
      id: `promo-${Date.now()}`,
    });
    setFeedback(null);
    setIsModalVisible(true);
  };

  const openEditModal = (campaign: PromotionCampaign) => {
    setForm(campaign);
    setFeedback(null);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
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

  const saveCampaign = () => {
    if (!form.name.trim() || !form.code.trim() || !form.discountValue.trim()) {
      setFeedback('Please add a campaign name, promo code, and discount value.');
      return;
    }

    const nextCampaign = {
      ...form,
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      maxDiscount: form.maxDiscount.trim() || (form.discountType === 'Percentage' ? '500' : form.discountValue.trim()),
      minFare: form.minFare.trim() || '0',
      startDate: form.startDate.trim() || new Date().toISOString().slice(0, 10),
      endDate: form.endDate.trim() || 'No end date',
      usageLimit: form.usageLimit.trim() || 'Unlimited',
      audience: form.audience.trim() || 'All passengers',
      status: form.active ? form.status : 'Paused',
    };

    setCampaigns((current) => {
      const exists = current.some((campaign) => campaign.id === nextCampaign.id);
      if (exists) {
        return current.map((campaign) => (campaign.id === nextCampaign.id ? nextCampaign : campaign));
      }

      return [nextCampaign, ...current];
    });

    setSelectedCampaignId(nextCampaign.id);
    setFeedback('Promotion settings saved.');
    setIsModalVisible(false);
  };

  const toggleCampaign = (campaignId: string) => {
    setCampaigns((current) =>
      current.map((campaign) => {
        if (campaign.id !== campaignId) {
          return campaign;
        }

        const nextActive = !campaign.active;
        return {
          ...campaign,
          active: nextActive,
          status: nextActive ? 'Active' : 'Paused',
        };
      })
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            <MetricCard label="Redeemed" value={totals.totalRedemptions.toLocaleString()} icon="ticket-outline" />
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
                    Add promo codes, discount limits, dates, and audience rules before publishing a campaign.
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

          <View style={styles.campaignList}>
            {campaigns.map((campaign) => (
              <PromotionRow
                key={campaign.id}
                campaign={campaign}
                selected={campaign.id === selectedCampaign?.id}
                onPress={() => setSelectedCampaignId(campaign.id)}
                onToggle={() => toggleCampaign(campaign.id)}
              />
            ))}
          </View>

          {selectedCampaign ? (
            <>
              <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>DISCOUNT RULES</Text>

              <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.detailsHeader}>
                  <View style={styles.detailsHeaderText}>
                    <Text style={[styles.detailsTitle, { color: palette.textPrimary }]}>{selectedCampaign.name}</Text>
                    <Text style={[styles.detailsHint, { color: palette.textSecondary }]}>
                      Current promo rules applied when passengers use {selectedCampaign.code}.
                    </Text>
                  </View>

                  <Pressable
                    style={[styles.compactEditButton, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}
                    onPress={() => openEditModal(selectedCampaign)}>
                    <Ionicons name="create-outline" size={14} color={palette.accent} />
                    <Text style={[styles.compactEditButtonText, { color: palette.accent }]}>Edit</Text>
                  </Pressable>
                </View>

                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Promo code" value={selectedCampaign.code} />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow
                  label="Discount"
                  value={
                    selectedCampaign.discountType === 'Percentage'
                      ? `${selectedCampaign.discountValue}% up to LKR ${selectedCampaign.maxDiscount}`
                      : `LKR ${selectedCampaign.discountValue}`
                  }
                />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Minimum fare" value={`LKR ${selectedCampaign.minFare}`} />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Campaign dates" value={`${selectedCampaign.startDate} to ${selectedCampaign.endDate}`} />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Usage" value={`${selectedCampaign.usedCount}/${selectedCampaign.usageLimit} redemptions`} />
              </View>
            </>
          ) : null}
        </ScrollView>
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
                <FormInput
                  label="End date"
                  value={form.endDate}
                  onChangeText={(value) => handleChange('endDate', value)}
                  placeholder="2026-05-30"
                />

                {feedback ? <Text style={[styles.modalFeedback, { color: palette.danger }]}>{feedback}</Text> : null}

                <View style={styles.modalActions}>
                  <Pressable style={[styles.secondaryButton, { borderColor: palette.border }]} onPress={closeModal}>
                    <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>Cancel</Text>
                  </Pressable>

                  <Pressable style={[styles.primaryButton, { backgroundColor: palette.accent }]} onPress={saveCampaign}>
                    <Text style={styles.primaryButtonText}>Save Promotion</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
}: {
  campaign: PromotionCampaign;
  selected: boolean;
  onPress: () => void;
  onToggle: () => void;
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
            {campaign.code} | {campaign.audience}
          </Text>
        </View>
      </View>

      <View style={styles.campaignRight}>
        <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>{campaign.status}</Text>
        </View>
        <Switch
          value={campaign.active}
          onValueChange={onToggle}
          trackColor={{ false: '#D6E4E1', true: '#BEE6E1' }}
          thumbColor={campaign.active ? palette.accent : '#F8FAFA'}
        />
      </View>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.textPrimary }]} numberOfLines={2}>{value || 'Not set'}</Text>
    </View>
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
  campaignRow: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 76,
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
  campaignRight: {
    width: 92,
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
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
  compactEditButton: {
    width: 72,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactEditButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  inlineDivider: {
    height: 1,
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 24,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    flex: 1,
    textAlign: 'right',
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
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
