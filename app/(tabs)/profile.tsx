import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { useAdminAuth } from '@/context/admin-auth-context';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

type ProfileSection = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  route?: '/profile/admin-details' | '/profile/promotions' | '/profile/reviews' | '/profile/account-security' | '/users';
};

const palette = {
  background: '#F4F8F7',
  card: '#FFFFFF',
  elevatedCard: '#F7FBFA',
  primaryText: '#123532',
  secondaryText: '#617C79',
  accent: '#14988F',
  accentMuted: '#E7F5F3',
  border: '#D9E9E6',
  danger: '#C13B3B',
  dangerBg: '#FFF4F4',
};

const PROFILE_SECTIONS: ProfileSection[] = [
  {
    title: 'Admin Details',
    subtitle: 'Review your identity, role, and assigned operations scope',
    icon: 'person-circle-outline',
    route: '/profile/admin-details',
  },
  {
    title: 'Promotion & Discount Management',
    subtitle: 'Manage offers, promo rules, and platform discount campaigns',
    icon: 'pricetags-outline',
    route: '/profile/promotions',
  },
  {
    title: 'User Management',
    subtitle: 'Review passengers, drivers, approvals, and account activity',
    icon: 'people-outline',
    badge: 'LIVE',
    route: '/users',
  },
  {
    title: 'Review & Rating Manager',
    subtitle: 'Approve passenger ride reviews before they appear on driver profiles',
    icon: 'star-half-outline',
    badge: 'NEW',
    route: '/profile/reviews',
  },
  {
    title: 'Account Security',
    subtitle: 'Manage password changes and protect admin sign-in security',
    icon: 'shield-checkmark-outline',
    route: '/profile/account-security',
  },
];

const PROFILE_METRICS = [
  { label: 'Approvals', value: '184', icon: 'checkmark-done-outline' as const },
  { label: 'Drivers Live', value: '326', icon: 'car-sport-outline' as const },
  { label: 'Escalations', value: '6', icon: 'alert-circle-outline' as const },
];

export default function AdminProfileScreen() {
  const { admin, logout, refreshSession } = useAdminAuth();
  const [freshAdmin, setFreshAdmin] = useState<typeof admin>(null);
  const [metrics, setMetrics] = useState({ approvals: '0', driversLive: '0', escalations: '0' });

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;

      const loadProfile = async () => {
        try {
          await refreshSession();
          const [profileResponse, analyticsResponse] = await Promise.all([
            authFetch(`${API_BASE_URL}/admin/profile`),
            authFetch(`${API_BASE_URL}/admin/dashboard/analytics`)
          ]);
          
          const profileData = await parseApiResponse<{ adminProfile: NonNullable<typeof admin> }>(profileResponse);
          const analyticsData = await parseApiResponse<{ approvals?: number; driversLive?: number; escalations?: number }>(analyticsResponse);

          if (isActive) {
            setFreshAdmin(profileData.adminProfile);
            setMetrics({
              approvals: String(analyticsData.approvals ?? 0),
              driversLive: String(analyticsData.driversLive ?? 0),
              escalations: String(analyticsData.escalations ?? 0),
            });
          }
        } catch {
          if (isActive) {
            setFreshAdmin(null);
          }
        }
      };

      void loadProfile();

      return () => {
        isActive = false;
      };
    }, [refreshSession])
  );

  const visibleAdmin = freshAdmin ?? admin;
  const adminProfile = {
    fullName: visibleAdmin?.fullName || 'NexGO Operations Admin',
    profileImageUrl: visibleAdmin?.profileImageUrl || '',
    role: visibleAdmin?.role || 'Operations Supervisor',
    scope: visibleAdmin?.scope || 'Colombo HQ command access',
  };
  const profileImageUri = adminProfile.profileImageUrl
    ? `${adminProfile.profileImageUrl}${adminProfile.profileImageUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(adminProfile.profileImageUrl)}`
    : '';
  const initials = adminProfile.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <StatusBar style="dark" />
      <RefreshableScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.profileHead}>
            <View style={[styles.avatarCircle, { backgroundColor: palette.accentMuted, borderColor: palette.border }]}>
              {profileImageUri ? (
                <Image source={{ uri: profileImageUri }} style={styles.avatarImage} contentFit="cover" cachePolicy="none" />
              ) : (
                <Text style={[styles.avatarInitials, { color: palette.accent }]}>{initials || 'A'}</Text>
              )}
            </View>

            <Text style={[styles.profileName, { color: palette.primaryText }]}>{adminProfile.fullName}</Text>
            <Text style={[styles.memberCaption, { color: palette.secondaryText }]}>{adminProfile.role}</Text>
            <Text style={[styles.roleScope, { color: palette.secondaryText }]}>{adminProfile.scope}</Text>
          </View>

          <View style={styles.metricsRow}>
            {[
              { label: 'Approvals', value: metrics.approvals, icon: 'checkmark-done-outline' as const },
              { label: 'Drivers Live', value: metrics.driversLive, icon: 'car-sport-outline' as const },
              { label: 'Escalations', value: metrics.escalations, icon: 'alert-circle-outline' as const },
            ].map((metric) => (
              <View
                key={metric.label}
                style={[styles.metricItem, { backgroundColor: palette.elevatedCard, borderColor: palette.border }]}>
                <Ionicons name={metric.icon} size={16} color={palette.accent} />
                <Text style={[styles.metricValue, { color: palette.primaryText }]}>{metric.value}</Text>
                <Text style={[styles.metricLabel, { color: palette.secondaryText }]}>{metric.label}</Text>
              </View>
            ))}
          </View>

          <Pressable style={[styles.quickActionButton, { backgroundColor: palette.accent }]}>
            <Text style={styles.quickActionText}>Open Admin Workspace</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.sectionHeadingWrap}>
          <Text style={[styles.sectionHeading, { color: palette.primaryText }]}>Admin Tools</Text>
          <Text style={[styles.sectionSubheading, { color: palette.secondaryText }]}>
            Manage your control-center profile and operating permissions
          </Text>
        </View>

        {PROFILE_SECTIONS.map((section) => (
          <Pressable
            key={section.title}
            style={[styles.settingRow, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => {
              if (section.route) {
                router.push(section.route);
              }
            }}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIconWrap, { backgroundColor: palette.accentMuted }]}>
                <Ionicons name={section.icon} size={20} color={palette.accent} />
              </View>

              <View style={styles.settingTextWrap}>
                <Text style={[styles.settingText, { color: palette.primaryText }]}>{section.title}</Text>
                <Text style={[styles.settingSubtext, { color: palette.secondaryText }]}>{section.subtitle}</Text>
              </View>
            </View>

            <View style={styles.settingRight}>
              {section.badge ? (
                <View style={[styles.badgePill, { backgroundColor: palette.accentMuted, borderColor: palette.border }]}>
                  <Text style={[styles.badgePillText, { color: palette.accent }]}>{section.badge}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={21} color={palette.secondaryText} />
            </View>
          </Pressable>
        ))}

        <Pressable
          style={[
            styles.settingRow,
            styles.logoutRow,
            { backgroundColor: palette.dangerBg, borderColor: '#F1D6D6' },
          ]}
          onPress={() => {
            logout();
            router.replace('/login');
          }}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIconWrap, { backgroundColor: '#FFE9E9' }]}>
              <Ionicons name="log-out-outline" size={20} color={palette.danger} />
            </View>

            <View style={styles.settingTextWrap}>
              <Text style={[styles.logoutRowText, { color: palette.danger }]}>Secure Sign Out</Text>
              <Text style={[styles.settingSubtext, { color: palette.secondaryText }]}>
                Leave the admin workspace on this device
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={21} color={palette.secondaryText} />
        </Pressable>

        <View style={styles.footerWrap}>
          <Text style={[styles.footerTop, { color: palette.primaryText }]}>NexGO Admin</Text>
          <Text style={[styles.footerBottom, { color: palette.secondaryText }]}>Version 1.0.0</Text>
        </View>
      </RefreshableScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 34,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  profileHead: {
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarInitials: {
    fontSize: 30,
    fontWeight: '800',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberCaption: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 3,
  },
  roleScope: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricItem: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  quickActionButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeadingWrap: {
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 2,
  },
  sectionSubheading: {
    fontSize: 12,
    fontWeight: '500',
  },
  settingRow: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextWrap: {
    flex: 1,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  settingSubtext: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 10,
  },
  badgePill: {
    borderWidth: 1,
    paddingHorizontal: 9,
    height: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  logoutRow: {
    marginTop: 6,
  },
  logoutRowText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerWrap: {
    paddingVertical: 16,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  footerTop: {
    fontSize: 14,
    marginBottom: 3,
    fontWeight: '700',
  },
  footerBottom: {
    fontSize: 12,
    fontWeight: '500',
  },
});
