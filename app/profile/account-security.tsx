import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
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
  success: '#157A62',
};

export default function AccountSecurityScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
      setErrorMessage('Please complete all password fields.');
      setSuccessMessage(null);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/profile/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await parseApiResponse<{ message: string }>(response);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSuccessMessage(data.message || 'Admin password updated successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Pressable style={[styles.backButton, { borderColor: palette.border }]} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
            </Pressable>
            <Text style={[styles.topBarTitle, { color: palette.textPrimary }]}>Account Security</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.heroTopRow}>
              <View style={[styles.heroIcon, { backgroundColor: palette.accentSoft, borderColor: palette.border }]}>
                <Ionicons name="shield-checkmark-outline" size={26} color={palette.accent} />
              </View>

              <View style={styles.heroIdentity}>
                <Text style={[styles.heroName, { color: palette.textPrimary }]}>Password protection</Text>
                <Text style={[styles.heroSubline, { color: palette.textSecondary }]}>
                  Update admin sign-in credentials and keep workspace access secure.
                </Text>
              </View>
            </View>

            <View style={[styles.heroBadge, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="lock-closed-outline" size={15} color={palette.accent} />
              <Text style={[styles.heroBadgeText, { color: palette.accent }]}>Security settings</Text>
            </View>

            <Text style={[styles.heroHint, { color: palette.textSecondary }]}>
              Use a strong password that is unique to NexGO admin operations.
            </Text>
          </View>

          {errorMessage ? <Text style={[styles.feedback, { color: palette.danger }]}>{errorMessage}</Text> : null}
          {successMessage ? <Text style={[styles.feedback, { color: palette.success }]}>{successMessage}</Text> : null}

          <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>PASSWORD CHANGE</Text>

          <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.detailsTitle, { color: palette.textPrimary }]}>Update credentials</Text>
            <Text style={[styles.detailsHint, { color: palette.textSecondary }]}>
              Enter your current password, then choose a new secure password for admin access.
            </Text>

            <PasswordField
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              visible={showCurrentPassword}
              onToggleVisibility={() => setShowCurrentPassword((current) => !current)}
            />

            <PasswordField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              visible={showNewPassword}
              onToggleVisibility={() => setShowNewPassword((current) => !current)}
            />

            <PasswordField
              label="Confirm new password"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              visible={showConfirmPassword}
              onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
            />

            <Pressable
              style={[styles.primaryButton, { backgroundColor: palette.accent }, saving ? styles.buttonDisabled : null]}
              onPress={handleSave}
              disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Updating...' : 'Update Password'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  visible,
  onToggleVisibility,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>{label}</Text>
      <View style={[styles.inputRow, { backgroundColor: palette.input, borderColor: palette.border }]}>
        <Ionicons name="lock-closed-outline" size={20} color={palette.accent} />
        <TextInput
          style={[styles.input, { color: palette.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder="Enter password"
          placeholderTextColor={palette.textSecondary}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.iconButton} onPress={onToggleVisibility} hitSlop={8}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={palette.textSecondary} />
        </Pressable>
      </View>
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
  detailsTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  detailsHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 9,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
