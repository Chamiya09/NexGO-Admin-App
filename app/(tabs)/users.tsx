import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const teal = '#008080';

const passengerUsers = [
  { id: 'P-1023', name: 'Ayesha Perera', status: 'Active', trips: 42 },
  { id: 'P-1188', name: 'Nimal Fernando', status: 'Active', trips: 17 },
  { id: 'P-1204', name: 'Shenali Silva', status: 'Flagged', trips: 64 },
];

const driverUsers = [
  {
    id: 'D-840',
    name: 'Kasun Jayasinghe',
    status: 'Pending Approval',
    vehicle: 'Mini',
    documents: ['License', 'Insurance'],
  },
  {
    id: 'D-841',
    name: 'Chamara Wijesinghe',
    status: 'Pending Approval',
    vehicle: 'Van',
    documents: ['License', 'Insurance'],
  },
];

export default function AdminUsersScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;
  const [activeTab, setActiveTab] = useState<'passengers' | 'drivers'>('drivers');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>User & Driver Management</Text>
        <Text style={styles.pageSubtitle}>
          Review rider activity, manage account trust, and process driver approval queues from one place.
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === 'passengers' ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab('passengers')}>
            <Text style={[styles.tabButtonText, activeTab === 'passengers' ? styles.tabButtonTextActive : null]}>
              Passengers
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'drivers' ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab('drivers')}>
            <Text style={[styles.tabButtonText, activeTab === 'drivers' ? styles.tabButtonTextActive : null]}>
              Drivers
            </Text>
          </Pressable>
        </View>

        {activeTab === 'drivers' ? (
          <View style={[styles.splitLayout, isWide ? styles.splitLayoutWide : null]}>
            <View style={[styles.panelCard, isWide ? styles.mainPanel : null]}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelEyebrow}>PENDING APPROVALS</Text>
                  <Text style={styles.panelTitle}>Driver review queue</Text>
                </View>
                <View style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{driverUsers.length} waiting</Text>
                </View>
              </View>

              {driverUsers.map((driver) => (
                <View key={driver.id} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <View>
                      <Text style={styles.reviewName}>{driver.name}</Text>
                      <Text style={styles.reviewMeta}>{driver.id} | {driver.vehicle} | {driver.status}</Text>
                    </View>
                    <View style={styles.reviewStatusPill}>
                      <Text style={styles.reviewStatusText}>Needs action</Text>
                    </View>
                  </View>

                  <View style={styles.documentRow}>
                    {driver.documents.map((document) => (
                      <Pressable key={document} style={styles.documentCard}>
                        <Ionicons name="document-attach-outline" size={18} color={teal} />
                        <Text style={styles.documentText}>{document}</Text>
                        <Text style={styles.documentLink}>View</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable style={styles.rejectButton}>
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </Pressable>
                    <Pressable style={styles.approveButton}>
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.panelCard, isWide ? styles.sidePanel : null]}>
              <Text style={styles.panelEyebrow}>CHECKLIST</Text>
              <Text style={styles.panelTitle}>Approval policy</Text>
              <View style={styles.policyList}>
                <PolicyRow text="Confirm license upload is readable and matches the driver profile." />
                <PolicyRow text="Check insurance upload validity before approval." />
                <PolicyRow text="Reject incomplete document submissions with a note to resubmit." />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.panelCard}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelEyebrow}>PASSENGER ACCOUNTS</Text>
                <Text style={styles.panelTitle}>Active and flagged users</Text>
              </View>
              <View style={styles.panelBadge}>
                <Text style={styles.panelBadgeText}>{passengerUsers.length} visible</Text>
              </View>
            </View>

            {passengerUsers.map((user) => (
              <View key={user.id} style={styles.passengerRow}>
                <View style={styles.passengerIdentity}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{user.name[0]}</Text>
                  </View>
                  <View>
                    <Text style={styles.reviewName}>{user.name}</Text>
                    <Text style={styles.reviewMeta}>{user.id} | {user.status} | {user.trips} rides</Text>
                  </View>
                </View>
                <Pressable style={styles.suspendButton}>
                  <Text style={styles.suspendButtonText}>Suspend Account</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PolicyRow({ text }: { text: string }) {
  return (
    <View style={styles.policyRow}>
      <View style={styles.policyDot} />
      <Text style={styles.policyText}>{text}</Text>
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
    maxWidth: 720,
  },
  tabRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 16,
    backgroundColor: '#E7F5F3',
    padding: 4,
    marginBottom: 18,
    gap: 4,
  },
  tabButton: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  tabButtonText: {
    color: '#3D5F5B',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: teal,
  },
  splitLayout: {
    gap: 16,
  },
  splitLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainPanel: {
    flex: 1.6,
  },
  sidePanel: {
    flex: 1,
  },
  panelCard: {
    borderRadius: 22,
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
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  panelEyebrow: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  panelTitle: {
    color: '#102A28',
    fontSize: 20,
    fontWeight: '800',
  },
  panelBadge: {
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  panelBadgeText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  reviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
    marginBottom: 12,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  reviewName: {
    color: '#102A28',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  reviewMeta: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  reviewStatusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#FFF1DA',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewStatusText: {
    color: '#A16207',
    fontSize: 11,
    fontWeight: '800',
  },
  documentRow: {
    gap: 10,
    marginBottom: 12,
  },
  documentCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  documentText: {
    color: '#102A28',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  documentLink: {
    color: teal,
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  rejectButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF4F4',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButtonText: {
    color: '#C13B3B',
    fontSize: 13,
    fontWeight: '800',
  },
  approveButton: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: teal,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  policyList: {
    gap: 12,
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    backgroundColor: '#F7FBFA',
    padding: 12,
  },
  policyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: teal,
    marginTop: 4,
  },
  policyText: {
    flex: 1,
    color: '#617C79',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  passengerRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  passengerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: teal,
    fontSize: 16,
    fontWeight: '800',
  },
  suspendButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#C13B3B',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suspendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
