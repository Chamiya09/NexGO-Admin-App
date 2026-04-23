import React from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const teal = '#008080';

export default function AdminSettingsScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>System Settings</Text>
        <Text style={styles.pageSubtitle}>
          Configure the shared commercial rules used across Passenger, Driver, and Admin operations.
        </Text>

        <View style={[styles.layout, isWide ? styles.layoutWide : null]}>
          <View style={[styles.settingsCard, isWide ? styles.settingsCardMain : null]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardEyebrow}>GLOBAL FARE CONFIG</Text>
                <Text style={styles.cardTitle}>Pricing controls</Text>
              </View>
              <View style={styles.cardBadge}>
                <Ionicons name="settings-outline" size={15} color={teal} />
                <Text style={styles.cardBadgeText}>Draft mode</Text>
              </View>
            </View>

            <View style={styles.inputGrid}>
              <SettingInput label="Base Fare ($)" value="2.50" />
              <SettingInput label="Per Km Rate ($)" value="0.95" />
              <SettingInput label="Admin Commission (%)" value="18" />
            </View>

            <Pressable style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Configuration</Text>
            </Pressable>
          </View>

          <View style={[styles.settingsCard, isWide ? styles.settingsCardSide : null]}>
            <Text style={styles.cardEyebrow}>CONFIG NOTES</Text>
            <Text style={styles.cardTitle}>Admin guidance</Text>

            <View style={styles.noteList}>
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Base fare</Text>
                <Text style={styles.noteText}>Applies at ride start before distance and demand modifiers.</Text>
              </View>
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Per km rate</Text>
                <Text style={styles.noteText}>Used to estimate passenger fare and driver-side earnings logic.</Text>
              </View>
              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Commission</Text>
                <Text style={styles.noteText}>Platform share deducted from gross fare before payout calculations.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingInput({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        defaultValue={value}
        placeholderTextColor="#93A5A2"
        style={styles.input}
      />
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  pageTitle: {
    color: '#102A28',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#617C79',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 18,
    maxWidth: 760,
  },
  layout: {
    gap: 16,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  settingsCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  settingsCardMain: {
    flex: 1.35,
  },
  settingsCardSide: {
    flex: 1,
    maxWidth: 360,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  cardEyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  cardTitle: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardBadgeText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  inputGrid: {
    gap: 12,
    marginBottom: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    color: '#102A28',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  noteList: {
    gap: 12,
  },
  noteCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
  },
  noteTitle: {
    color: '#102A28',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  noteText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
});
