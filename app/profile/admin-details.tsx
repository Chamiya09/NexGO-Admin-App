import React, { useCallback, useEffect, useState } from 'react';
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
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
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
  overlay: 'rgba(7, 21, 19, 0.45)',
  success: '#157A62',
};

const initialAdmin = {
  fullName: 'NexGO Operations Admin',
  email: 'admin@nexgo.lk',
  phoneNumber: '+94 77 123 4567',
  role: 'Operations Supervisor',
  office: 'Colombo HQ',
  shift: 'Full operations coverage',
};

type AdminProfile = typeof initialAdmin;

export default function AdminDetailsScreen() {
  const [form, setForm] = useState(initialAdmin);
  const [savedAdmin, setSavedAdmin] = useState(initialAdmin);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const initials = savedAdmin.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const handleChange = (field: keyof typeof initialAdmin, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openEditModal = () => {
    setForm(savedAdmin);
    setIsEditModalVisible(true);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const closeEditModal = () => {
    if (saving) {
      return;
    }

    setIsEditModalVisible(false);
  };

  const loadAdminProfile = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/profile`);
      const data = await parseApiResponse<{ adminProfile: AdminProfile }>(response);

      setSavedAdmin(data.adminProfile);
      setForm(data.adminProfile);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load admin details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminProfile();
  }, [loadAdminProfile]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        role: form.role.trim(),
        office: form.office.trim(),
        shift: form.shift.trim(),
      };

      const response = await fetch(`${API_BASE_URL}/admin/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await parseApiResponse<{ adminProfile: AdminProfile }>(response);

      setSavedAdmin(data.adminProfile);
      setForm(data.adminProfile);
      setIsEditModalVisible(false);
      setSuccessMessage('Admin details updated successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update admin details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <RefreshableScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onRefreshPage={loadAdminProfile}>
          <View style={[styles.topBar, { borderColor: palette.border }]}>
            <Pressable style={[styles.backButton, { borderColor: palette.border }]} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
            </Pressable>
            <Text style={[styles.topBarTitle, { color: palette.textPrimary }]}>Admin Details</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.heroTopRow}>
              <View style={[styles.heroAvatar, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
                <Text style={[styles.heroAvatarInitials, { color: palette.accent }]}>{initials || 'A'}</Text>
              </View>

              <View style={styles.heroIdentity}>
                <Text style={[styles.heroName, { color: palette.textPrimary }]}>{savedAdmin.fullName}</Text>
                <Text style={[styles.heroSubline, { color: palette.textSecondary }]}>
                  Admin profile, operations scope, and contact details
                </Text>
              </View>
            </View>

            <View style={[styles.heroBadge, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={15} color={palette.accent} />
              <Text style={[styles.heroBadgeText, { color: palette.accent }]}>Trusted workspace access</Text>
            </View>

            <Text style={[styles.heroHint, { color: palette.textSecondary }]}>
              Keep admin identity details current so approvals, escalations, and control-center ownership stay clear.
            </Text>
          </View>

          {errorMessage ? <Text style={[styles.feedback, { color: '#C13B3B' }]}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={[styles.feedback, { color: palette.success }]}>{successMessage}</Text> : null}

          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>ADMIN DETAILS</Text>

          <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.detailsHeader}>
              <View>
                <Text style={[styles.detailsTitle, { color: palette.textPrimary }]}>Account information</Text>
                <Text style={[styles.detailsHint, { color: palette.textSecondary }]}>
                  Review the current admin identity assigned to this app workspace.
                </Text>
              </View>

              <Pressable
                style={[styles.compactEditButton, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}
                onPress={openEditModal}>
                <Ionicons name="create-outline" size={14} color={palette.accent} />
                <Text style={[styles.compactEditButtonText, { color: palette.accent }]}>Edit</Text>
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading admin details...</Text>
              </View>
            ) : (
              <>
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Full name" value={savedAdmin.fullName} />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Email" value={savedAdmin.email} />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Phone number" value={savedAdmin.phoneNumber} />
                <View style={[styles.inlineDivider, { backgroundColor: palette.border }]} />
                <DetailRow label="Role" value={savedAdmin.role} />
              </>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>OPERATIONS SCOPE</Text>

          <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={palette.accent} />
                <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading scope...</Text>
              </View>
            ) : (
              <View style={styles.scopeCard}>
                <View style={[styles.scopeIconWrap, { backgroundColor: palette.accentSoft }]}>
                  <Ionicons name="business-outline" size={18} color={palette.accent} />
                </View>
                <View style={styles.scopeTextWrap}>
                  <Text style={[styles.scopeTitle, { color: palette.textPrimary }]}>{savedAdmin.office}</Text>
                  <Text style={[styles.scopeText, { color: palette.textSecondary }]}>{savedAdmin.shift}</Text>
                </View>
              </View>
            )}
          </View>
        </RefreshableScrollView>
      </KeyboardAvoidingView>

      <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={closeEditModal}>
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
                    <Text style={[styles.modalTitle, { color: palette.textPrimary }]}>Update Admin Details</Text>
                    <Text style={[styles.modalSubtitle, { color: palette.textSecondary }]}>
                      Edit the workspace owner details for this admin session.
                    </Text>
                  </View>

                  <Pressable style={styles.closeButton} onPress={closeEditModal} disabled={saving}>
                    <Ionicons name="close" size={20} color={palette.textPrimary} />
                  </Pressable>
                </View>

                <FormInput label="Full name" value={form.fullName} onChangeText={(value) => handleChange('fullName', value)} />
                <FormInput
                  label="Email"
                  value={form.email}
                  onChangeText={(value) => handleChange('email', value)}
                  keyboardType="email-address"
                />
                <FormInput
                  label="Phone number"
                  value={form.phoneNumber}
                  onChangeText={(value) => handleChange('phoneNumber', value)}
                  keyboardType="phone-pad"
                />
                <FormInput label="Role" value={form.role} onChangeText={(value) => handleChange('role', value)} />
                <FormInput label="Office" value={form.office} onChangeText={(value) => handleChange('office', value)} />
                <FormInput label="Shift coverage" value={form.shift} onChangeText={(value) => handleChange('shift', value)} />

                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.secondaryButton, { borderColor: palette.border }]}
                    onPress={closeEditModal}
                    disabled={saving}>
                    <Text style={[styles.secondaryButtonText, { color: palette.textPrimary }]}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      styles.modalSubmitButton,
                      { backgroundColor: palette.accent },
                      saving ? styles.buttonDisabled : null,
                    ]}
                    onPress={handleSave}
                    disabled={saving}>
                    <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Update Details'}</Text>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.textPrimary }]}>{value || 'Not set'}</Text>
    </View>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCorrect={false}
        autoCapitalize="none"
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
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroAvatarInitials: {
    fontSize: 18,
    fontWeight: '800',
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
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 2,
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
  compactEditButton: {
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 22,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 0,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  inlineDivider: {
    height: 1,
    marginVertical: 10,
  },
  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: '#F7FBFA',
    padding: 12,
  },
  scopeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeTextWrap: {
    flex: 1,
  },
  scopeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  scopeText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
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
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitButton: {
    marginTop: 0,
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
