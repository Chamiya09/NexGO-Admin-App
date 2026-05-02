import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
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

import RefreshableScrollView from '@/components/RefreshableScrollView';
import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';

const teal = '#008080';

type PassengerUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  createdAt?: string;
};

type DriverDocument = {
  documentType: 'license' | 'insurance' | 'registration';
  fileUrl?: string;
  status: 'missing' | 'review' | 'approved' | 'rejected';
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string;
};

type DriverUser = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  profileImageUrl?: string;
  status?: string;
  vehicle?: {
    category?: string;
    make?: string;
    model?: string;
    plateNumber?: string;
  } | null;
  documents?: DriverDocument[];
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

type SelectedDriverDocument = {
  driver: DriverUser;
  document: DriverDocument;
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
  const [selectedDocument, setSelectedDocument] = useState<SelectedDriverDocument | null>(null);

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

  const pendingDriverUsers = useMemo(
    () =>
      driverUsers.filter(
        (driver) =>
          driver.status !== 'active' ||
          (driver.documents || []).some((document) => document.status !== 'approved')
      ),
    [driverUsers]
  );

  const closeDocumentModal = () => {
    setSelectedDocument(null);
  };

  const openDocumentModal = (driver: DriverUser, document: DriverDocument) => {
    setSelectedDocument({ driver, document });
  };

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
        <Text style={styles.pageTitle}>User & Driver Management</Text>
        <Text style={styles.pageSubtitle}>
          Review rider activity, manage account trust, and process driver approval queues from one place.
        </Text>

        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tabButton, activeTab === 'admins' ? styles.tabButtonActive : null]}
            onPress={() => setActiveTab('admins')}>
            <Text style={[styles.tabButtonText, activeTab === 'admins' ? styles.tabButtonTextActive : null]}>
              Admins
            </Text>
          </Pressable>
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
            <View style={[styles.panelHeader, styles.adminPanelHeader]}>
              <View style={styles.adminHeaderTitleWrap}>
                <Text style={styles.panelEyebrow}>ADMIN ACCOUNTS</Text>
                <Text style={styles.panelTitle}>Admin management</Text>
              </View>
              <View style={[styles.adminHeaderActions, !isWide ? styles.adminHeaderActionsCompact : null]}>
                <View style={[styles.panelBadge, styles.adminCountBadge]}>
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
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.panelEyebrow}>PENDING APPROVALS</Text>
                  <Text style={styles.panelTitle}>Driver review queue</Text>
                </View>
                <View style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{pendingDriverUsers.length} waiting</Text>
                </View>
              </View>

              {pendingDriverUsers.length === 0 ? (
                <EmptyStateCard
                  icon="checkmark-circle-outline"
                  text="No driver documents are waiting for review right now."
                />
              ) : null}

              {pendingDriverUsers.map((driver) => (
                <View key={driver.id} style={styles.reviewCard}>
                  <View style={styles.reviewTopRow}>
                    <View style={styles.reviewIdentity}>
                      <ProfileAvatar
                        imageUrl={driver.profileImageUrl}
                        name={driver.fullName}
                        fallback="D"
                        size={44}
                      />
                      <View style={styles.reviewTextWrap}>
                        <Text style={styles.reviewName}>{driver.fullName}</Text>
                        <Text style={styles.reviewMeta}>
                          {formatVehicle(driver.vehicle)} | {driver.vehicle?.plateNumber || 'No plate'}
                        </Text>
                        <Text style={styles.reviewDetailLine}>
                          {formatDriverStatus(driver.status)} | {(driver.documents || []).filter((document) => document.status === 'approved').length}/
                          {(driver.documents || []).length || 3} documents approved
                        </Text>
                      </View>
                    </View>
                    <View style={styles.reviewStatusPill}>
                      <Text style={styles.reviewStatusText}>{getDriverActionLabel(driver)}</Text>
                    </View>
                  </View>

                  <View style={styles.documentRow}>
                    {(driver.documents || []).map((document) => (
                      <Pressable
                        key={`${driver.id}-${document.documentType}`}
                        style={styles.documentCard}
                        onPress={() => openDocumentModal(driver, document)}>
                        <Ionicons name="document-attach-outline" size={18} color={teal} />
                        <View style={styles.documentMetaWrap}>
                          <Text style={styles.documentText}>{formatDocumentType(document.documentType)}</Text>
                          <Text style={styles.documentStatusText}>{formatDocumentStatus(document)}</Text>
                        </View>
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

            {passengerUsers.length === 0 ? (
              <EmptyStateCard icon="people-outline" text="No passenger accounts were returned by the backend." />
            ) : null}

            {passengerUsers.map((user) => (
              <View key={user.id} style={styles.passengerRow}>
                <View style={styles.passengerIdentity}>
                  <ProfileAvatar imageUrl={user.profileImageUrl} name={user.fullName} fallback="P" />
                  <View>
                    <Text style={styles.reviewName}>{user.fullName}</Text>
                    <Text style={styles.reviewMeta}>
                      {user.id} | {user.email} | {user.phoneNumber || 'No phone'}
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.suspendButton}>
                  <Text style={styles.suspendButtonText}>Suspend Account</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </RefreshableScrollView>

      <DocumentPreviewModal
        selectedDocument={selectedDocument}
        onClose={closeDocumentModal}
      />
      <CreateAdminModal
        visible={createAdminModalVisible}
        form={newAdminForm}
        errorMessage={adminFormError}
        creating={creatingAdmin}
        onChange={handleNewAdminChange}
        onCreate={createAdminAccount}
        onClose={closeCreateAdminModal}
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

function DocumentPreviewModal({
  selectedDocument,
  onClose,
}: {
  selectedDocument: SelectedDriverDocument | null;
  onClose: () => void;
}) {
  const [pdfPageUrls, setPdfPageUrls] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const driver = selectedDocument?.driver;
  const document = selectedDocument?.document;
  const imagePreviewable = isImageDocument(document?.fileUrl);
  const pdfPreviewable = isPdfDocument(document?.fileUrl);

  useEffect(() => {
    let isCancelled = false;

    const loadPdfPages = async () => {
      if (!document?.fileUrl || !pdfPreviewable) {
        setPdfPageUrls([]);
        setPdfLoading(false);
        return;
      }

      setPdfLoading(true);
      const pageUrls = await discoverCloudinaryPdfPages(document.fileUrl);

      if (!isCancelled) {
        setPdfPageUrls(pageUrls);
        setPdfLoading(false);
      }
    };

    loadPdfPages();

    return () => {
      isCancelled = true;
    };
  }, [document?.fileUrl, pdfPreviewable]);

  if (!selectedDocument || !driver || !document) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTextWrap}>
              <Text style={styles.modalTitle}>{formatDocumentType(document.documentType)}</Text>
              <Text style={styles.modalSubtitle}>{driver.fullName} | {formatDriverId(driver.id)}</Text>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <Ionicons name="close" size={20} color="#102A28" />
            </Pressable>
          </View>

          <View style={styles.modalMetaGrid}>
            <ModalMetaPill label="Status" value={formatDriverStatus(document.status)} />
            <ModalMetaPill
              label="Submitted"
              value={document.submittedAt ? new Date(document.submittedAt).toLocaleDateString() : 'Not submitted'}
            />
          </View>

          <View style={styles.previewCard}>
            {document.fileUrl ? (
              imagePreviewable ? (
                <Image source={{ uri: document.fileUrl }} style={styles.previewImage} contentFit="contain" />
              ) : pdfPreviewable ? (
                pdfLoading ? (
                  <View style={styles.previewEmptyState}>
                    <ActivityIndicator size="small" color={teal} />
                    <Text style={styles.previewEmptyTitle}>Loading PDF pages</Text>
                    <Text style={styles.previewEmptyText}>Preparing a scrollable preview from Cloudinary.</Text>
                  </View>
                ) : pdfPageUrls.length > 0 ? (
                  <ScrollView
                    style={styles.pdfPreviewScroll}
                    contentContainerStyle={styles.pdfPreviewScrollContent}
                    showsVerticalScrollIndicator>
                    {pdfPageUrls.map((pageUrl, index) => (
                      <View key={pageUrl} style={styles.pdfPageCard}>
                        <Text style={styles.pdfPageLabel}>Page {index + 1}</Text>
                        <Image source={{ uri: pageUrl }} style={styles.pdfPageImage} contentFit="contain" />
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.previewEmptyState}>
                    <Ionicons name="document-text-outline" size={34} color={teal} />
                    <Text style={styles.previewEmptyTitle}>Preview not available</Text>
                    <Text style={styles.previewEmptyText}>
                      This Cloudinary PDF could not be converted into scrollable page previews.
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.previewEmptyState}>
                  <Ionicons name="document-text-outline" size={34} color={teal} />
                  <Text style={styles.previewEmptyTitle}>Preview not available</Text>
                  <Text style={styles.previewEmptyText}>This file type can be opened with the external viewer.</Text>
                </View>
              )
            ) : (
              <View style={styles.previewEmptyState}>
                <Ionicons name="cloud-offline-outline" size={34} color="#C13B3B" />
                <Text style={styles.previewEmptyTitle}>Document missing</Text>
                <Text style={styles.previewEmptyText}>No uploaded file URL is available for this document yet.</Text>
              </View>
            )}
          </View>

          {document.rejectionReason ? (
            <View style={styles.reasonCard}>
              <Text style={styles.reasonLabel}>Review note</Text>
              <Text style={styles.reasonText}>{document.rejectionReason}</Text>
            </View>
          ) : null}

          <View style={styles.modalActionRow}>
            <Pressable style={styles.modalSecondaryButton} onPress={onClose}>
              <Text style={styles.modalSecondaryButtonText}>Close</Text>
            </Pressable>
            <Pressable
              style={[styles.modalPrimaryButton, !document.fileUrl ? styles.modalButtonDisabled : null]}
              onPress={() => {
                if (document.fileUrl) {
                  Linking.openURL(document.fileUrl);
                }
              }}
              disabled={!document.fileUrl}>
              <Text style={styles.modalPrimaryButtonText}>Open File</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModalMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.modalMetaPill}>
      <Text style={styles.modalMetaLabel}>{label}</Text>
      <Text style={styles.modalMetaValue}>{value}</Text>
    </View>
  );
}

function formatVehicle(vehicle: DriverUser['vehicle']) {
  if (!vehicle) {
    return 'No vehicle';
  }

  return [vehicle.category, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.plateNumber || 'Vehicle added';
}

function formatDriverStatus(status?: string) {
  if (!status) {
    return 'Pending';
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDriverId(id: string) {
  if (!id) {
    return 'Driver';
  }

  return id.length > 10 ? `${id.slice(0, 10)}...` : id;
}

function isImageDocument(fileUrl?: string) {
  if (!fileUrl) {
    return false;
  }

  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(fileUrl);
}

function isPdfDocument(fileUrl?: string) {
  if (!fileUrl) {
    return false;
  }

  return /\.pdf($|\?)/i.test(fileUrl);
}

function getCloudinaryPdfParts(fileUrl?: string) {
  if (!fileUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(fileUrl);
    if (!parsedUrl.hostname.includes('res.cloudinary.com')) {
      return null;
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const uploadIndex = pathSegments.indexOf('upload');

    if (uploadIndex < 2) {
      return null;
    }

    const cloudName = pathSegments[0];
    const resourceType = pathSegments[1];
    const versionIndex = pathSegments.findIndex((segment, index) => index > uploadIndex && /^v\d+$/.test(segment));

    if (!cloudName || versionIndex === -1 || versionIndex === pathSegments.length - 1) {
      return null;
    }

    const version = pathSegments[versionIndex];
    const publicIdWithExtension = pathSegments.slice(versionIndex + 1).join('/');

    if (!/\.pdf$/i.test(publicIdWithExtension)) {
      return null;
    }

    return {
      cloudName,
      resourceType,
      version,
      publicId: publicIdWithExtension.replace(/\.pdf$/i, ''),
      publicIdWithExtension,
    };
  } catch {
    return null;
  }
}

function getCloudinaryPdfPagePreviewUrl(fileUrl: string, pageNumber: number) {
  const parts = getCloudinaryPdfParts(fileUrl);
  if (!parts) {
    return null;
  }

  const normalizedPublicId =
    parts.resourceType === 'raw'
      ? parts.publicIdWithExtension
      : parts.publicId;

  return `https://res.cloudinary.com/${parts.cloudName}/image/upload/pg_${pageNumber},f_jpg,q_auto,w_1200/${parts.version}/${normalizedPublicId}.jpg`;
}

function getRemoteImageSize(uri: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject
    );
  });
}

async function discoverCloudinaryPdfPages(fileUrl: string, maxPages = 12) {
  const pageUrls: string[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const previewUrl = getCloudinaryPdfPagePreviewUrl(fileUrl, pageNumber);

    if (!previewUrl) {
      break;
    }

    try {
      await getRemoteImageSize(previewUrl);
      pageUrls.push(previewUrl);
    } catch {
      break;
    }
  }

  return pageUrls;
}

function formatDocumentType(documentType: DriverDocument['documentType']) {
  if (documentType === 'license') {
    return 'License';
  }

  if (documentType === 'insurance') {
    return 'Insurance';
  }

  return 'Registration';
}

function formatDocumentStatus(document: DriverDocument) {
  if (document.status === 'approved') {
    return document.reviewedAt ? `Approved ${new Date(document.reviewedAt).toLocaleDateString()}` : 'Approved';
  }

  if (document.status === 'rejected') {
    return document.rejectionReason ? `Rejected: ${document.rejectionReason}` : 'Rejected';
  }

  if (document.status === 'review') {
    return document.submittedAt ? `In review since ${new Date(document.submittedAt).toLocaleDateString()}` : 'In review';
  }

  return 'Missing upload';
}

function getDriverActionLabel(driver: DriverUser) {
  const documents = driver.documents || [];
  const missingCount = documents.filter((document) => document.status === 'missing').length;
  const rejectedCount = documents.filter((document) => document.status === 'rejected').length;

  if (rejectedCount > 0) {
    return `${rejectedCount} rejected`;
  }

  if (missingCount > 0) {
    return `${missingCount} missing`;
  }

  return 'Needs action';
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E9E6',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  pdfPageLabel: {
    color: '#617C79',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pdfPageImage: {
    width: '100%',
    height: 360,
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
