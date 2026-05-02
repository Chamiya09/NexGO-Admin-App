import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

const teal = '#008080';
const PDF_PREVIEW_PAGE_LIMIT = 12;

type PassengerUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  createdAt?: string;
};

type PassengerFilter = 'all' | 'with-photo' | 'no-photo' | 'with-phone';

const passengerFilters: Array<{ label: string; value: PassengerFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'With Photo', value: 'with-photo' },
  { label: 'No Photo', value: 'no-photo' },
  { label: 'With Phone', value: 'with-phone' },
];

type DriverUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  status?: string;
  documents?: {
    documentType: string;
    fileUrl: string;
    status: string;
    submittedAt?: string;
  }[];
  vehicle?: {
    category?: string;
    make?: string;
    model?: string;
    plateNumber?: string;
  } | null;
};

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  role?: string;
  scope?: string;
  office?: string;
  shift?: string;
};

type NewAdminForm = {
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  scope: string;
  office: string;
  shift: string;
  password: string;
};

const emptyNewAdminForm: NewAdminForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  role: 'Operations Admin',
  scope: 'NexGO Control Center',
  office: 'Colombo HQ',
  shift: 'Full operations coverage',
  password: '',
};

export default function AdminUsersScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 1100;
  const [activeTab, setActiveTab] = useState<'passengers' | 'drivers' | 'admins'>('drivers');
  const [passengerUsers, setPassengerUsers] = useState<PassengerUser[]>([]);
  const [driverUsers, setDriverUsers] = useState<DriverUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [newAdminForm, setNewAdminForm] = useState<NewAdminForm>(emptyNewAdminForm);
  const [createAdminModalVisible, setCreateAdminModalVisible] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminFormMessage, setAdminFormMessage] = useState<string | null>(null);
  const [adminFormError, setAdminFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passengerFilter, setPassengerFilter] = useState<PassengerFilter>('all');
  const [passengerSearch, setPassengerSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [driverStatusFilter, setDriverStatusFilter] = useState<DriverStatusFilter>('all');

  const [docModalVisible, setDocModalVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverUser | null>(null);
  const [docReviewing, setDocReviewing] = useState<string | null>(null);

  const loadManagementData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [usersResponse, driversResponse, adminsResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/auth/users`),
        authFetch(`${API_BASE_URL}/driver-auth/drivers`),
        authFetch(`${API_BASE_URL}/admin/admins`),
      ]);

      const [{ users }, { drivers }, { admins }] = await Promise.all([
        parseApiResponse<{ users: PassengerUser[] }>(usersResponse),
        parseApiResponse<{ drivers: DriverUser[] }>(driversResponse),
        parseApiResponse<{ admins: AdminUser[] }>(adminsResponse),
      ]);

      setPassengerUsers(users);
      setDriverUsers(drivers);
      setAdminUsers(admins);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load management data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadManagementData();
  }, [loadManagementData]);

  const handleManageDriverDocs = useCallback((driver: DriverUser) => {
    if (!driver.id) return;
    setSelectedDriver(driver);
    setDocModalVisible(true);
  }, []);

  const handleReviewDocument = useCallback(async (driverId: string, documentType: string, status: 'approved' | 'rejected') => {
    try {
      setErrorMessage(null);
      setDocReviewing(documentType);
      const res = await authFetch(`${API_BASE_URL}/driver-auth/drivers/${driverId}/documents/${documentType}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await parseApiResponse(res);
      const isSuccess =
        typeof data === 'object' &&
        data !== null &&
        'success' in data
          ? Boolean((data as { success?: boolean }).success)
          : true;

      if (!isSuccess) {
        const message =
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message?: string }).message)
            : null;
        setErrorMessage(message || `Failed to ${status} document`);
      } else {
        // Update local driver + modal state without refetching full lists.
        setDriverUsers((current) =>
          current.map((driver) => {
            if (driver.id !== driverId) return driver;
            const updatedDocs = driver.documents?.map((doc) =>
              doc.documentType === documentType ? { ...doc, status } : doc
            );
            return { ...driver, documents: updatedDocs };
          })
        );
        setSelectedDriver(prev => {
          if (!prev) return prev;
          const updatedDocs = prev.documents?.map(doc =>
            doc.documentType === documentType ? { ...doc, status } : doc
          );
          return { ...prev, documents: updatedDocs };
        });
      }
    } catch (err) {
      setErrorMessage(`Network error reviewing document`);
      console.error(err);
    } finally {
      setDocReviewing(null);
    }
  }, [loadManagementData]);

  const driverStats = useMemo(() => getDriverStats(driverUsers), [driverUsers]);

  const passengerStats = useMemo(() => {
    const total = passengerUsers.length;
    const withPhoto = passengerUsers.filter((user) => Boolean(user.profileImageUrl)).length;
    const withPhone = passengerUsers.filter((user) => Boolean(user.phoneNumber)).length;
    const noPhoto = total - withPhoto;

    return { total, withPhoto, withPhone, noPhoto };
  }, [passengerUsers]);

  const filteredPassengers = useMemo(() => {
    const normalizedSearch = passengerSearch.trim().toLowerCase();

    return passengerUsers.filter((user) => {
      // Filter by status/photo
      if (passengerFilter === 'with-photo' && !user.profileImageUrl) return false;
      if (passengerFilter === 'no-photo' && user.profileImageUrl) return false;
      if (passengerFilter === 'with-phone' && !user.phoneNumber) return false;

      if (!normalizedSearch) return true;

      // Filter by search text
      return [
        user.fullName,
        user.email,
        user.phoneNumber,
        user.id,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [passengerUsers, passengerFilter, passengerSearch]);

  const filteredDrivers = useMemo(() => {
    const normalizedSearch = driverSearch.trim().toLowerCase();

    return driverUsers.filter((driver) => {
      const normalizedStatus = normalizeDriverStatus(driver.status);

      if (driverStatusFilter !== 'all' && normalizedStatus !== driverStatusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        driver.fullName,
        driver.email,
        driver.phoneNumber,
        driver.vehicle?.plateNumber,
        driver.vehicle?.make,
        driver.vehicle?.model,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedSearch));
    });
  }, [driverUsers, driverSearch, driverStatusFilter]);

  const openCreateAdminModal = () => {
    setAdminFormError(null);
    setAdminFormMessage(null);
    setCreateAdminModalVisible(true);
  };

  const closeCreateAdminModal = () => {
    if (!creatingAdmin) {
      setCreateAdminModalVisible(false);
      setAdminFormError(null);
    }
  };

  const handleNewAdminChange = (field: keyof NewAdminForm, value: string) => {
    setNewAdminForm((current) => ({ ...current, [field]: value }));
    setAdminFormError(null);
    setAdminFormMessage(null);
  };

  const createAdminAccount = async () => {
    setCreatingAdmin(true);
    setAdminFormError(null);
    setAdminFormMessage(null);

    try {
      const response = await authFetch(`${API_BASE_URL}/admin/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdminForm),
      });
      const data = await parseApiResponse<{ admin: AdminUser; message?: string }>(response);

      setAdminUsers((current) => [data.admin, ...current.filter((admin) => admin.id !== data.admin.id)]);
      setNewAdminForm(emptyNewAdminForm);
      setAdminFormMessage(data.message || 'Admin account created successfully.');
      setCreateAdminModalVisible(false);
    } catch (error) {
      setAdminFormError(error instanceof Error ? error.message : 'Unable to create admin account.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <RefreshableScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        onRefreshPage={loadManagementData}>
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#102A28" />
          </Pressable>
          <Text style={styles.topBarTitle}>Users</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="people-outline" size={24} color={teal} />
            </View>
            <View style={styles.heroIdentity}>
              <Text style={styles.heroName}>User & Driver Management</Text>
              <Text style={styles.heroSubline}>
                Review rider activity, manage account trust, and coordinate driver operations in one workspace.
              </Text>
            </View>
          </View>

          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={teal} />
            <Text style={styles.heroBadgeText}>Operations control</Text>
          </View>

          <Text style={styles.heroHint}>
            Switch between admins, passengers, and drivers to keep profiles verified and supported.
          </Text>
        </View>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === 'admins' ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab('admins')}>
            <Text
              style={[styles.tabButtonText, activeTab === 'admins' ? styles.tabButtonTextActive : null]}
              numberOfLines={1}>
              Admins
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'passengers' ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab('passengers')}>
            <Text
              style={[styles.tabButtonText, activeTab === 'passengers' ? styles.tabButtonTextActive : null]}
              numberOfLines={1}>
              Passengers
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabButton, activeTab === 'drivers' ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab('drivers')}>
            <Text
              style={[styles.tabButtonText, activeTab === 'drivers' ? styles.tabButtonTextActive : null]}
              numberOfLines={1}>
              Drivers
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="small" color={teal} />
            <Text style={styles.stateText}>Loading management data...</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.stateCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#C13B3B" />
            <Text style={styles.stateErrorText}>{errorMessage}</Text>
          </View>
        ) : activeTab === 'admins' ? (
          <View style={styles.panelCard}>
            <View style={[styles.panelHeader, { alignItems: 'flex-start', flexWrap: 'nowrap' }]}>
              <View style={styles.adminHeaderTitleWrap}>
                <Text style={styles.panelEyebrow}>ADMIN ACCOUNTS</Text>
                <Text style={styles.panelTitle}>Admin management</Text>
              </View>
              <View style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 1 }}>
                <View style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{adminUsers.length} admins</Text>
                </View>
                <Pressable style={styles.createAdminButton} onPress={openCreateAdminModal}>
                  <View style={styles.createAdminIcon}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.createAdminButtonText}>Add Admin</Text>
                </Pressable>
              </View>
            </View>

            {adminFormMessage ? <Text style={styles.formSuccessText}>{adminFormMessage}</Text> : null}

            {adminUsers.length === 0 ? (
              <EmptyStateCard icon="shield-outline" text="No admin accounts were returned by the backend." />
            ) : null}

            {adminUsers.map((admin) => (
              <View key={admin.id} style={styles.passengerRow}>
                <View style={styles.passengerIdentity}>
                  <ProfileAvatar imageUrl={admin.profileImageUrl} name={admin.fullName} fallback="A" />
                  <View style={styles.reviewTextWrap}>
                    <Text style={styles.reviewName}>{admin.fullName}</Text>
                    <Text style={styles.reviewMeta}>
                      {admin.email} | {admin.phoneNumber || 'No phone'}
                    </Text>
                    <Text style={styles.reviewDetailLine}>
                      {admin.role || 'Operations Admin'} | {admin.office || 'Colombo HQ'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : activeTab === 'drivers' ? (
          <View style={[styles.splitLayout, isWide ? styles.splitLayoutWide : null]}>
            <View style={[styles.panelCard, isWide ? styles.mainPanel : null]}>
              <View style={[styles.panelHeader, { alignItems: 'flex-start', flexWrap: 'nowrap' }]}>
                <View style={styles.adminHeaderTitleWrap}>
                  <Text style={styles.panelEyebrow}>DRIVER MANAGEMENT</Text>
                  <Text style={styles.panelTitle}>Fleet overview & action center</Text>
                </View>
                <View style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{driverStats.total} drivers</Text>
                </View>
              </View>

              <View style={styles.driverStatsRow}>
                <DriverStatCard label="Active" value={driverStats.active} accent="#0F766E" />
                <DriverStatCard label="Pending" value={driverStats.pending} accent="#A16207" />
                <DriverStatCard label="Suspended" value={driverStats.suspended} accent="#C13B3B" />
                <DriverStatCard label="Inactive" value={driverStats.inactive} accent="#64748B" />
              </View>

              <View style={styles.driverControlsRow}>
                <View style={styles.driverSearchWrap}>
                  <Ionicons name="search-outline" size={16} color="#7A908D" />
                  <TextInput
                    style={styles.driverSearchInput}
                    placeholder="Search by name, email, phone, plate"
                    placeholderTextColor="#8AA19E"
                    value={driverSearch}
                    onChangeText={setDriverSearch}
                  />
                </View>
                <View style={styles.driverFilterRow}>
                  {driverStatusFilters.map((filter) => (
                    <Pressable
                      key={filter.value}
                      style={[
                        styles.driverFilterChip,
                        driverStatusFilter === filter.value ? styles.driverFilterChipActive : null,
                      ]}
                      onPress={() => setDriverStatusFilter(filter.value)}>
                      <Text
                        style={[
                          styles.driverFilterText,
                          driverStatusFilter === filter.value ? styles.driverFilterTextActive : null,
                        ]}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {filteredDrivers.length === 0 ? (
                <EmptyStateCard icon="car-outline" text="No drivers match the current filters." />
              ) : null}

              {filteredDrivers.map((driver) => (
                <View key={driver.id} style={styles.driverCard}>
                  <View style={styles.driverCardHeader}>
                    <View style={styles.driverIdentity}>
                      <ProfileAvatar
                        imageUrl={driver.profileImageUrl}
                        name={driver.fullName}
                        fallback="D"
                        size={46}
                      />
                      <View style={styles.driverTextWrap}>
                        <Text style={styles.driverName}>{driver.fullName}</Text>
                        <Text style={styles.driverMeta} numberOfLines={1}>
                          {driver.email} | {driver.phoneNumber || 'No phone'}
                        </Text>
                        <Text style={styles.driverDetailLine} numberOfLines={1}>
                          {formatVehicle(driver.vehicle)} | {driver.vehicle?.plateNumber || 'No plate'}
                        </Text>
                      </View>
                    </View>
                    <DriverStatusPill status={normalizeDriverStatus(driver.status)} />
                  </View>

                  <View style={styles.driverMetaRow}>
                    <DriverMetaItem icon="finger-print-outline" label="Driver ID" value={formatDriverId(driver.id)} />
                    <DriverMetaItem icon="car-outline" label="Vehicle" value={formatVehicle(driver.vehicle)} />
                    <DriverMetaItem
                      icon="pulse-outline"
                      label="Status"
                      value={formatDriverStatusLabel(driver.status)}
                    />
                  </View>

                  <View style={styles.driverActionRow}>
                    <DriverActionButton
                      icon="document-text-outline"
                      label="Docs"
                      onPress={() => handleManageDriverDocs(driver)}
                    />
                    <DriverActionButton
                      icon="call-outline"
                      label="Call"
                      onPress={() => handleDriverCall(driver.phoneNumber)}
                    />
                    <DriverActionButton
                      icon="chatbubble-outline"
                      label="Message"
                      onPress={() => handleDriverMessage(driver.phoneNumber)}
                    />
                    <DriverActionButton icon="person-outline" label="View" />
                    <DriverActionButton icon="ban-outline" label="Suspend" variant="danger" />
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.panelCard, isWide ? styles.sidePanel : null]}>
              <Text style={styles.panelEyebrow}>ACTIONS</Text>
              <Text style={styles.panelTitle}>Driver support playbook</Text>
              <View style={styles.policyList}>
                <PolicyRow text="Reach out before suspensions to confirm driver context." />
                <PolicyRow text="Use the call or message shortcut for urgent route issues." />
                <PolicyRow text="Record status changes in the driver notes log." />
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.splitLayout, isWide ? styles.splitLayoutWide : null]}>
            <View style={[styles.panelCard, isWide ? styles.mainPanel : null]}>
              <View style={[styles.panelHeader, { alignItems: 'flex-start', flexWrap: 'nowrap' }]}>
                <View style={styles.adminHeaderTitleWrap}>
                  <Text style={styles.panelEyebrow}>PASSENGER MANAGEMENT</Text>
                  <Text style={styles.panelTitle}>Passenger overview & actions</Text>
                </View>
                <View style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{passengerStats.total} passengers</Text>
                </View>
              </View>

              <View style={styles.driverStatsRow}>
                <DriverStatCard label="Total" value={passengerStats.total} accent="#0F766E" />
                <DriverStatCard label="With Photo" value={passengerStats.withPhoto} accent="#0F766E" />
                <DriverStatCard label="With Phone" value={passengerStats.withPhone} accent="#0F766E" />
                <DriverStatCard label="No Photo" value={passengerStats.noPhoto} accent="#64748B" />
              </View>

              <View style={styles.driverControlsRow}>
                <View style={styles.driverSearchWrap}>
                  <Ionicons name="search-outline" size={16} color="#7A908D" />
                  <TextInput
                    style={styles.driverSearchInput}
                    placeholder="Search by name, email, phone"
                    placeholderTextColor="#8AA19E"
                    value={passengerSearch}
                    onChangeText={setPassengerSearch}
                  />
                </View>
                <View style={styles.driverFilterRow}>
                  {passengerFilters.map((filter) => (
                    <Pressable
                      key={filter.value}
                      style={[
                        styles.driverFilterChip,
                        passengerFilter === filter.value ? styles.driverFilterChipActive : null,
                      ]}
                      onPress={() => setPassengerFilter(filter.value)}>
                      <Text
                        style={[
                          styles.driverFilterText,
                          passengerFilter === filter.value ? styles.driverFilterTextActive : null,
                        ]}>
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {filteredPassengers.length === 0 ? (
                <EmptyStateCard icon="people-outline" text="No passenger accounts match the selected filter." />
              ) : null}

              {filteredPassengers.map((user) => (
                <PassengerAccountCard key={user.id} user={user} />
              ))}
            </View>

            <View style={[styles.panelCard, isWide ? styles.sidePanel : null]}>
              <Text style={styles.panelEyebrow}>ACTIONS</Text>
              <Text style={styles.panelTitle}>Passenger support playbook</Text>
              <View style={styles.policyList}>
                <PolicyRow text="Verify passenger details before issuing refunds." />
                <PolicyRow text="Encourage users to upload profile photos for safety." />
                <PolicyRow text="Watch for multiple accounts using the same phone number." />
              </View>
            </View>
          </View>
        )}
      </RefreshableScrollView>

      <CreateAdminModal
        visible={createAdminModalVisible}
        form={newAdminForm}
        errorMessage={adminFormError}
        creating={creatingAdmin}
        onChange={handleNewAdminChange}
        onCreate={createAdminAccount}
        onClose={closeCreateAdminModal}
      />
      <DriverDocsModal
        visible={docModalVisible}
        driver={selectedDriver}
        onClose={() => {
          setDocModalVisible(false);
          setSelectedDriver(null);
        }}
        onReview={handleReviewDocument}
        reviewingDoc={docReviewing}
      />
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

function EmptyStateCard({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.emptyStateCard}>
      <Ionicons name={icon} size={18} color={teal} />
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={17} color={teal} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function PassengerAccountCard({ user }: { user: PassengerUser }) {
  return (
    <View style={styles.passengerAccountCard}>
      <View style={styles.passengerCardTopRow}>
        <View style={styles.passengerIdentity}>
          <ProfileAvatar imageUrl={user.profileImageUrl} name={user.fullName} fallback="P" size={48} />
          <View style={styles.passengerTextWrap}>
            <Text style={styles.passengerName} numberOfLines={1}>{user.fullName}</Text>
            <Text style={styles.passengerSubtitle} numberOfLines={1}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.passengerStatusPill}>
          <View style={styles.passengerStatusDot} />
          <Text style={styles.passengerStatusText}>Active</Text>
        </View>
      </View>

      <View style={styles.passengerMetaGrid}>
        <PassengerMetaItem icon="finger-print-outline" label="Passenger ID" value={formatShortId(user.id)} />
        <PassengerMetaItem icon="call-outline" label="Phone" value={user.phoneNumber || 'No phone'} />
      </View>

      <View style={styles.passengerCardFooter}>
        <View style={styles.passengerProfileState}>
          <Ionicons
            name={user.profileImageUrl ? 'image-outline' : 'close-circle-outline'}
            size={15}
            color={user.profileImageUrl ? teal : '#8AA19E'}
          />
          <Text style={styles.passengerProfileStateText}>
            {user.profileImageUrl ? 'Profile photo added' : 'No profile photo'}
          </Text>
        </View>
        <Pressable style={styles.suspendButton}>
          <Ionicons name="ban-outline" size={15} color="#C13B3B" />
          <Text style={styles.suspendButtonText}>Suspend</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PassengerMetaItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.passengerMetaItem}>
      <Ionicons name={icon} size={16} color={teal} />
      <View style={styles.passengerMetaTextWrap}>
        <Text style={styles.passengerMetaLabel}>{label}</Text>
        <Text style={styles.passengerMetaValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function AdminInput({
  label,
  ...inputProps
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.adminInputGroup}>
      <Text style={styles.adminInputLabel}>{label}</Text>
      <TextInput
        style={styles.adminInput}
        placeholderTextColor="#8AA19E"
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  );
}

function CreateAdminModal({
  visible,
  form,
  errorMessage,
  creating,
  onChange,
  onCreate,
  onClose,
}: {
  visible: boolean;
  form: NewAdminForm;
  errorMessage: string | null;
  creating: boolean;
  onChange: (field: keyof NewAdminForm, value: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.createAdminModalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTextWrap}>
              <Text style={styles.modalTitle}>Create Admin</Text>
              <Text style={styles.modalSubtitle}>Add a new admin account for the operations workspace.</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose} disabled={creating}>
              <Ionicons name="close" size={20} color="#102A28" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.createAdminFormScroll}
            contentContainerStyle={styles.createAdminFormContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <AdminInput
              label="Full name"
              value={form.fullName}
              onChangeText={(value) => onChange('fullName', value)}
            />
            <AdminInput
              label="Email"
              value={form.email}
              onChangeText={(value) => onChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AdminInput
              label="Phone number"
              value={form.phoneNumber}
              onChangeText={(value) => onChange('phoneNumber', value)}
              keyboardType="phone-pad"
            />
            <AdminInput
              label="Role"
              value={form.role}
              onChangeText={(value) => onChange('role', value)}
            />
            <AdminInput
              label="Scope"
              value={form.scope}
              onChangeText={(value) => onChange('scope', value)}
            />
            <AdminInput
              label="Office"
              value={form.office}
              onChangeText={(value) => onChange('office', value)}
            />
            <AdminInput
              label="Shift"
              value={form.shift}
              onChangeText={(value) => onChange('shift', value)}
            />
            <AdminInput
              label="Password"
              value={form.password}
              onChangeText={(value) => onChange('password', value)}
              secureTextEntry
            />

            {errorMessage ? <Text style={styles.formErrorText}>{errorMessage}</Text> : null}
          </ScrollView>

          <View style={styles.modalActionRow}>
            <Pressable style={styles.modalSecondaryButton} onPress={onClose} disabled={creating}>
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalPrimaryButton, creating ? styles.modalButtonDisabled : null]}
              onPress={onCreate}
              disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryButtonText}>Create Admin</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ProfileAvatar({
  imageUrl,
  name,
  fallback,
  size = 42,
}: {
  imageUrl?: string;
  name: string;
  fallback: string;
  size?: number;
}) {
  const initial = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || fallback;

  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.avatarImage} contentFit="cover" />
      ) : (
        <Text style={styles.avatarText}>{initial}</Text>
      )}
    </View>
  );
}

function DriverStatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <View style={styles.driverStatCard}>
      <Text style={styles.driverStatLabel}>{label}</Text>
      <Text style={[styles.driverStatValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

function DriverStatusPill({ status }: { status: NormalizedDriverStatus }) {
  const { pillStyle, textStyle, label } = getDriverStatusTone(status);

  return (
    <View style={[styles.driverStatusPill, pillStyle]}>
      <Text style={[styles.driverStatusText, textStyle]}>{label}</Text>
    </View>
  );
}

function DriverMetaItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.driverMetaItem}>
      <Ionicons name={icon} size={16} color={teal} />
      <View style={styles.driverMetaTextWrap}>
        <Text style={styles.driverMetaLabel}>{label}</Text>
        <Text style={styles.driverMetaValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function DriverActionButton({
  icon,
  label,
  onPress,
  variant = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  variant?: 'default' | 'danger';
}) {
  return (
    <Pressable
      style={[styles.driverActionButton, variant === 'danger' ? styles.driverActionButtonDanger : null]}
      onPress={onPress}>
      <Ionicons
        name={icon}
        size={16}
        color={variant === 'danger' ? '#C13B3B' : '#102A28'}
      />
      <Text
        style={[
          styles.driverActionText,
          variant === 'danger' ? styles.driverActionTextDanger : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatVehicle(vehicle: DriverUser['vehicle']) {
  if (!vehicle) {
    return 'No vehicle';
  }

  return [vehicle.category, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.plateNumber || 'Vehicle added';
}

function formatDriverId(id: string) {
  if (!id) {
    return 'Driver';
  }

  return id.length > 10 ? `${id.slice(0, 10)}...` : id;
}

function formatShortId(id: string) {
  if (!id) {
    return 'Passenger';
  }

  return id.length > 12 ? `${id.slice(0, 12)}...` : id;
}

type NormalizedDriverStatus = 'active' | 'pending' | 'suspended' | 'inactive';
type DriverStatusFilter = NormalizedDriverStatus | 'all';

const driverStatusFilters: Array<{ label: string; value: DriverStatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Inactive', value: 'inactive' },
];

function normalizeDriverStatus(status?: string): NormalizedDriverStatus {
  if (!status) {
    return 'pending';
  }

  const normalized = status.toLowerCase();

  if (normalized.includes('active')) {
    return 'active';
  }

  if (normalized.includes('suspend') || normalized.includes('block')) {
    return 'suspended';
  }

  if (normalized.includes('inactive') || normalized.includes('offline')) {
    return 'inactive';
  }

  if (normalized.includes('pending') || normalized.includes('review')) {
    return 'pending';
  }

  return 'pending';
}

function formatDriverStatusLabel(status?: string) {
  const normalized = normalizeDriverStatus(status);

  if (normalized === 'active') {
    return 'Active';
  }

  if (normalized === 'suspended') {
    return 'Suspended';
  }

  if (normalized === 'inactive') {
    return 'Inactive';
  }

  return 'Pending';
}

function getDriverStats(drivers: DriverUser[]) {
  return drivers.reduce(
    (acc, driver) => {
      const status = normalizeDriverStatus(driver.status);
      acc.total += 1;
      acc[status] += 1;
      return acc;
    },
    { total: 0, active: 0, pending: 0, suspended: 0, inactive: 0 }
  );
}

function getDriverStatusTone(status: NormalizedDriverStatus) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        pillStyle: styles.driverStatusPillActive,
        textStyle: styles.driverStatusTextActive,
      };
    case 'suspended':
      return {
        label: 'Suspended',
        pillStyle: styles.driverStatusPillSuspended,
        textStyle: styles.driverStatusTextSuspended,
      };
    case 'inactive':
      return {
        label: 'Inactive',
        pillStyle: styles.driverStatusPillInactive,
        textStyle: styles.driverStatusTextInactive,
      };
    default:
      return {
        label: 'Pending',
        pillStyle: styles.driverStatusPillPending,
        textStyle: styles.driverStatusTextPending,
      };
  }
}

const docStatusMeta: Record<string, { label: string; color: string; backgroundColor: string; icon: keyof typeof Ionicons.glyphMap }> = {
  approved: {
    label: 'APPROVED',
    color: '#157A62',
    backgroundColor: '#E9F8EF',
    icon: 'checkmark-circle-outline',
  },
  review: {
    label: 'IN REVIEW',
    color: '#9A6B00',
    backgroundColor: '#FFF7E0',
    icon: 'time-outline',
  },
  missing: {
    label: 'MISSING',
    color: '#C13B3B',
    backgroundColor: '#FFF4F4',
    icon: 'alert-circle-outline',
  },
  rejected: {
    label: 'REJECTED',
    color: '#C13B3B',
    backgroundColor: '#FFF4F4',
    icon: 'close-circle-outline',
  },
};

const docInfoMeta: Record<string, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }> = {
  license: {
    title: 'Driver License',
    subtitle: 'Front and back images of your valid license',
    icon: 'id-card-outline',
  },
  insurance: {
    title: 'Vehicle Insurance',
    subtitle: 'Active insurance document for your registered car',
    icon: 'shield-checkmark-outline',
  },
  registration: {
    title: 'Vehicle Registration',
    subtitle: 'Registration certificate matching your license plate',
    icon: 'document-text-outline',
  },
};

const isPdfUrl = (url?: string) =>
  Boolean(url && (/\.pdf($|[?#])/i.test(url) || /\/upload\/.+\.(pdf|PDF)([?#].*)?$/i.test(url)));

const buildCloudinaryPdfPageUrl = (url: string, page: number) => {
  if (!url.includes('/upload/')) {
    return null;
  }

  const [baseUrl, query = ''] = url.split('?');
  const transformedBase = (
    /\/(?:image|raw)\/upload\//.test(baseUrl)
      ? baseUrl.replace(/\/(?:image|raw)\/upload\//, `/image/upload/pg_${page},f_jpg,q_auto,w_1400/`)
      : baseUrl.replace('/upload/', `/upload/pg_${page},f_jpg,q_auto,w_1400/`)
  ).replace(/\.pdf$/i, '.jpg');

  return query ? `${transformedBase}?${query}` : transformedBase;
};

const buildPdfPreviewPages = (url: string) => {
  const pages = Array.from({ length: PDF_PREVIEW_PAGE_LIMIT }, (_, index) => index + 1)
    .map((page) => ({ page, uri: buildCloudinaryPdfPageUrl(url, page) }))
    .filter((item): item is { page: number; uri: string } => Boolean(item.uri));

  return pages;
};


function DriverDocsModal({
  visible,
  driver,
  onClose,
  onReview,
  reviewingDoc,
}: {
  visible: boolean;
  driver: DriverUser | null;
  onClose: () => void;
  onReview: (driverId: string, documentType: string, status: 'approved' | 'rejected') => void;
  reviewingDoc: string | null;
}) {
  const [pdfDownloading, setPdfDownloading] = useState<string | null>(null);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewLoaded, setPdfPreviewLoaded] = useState(0);
  const [pdfPreviewFailedPages, setPdfPreviewFailedPages] = useState<number[]>([]);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    fileUrl?: string;
  } | null>(null);

  if (!driver) return null;

  const handleOpenPdf = async (url: string) => {
    try {
      setPdfDownloading(url);
      const targetFile = new File(Paths.cache, `${Date.now()}-driver-doc.pdf`);
      const result = await File.downloadFileAsync(url, targetFile, {
        headers: {
          Accept: 'application/pdf',
        },
        idempotent: true,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(result.uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Open PDF with...',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open PDF.';
      Alert.alert('PDF error', message);
    } finally {
      setPdfDownloading(null);
    }
  };

  const documents = driver.documents ?? [];
  const totals = documents.reduce(
    (acc, doc) => {
      const status = doc.status || 'review';
      acc.total += 1;
      if (status === 'approved') acc.approved += 1;
      if (status === 'rejected') acc.rejected += 1;
      if (status === 'review' || status === 'pending') acc.review += 1;
      return acc;
    },
    { total: 0, approved: 0, rejected: 0, review: 0 }
  );
  const { pillStyle, textStyle, label } = getDriverStatusTone(normalizeDriverStatus(driver.status));
  const previewPdfPages = previewDoc?.fileUrl && isPdfUrl(previewDoc.fileUrl)
    ? buildPdfPreviewPages(previewDoc.fileUrl)
    : [];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { maxWidth: 680 }]}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTextWrap}>
              <Text style={styles.modalTitle}>Driver Documents</Text>
              <Text style={styles.modalSubtitle}>Review uploaded documents before approval.</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={20} color="#102A28" />
            </Pressable>
          </View>

          <View style={styles.modalDriverRow}>
            <ProfileAvatar imageUrl={driver.profileImageUrl} name={driver.fullName} fallback="D" size={52} />
            <View style={styles.modalDriverTextWrap}>
              <Text style={styles.modalDriverName} numberOfLines={1}>{driver.fullName}</Text>
              <Text style={styles.modalDriverMeta} numberOfLines={1}>
                {driver.email} | {driver.phoneNumber || 'No phone'}
              </Text>
            </View>
            <View style={[styles.driverStatusPill, pillStyle]}>
              <Text style={[styles.driverStatusText, textStyle]}>{label}</Text>
            </View>
          </View>

          <View style={styles.modalMetaGrid}>
            <View style={styles.modalMetaPill}>
              <Text style={styles.modalMetaLabel}>Total Docs</Text>
              <Text style={styles.modalMetaValue}>{totals.total}</Text>
            </View>
            <View style={styles.modalMetaPill}>
              <Text style={styles.modalMetaLabel}>In Review</Text>
              <Text style={styles.modalMetaValue}>{totals.review}</Text>
            </View>
            <View style={styles.modalMetaPill}>
              <Text style={styles.modalMetaLabel}>Approved</Text>
              <Text style={styles.modalMetaValue}>{totals.approved}</Text>
            </View>
          </View>
          
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {documents.length > 0 ? (
              documents.map((doc, idx) => {
                const meta = docStatusMeta[doc.status] || docStatusMeta['missing'];
                const info = docInfoMeta[doc.documentType] || { title: doc.documentType.toUpperCase(), subtitle: '', icon: 'document-text-outline' };
                const dt = doc.submittedAt ? new Date(doc.submittedAt).toLocaleDateString() : '';

                return (
                  <View key={`${doc.documentType}-${idx}`} style={styles.docCard}>
                    <View style={styles.docHeader}>
                      <View style={styles.docLeft}>
                        <View style={styles.docIconWrap}>
                          <Ionicons name={info.icon} size={21} color={teal} />
                        </View>
                        <View style={styles.docTextWrap}>
                          <Text style={styles.docTitle}>{info.title}</Text>
                          <Text style={styles.docSubtitle}>{info.subtitle}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: meta.backgroundColor }]}>
                        <Ionicons name={meta.icon} size={13} color={meta.color} />
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>

                    <View style={styles.inlineDivider} />

                    <View style={styles.docBody}>
                      {doc.fileUrl ? (
                        isPdfUrl(doc.fileUrl) ? (
                          <View style={styles.docPdfPreview}>
                            <View style={styles.docPdfIcon}>
                              <Ionicons name="document-text-outline" size={28} color={teal} />
                            </View>
                            <Text style={styles.docPdfTitle}>PDF attachment</Text>
                            <Text style={styles.docPdfSubtitle}>Tap View to preview this document.</Text>
                          </View>
                        ) : (
                          <Image source={{ uri: doc.fileUrl }} style={styles.docImagePreview} contentFit="contain" />
                        )
                      ) : (
                        <View style={styles.docEmptyState}>
                          <Ionicons name="document-outline" size={20} color="#8AA19E" />
                          <Text style={styles.noDocText}>No attachment provided</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.docFooter}>
                      <View style={styles.updatedWrap}>
                        <Text style={styles.updatedText}>
                          {doc.status === 'review' ? `Submitted ${dt}` 
                          : doc.status === 'approved' ? `Approved ${dt}` 
                          : doc.status === 'rejected' ? `Rejected ${dt}` 
                          : `Last Updated ${dt}`}
                        </Text>
                      </View>
                      <View style={styles.docActionGroupRow}>
                        <Pressable
                          style={[styles.actionBtnView, !doc.fileUrl ? styles.docActionButtonDisabled : null]}
                          disabled={!doc.fileUrl}
                          onPress={() => {
                            setPdfPreviewError(null);
                            setPdfPreviewLoading(isPdfUrl(doc.fileUrl));
                            setPdfPreviewLoaded(0);
                            setPdfPreviewFailedPages([]);
                            setPreviewDoc({
                              title: info.title,
                              fileUrl: doc.fileUrl,
                            });
                          }}
                        >
                          <Ionicons name="expand-outline" size={16} color={teal} />
                          <Text style={[styles.docActionText, { color: teal }]}>View</Text>
                        </Pressable>
                        {doc.status !== 'approved' && doc.status !== 'rejected' ? (
                          <>
                            <Pressable
                              style={[
                                styles.actionBtnApprove,
                                reviewingDoc === doc.documentType ? styles.docActionButtonDisabled : null,
                              ]}
                              disabled={reviewingDoc === doc.documentType}
                              onPress={() => onReview(driver.id, doc.documentType, 'approved')}
                            >
                              <Ionicons name="checkmark-outline" size={16} color="#157A62" />
                              <Text style={[styles.docActionText, { color: '#157A62' }]}>Approve</Text>
                            </Pressable>
                            <Pressable
                              style={[
                                styles.actionBtnReject,
                                reviewingDoc === doc.documentType ? styles.docActionButtonDisabled : null,
                              ]}
                              disabled={reviewingDoc === doc.documentType}
                              onPress={() => onReview(driver.id, doc.documentType, 'rejected')}
                            >
                              <Ionicons name="close-outline" size={16} color="#C13B3B" />
                              <Text style={[styles.docActionText, { color: '#C13B3B' }]}>Reject</Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noDocsMessage}>No documents uploaded by this driver yet.</Text>
            )}
          </ScrollView>
        </View>
      </View>
      <Modal
        visible={Boolean(previewDoc)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPdfPreviewLoading(false);
          setPdfPreviewLoaded(0);
          setPdfPreviewFailedPages([]);
          setPreviewDoc(null);
        }}
      >
        <View style={styles.fullScreenOverlay}>
          <View style={styles.fullScreenCard}>
            <View style={styles.fullScreenHeader}>
              <Text style={styles.fullScreenTitle}>{previewDoc?.title}</Text>
              <Pressable
                onPress={() => {
                  setPdfPreviewLoading(false);
                  setPdfPreviewLoaded(0);
                  setPdfPreviewFailedPages([]);
                  setPreviewDoc(null);
                }}
                style={styles.fullScreenCloseButton}
              >
                <Ionicons name="close" size={20} color="#102A28" />
              </Pressable>
            </View>
            <View style={styles.fullScreenBody}>
                {previewDoc?.fileUrl ? (
                  isPdfUrl(previewDoc.fileUrl) ? (
                    <View style={styles.fullScreenPdfWrap}>
                      {previewPdfPages.length > 0 ? (
                        <ScrollView
                          style={styles.pdfPageScroll}
                          contentContainerStyle={styles.pdfPageScrollContent}
                          showsVerticalScrollIndicator={false}
                        >
                          {previewPdfPages.map((page) => {
                            const isFailedPage = pdfPreviewFailedPages.includes(page.page);
                            return (
                              <View
                                key={`${previewDoc.fileUrl}-${page.page}`}
                                style={[styles.pdfPageCard, isFailedPage ? styles.pdfPageCardHidden : null]}
                              >
                                <Text style={styles.pdfPageLabel}>Page {page.page}</Text>
                                <Image
                                  source={{ uri: page.uri }}
                                  style={styles.pdfPageImage}
                                  contentFit="contain"
                                  transition={160}
                                  onLoad={() => {
                                    setPdfPreviewLoaded((count) => {
                                      const nextCount = count + 1;
                                      if (nextCount > 0) {
                                        setPdfPreviewLoading(false);
                                        setPdfPreviewError(null);
                                      }
                                      return nextCount;
                                    });
                                  }}
                                  onError={() => {
                                    setPdfPreviewFailedPages((current) => {
                                      const nextPages = current.includes(page.page) ? current : [...current, page.page];
                                      if (nextPages.length >= previewPdfPages.length && pdfPreviewLoaded === 0) {
                                        setPdfPreviewLoading(false);
                                        setPdfPreviewError('Unable to generate page previews for this PDF.');
                                      }
                                      return nextPages;
                                    });
                                  }}
                                />
                              </View>
                            );
                          })}
                        </ScrollView>
                      ) : (
                        <View style={styles.pdfEmptyOverlay}>
                          <View style={styles.pdfActionIcon}>
                            <Ionicons name="document-text-outline" size={26} color={teal} />
                          </View>
                          <Text style={styles.pdfActionTitle}>PDF preview unavailable</Text>
                          <Text style={styles.pdfActionSubtitle}>
                            This PDF URL cannot be converted into page images for in-app preview.
                          </Text>
                        </View>
                      )}
                      {pdfPreviewLoading ? (
                        <View pointerEvents="none" style={styles.pdfLoadingOverlay}>
                          <ActivityIndicator size="small" color={teal} />
                          <Text style={styles.pdfLoadingText}>Loading PDF...</Text>
                        </View>
                      ) : null}
                      {pdfPreviewError ? (
                        <View style={styles.pdfEmptyOverlay}>
                          <View style={styles.pdfActionIcon}>
                            <Ionicons name="document-text-outline" size={26} color={teal} />
                          </View>
                          <Text style={styles.pdfActionTitle}>PDF preview unavailable</Text>
                          <Text style={styles.pdfActionSubtitle}>
                            The popup could not generate a page image. You can still open it with your device viewer.
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.pdfViewerFooter}>
                        {pdfPreviewError ? (
                          <Text style={styles.pdfPreviewError} numberOfLines={2}>
                            {pdfPreviewError}
                          </Text>
                        ) : (
                          <Text style={styles.pdfPreviewHint}>
                            {pdfPreviewLoaded > 0
                              ? `${pdfPreviewLoaded} page${pdfPreviewLoaded === 1 ? '' : 's'} loaded. Scroll to view.`
                              : 'Generating PDF preview...'}
                          </Text>
                        )}
                        <Pressable
                          style={[
                            styles.pdfFallbackButton,
                            pdfDownloading === previewDoc.fileUrl ? styles.docActionButtonDisabled : null,
                          ]}
                          disabled={pdfDownloading === previewDoc.fileUrl}
                          onPress={() => handleOpenPdf(previewDoc.fileUrl!)}
                        >
                          {pdfDownloading === previewDoc.fileUrl ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="open-outline" size={15} color="#FFFFFF" />
                              <Text style={styles.pdfFallbackButtonText}>Open</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: previewDoc.fileUrl }}
                      style={styles.fullScreenImage}
                      contentFit="contain"
                    />
                  )
                ) : (
                  <View style={styles.docEmptyState}>
                    <Ionicons name="document-outline" size={20} color="#8AA19E" />
                    <Text style={styles.noDocText}>No attachment provided</Text>
                  </View>
                )}
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function handleDriverCall(phoneNumber?: string) {
  if (!phoneNumber) {
    return;
  }

  Linking.openURL(`tel:${phoneNumber}`);
}

function handleDriverMessage(phoneNumber?: string) {
  if (!phoneNumber) {
    return;
  }

  Linking.openURL(`sms:${phoneNumber}`);
}

const styles = StyleSheet.create({
  modalScrollContent: {
    padding: 16,
  },
  modalDriverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalDriverTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  modalDriverName: {
    color: '#102A28',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  modalDriverMeta: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
  },
  docCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginBottom: 10,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  docLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: 11,
  },
  docIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTextWrap: {
    flex: 1,
  },
  docTitle: {
    color: '#102A28',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  docSubtitle: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  statusPill: {
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  inlineDivider: {
    height: 1,
    backgroundColor: '#D9E9E6',
    marginVertical: 11,
  },
  docBody: {
    marginBottom: 11,
  },
  docFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  docEmptyState: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5F0EE',
    backgroundColor: '#F7FBFA',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
  },
  updatedWrap: {
    flex: 1,
    gap: 4,
  },
  updatedText: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
  },
  docActionGroupRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnView: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C9E4E0',
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnApprove: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#157A62',
    backgroundColor: '#E9F8EF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionBtnReject: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C13B3B',
    backgroundColor: '#FFF4F4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  docActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  docImagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  docPdfPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  docPdfIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docPdfTitle: {
    color: '#102A28',
    fontSize: 14,
    fontWeight: '800',
  },
  docPdfSubtitle: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  noDocText: {
    color: '#7A908D',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  docActionButtonDisabled: {
    opacity: 0.5,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 19, 0.72)',
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) + 28 : 40,
    paddingBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCard: {
    width: '100%',
    maxWidth: 760,
    height: '82%',
    maxHeight: 720,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginHorizontal: 0,
    marginVertical: 0,
  },
  fullScreenHeader: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5F0EE',
  },
  fullScreenTitle: {
    flex: 1,
    color: '#102A28',
    fontSize: 16,
    fontWeight: '800',
  },
  fullScreenCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F4F8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenBody: {
    flex: 1,
    padding: 12,
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F7FBFA',
    borderRadius: 16,
  },
  fullScreenPdfWrap: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    overflow: 'hidden',
  },
  pdfPageScroll: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F7FBFA',
  },
  pdfPageScrollContent: {
    padding: 10,
    gap: 12,
  },
  pdfLoadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F7FBFA',
  },
  pdfLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: 54,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F7FBFA',
  },
  pdfEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    bottom: 54,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: '#F7FBFA',
  },
  pdfLoadingText: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '700',
  },
  pdfActionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfActionTitle: {
    color: '#102A28',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  pdfActionSubtitle: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
  },
  pdfViewerFooter: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pdfPreviewHint: {
    flex: 1,
    color: '#617C79',
    fontSize: 12,
    fontWeight: '600',
  },
  pdfPreviewError: {
    flex: 1,
    color: '#B3261E',
    fontSize: 12,
    fontWeight: '700',
  },
  pdfFallbackButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: teal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pdfFallbackButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  noDocsMessage: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F7',
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
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: '#102A28',
    fontSize: 17,
    fontWeight: '900',
  },
  topBarSpacer: {
    width: 38,
    height: 38,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginBottom: 12,
    gap: 7,
    flexWrap: 'nowrap',
    paddingRight: 12,
  },
  tabButton: {
    minWidth: 120,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: teal,
    borderColor: teal,
  },
  tabButtonText: {
    color: '#102A28',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
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
  stateCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    color: '#617C79',
    fontSize: 13,
    fontWeight: '600',
  },
  stateErrorText: {
    flex: 1,
    color: '#C13B3B',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
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
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
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
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#E7F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIdentity: {
    flex: 1,
  },
  heroName: {
    color: '#102A28',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroSubline: {
    color: '#617C79',
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
    backgroundColor: '#E7F5F3',
    marginBottom: 8,
  },
  heroBadgeText: {
    color: teal,
    fontSize: 12,
    fontWeight: '700',
  },
  heroHint: {
    color: '#617C79',
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
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  metricValue: {
    color: '#102A28',
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionHeaderRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sectionHint: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
  },
  filterCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 7,
    paddingRight: 8,
  },
  filterButton: {
    minWidth: 120,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: teal,
    borderColor: teal,
  },
  filterText: {
    color: '#102A28',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  driverStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  driverStatCard: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 12,
    gap: 6,
  },
  driverStatLabel: {
    color: '#7A908D',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  driverStatValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  driverControlsRow: {
    gap: 10,
    marginBottom: 14,
  },
  driverSearchWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverSearchInput: {
    flex: 1,
    color: '#102A28',
    fontSize: 13,
    fontWeight: '600',
  },
  driverFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  driverFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  driverFilterChipActive: {
    backgroundColor: '#E7F5F3',
    borderColor: '#C9E4E0',
  },
  driverFilterText: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '800',
  },
  driverFilterTextActive: {
    color: teal,
  },
  driverCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  driverCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  driverIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  driverTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    color: '#102A28',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  driverMeta: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  driverDetailLine: {
    color: '#7A908D',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  driverStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  driverStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  driverStatusPillActive: {
    backgroundColor: '#DCFCE7',
  },
  driverStatusTextActive: {
    color: '#166534',
  },
  driverStatusPillPending: {
    backgroundColor: '#FFF1DA',
  },
  driverStatusTextPending: {
    color: '#A16207',
  },
  driverStatusPillSuspended: {
    backgroundColor: '#FEE2E2',
  },
  driverStatusTextSuspended: {
    color: '#B91C1C',
  },
  driverStatusPillInactive: {
    backgroundColor: '#E2E8F0',
  },
  driverStatusTextInactive: {
    color: '#475569',
  },
  driverMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  driverMetaItem: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverMetaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  driverMetaLabel: {
    color: '#7A908D',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  driverMetaValue: {
    color: '#102A28',
    fontSize: 12,
    fontWeight: '700',
  },
  driverActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  driverActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
  },
  driverActionButtonDanger: {
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF4F4',
  },
  driverActionText: {
    color: '#102A28',
    fontSize: 12,
    fontWeight: '800',
  },
  driverActionTextDanger: {
    color: '#C13B3B',
  },
  adminPanelHeader: {
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  adminHeaderTitleWrap: {
    flex: 1,
    minWidth: 190,
  },
  adminHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminHeaderActionsCompact: {
    flex: 1,
    minWidth: '100%',
    justifyContent: 'space-between',
  },
  adminCountBadge: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAdminButton: {
    minHeight: 42,
    minWidth: 132,
    borderRadius: 14,
    backgroundColor: teal,
    paddingLeft: 10,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: teal,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  createAdminIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createAdminButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
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
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  reviewIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
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
    flexShrink: 1,
  },
  reviewDetailLine: {
    color: '#7A908D',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  reviewStatusPill: {
    alignSelf: 'flex-start',
    flexShrink: 0,
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
  documentMetaWrap: {
    flex: 1,
    gap: 2,
  },
  documentText: {
    color: '#102A28',
    fontSize: 13,
    fontWeight: '700',
  },
  documentStatusText: {
    color: '#617C79',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
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
  emptyStateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyStateText: {
    flex: 1,
    color: '#617C79',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
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
  adminForm: {
    gap: 12,
    marginTop: 16,
  },
  adminInputGroup: {
    gap: 6,
  },
  adminInputLabel: {
    color: '#617C79',
    fontSize: 12,
    fontWeight: '800',
  },
  adminInput: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    paddingHorizontal: 12,
    color: '#102A28',
    fontSize: 13,
    fontWeight: '600',
  },
  formErrorText: {
    color: '#C13B3B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  formSuccessText: {
    color: teal,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
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
  passengerAccountCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  passengerCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  passengerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  passengerName: {
    color: '#102A28',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  passengerSubtitle: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  passengerStatusPill: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: '#E7F5F3',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passengerStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: teal,
  },
  passengerStatusText: {
    color: teal,
    fontSize: 11,
    fontWeight: '800',
  },
  passengerMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  passengerMetaItem: {
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passengerMetaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  passengerMetaLabel: {
    color: '#7A908D',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  passengerMetaValue: {
    color: '#102A28',
    fontSize: 12,
    fontWeight: '700',
  },
  passengerCardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E5F0EE',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  passengerProfileState: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  passengerProfileStateText: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 21, 19, 0.55)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    maxHeight: '82%',
  },
  createAdminModalCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 16,
    maxHeight: '86%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  modalHeaderTextWrap: {
    flex: 1,
  },
  modalTitle: {
    color: '#102A28',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F4F8F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMetaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  modalMetaPill: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F7FBFA',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    padding: 10,
  },
  modalMetaLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalMetaValue: {
    color: '#102A28',
    fontSize: 13,
    fontWeight: '700',
  },
  previewCard: {
    minHeight: 260,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#F7FBFA',
    overflow: 'hidden',
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#F7FBFA',
  },
  pdfPreviewScroll: {
    maxHeight: 420,
  },
  pdfPreviewScrollContent: {
    padding: 12,
    gap: 12,
  },
  pdfPageCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 8,
    gap: 8,
  },
  pdfPageCardHidden: {
    display: 'none',
  },
  pdfPageLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pdfPageImage: {
    width: '100%',
    aspectRatio: 0.72,
    backgroundColor: '#F7FBFA',
  },
  previewEmptyState: {
    minHeight: 260,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyTitle: {
    color: '#102A28',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  previewEmptyText: {
    color: '#617C79',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  reasonCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF4F4',
    padding: 12,
    marginBottom: 14,
  },
  reasonLabel: {
    color: '#C13B3B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  reasonText: {
    color: '#7A4B4B',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalSecondaryButtonText: {
    color: '#102A28',
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: teal,
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalButtonDisabled: {
    opacity: 0.45,
  },
  createAdminFormScroll: {
    maxHeight: 500,
    marginBottom: 14,
  },
  createAdminFormContent: {
    gap: 12,
    paddingBottom: 2,
  },
  passengerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E7F5F3',
    borderWidth: 1,
    borderColor: '#D9E9E6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: teal,
    fontSize: 16,
    fontWeight: '800',
  },
  suspendButton: {
    alignSelf: 'flex-start',
    minHeight: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1D6D6',
    backgroundColor: '#FFF4F4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  suspendButtonText: {
    color: '#C13B3B',
    fontSize: 12,
    fontWeight: '800',
  },
});
