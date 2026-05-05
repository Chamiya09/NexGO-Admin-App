import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const PERMISSIONS_BOOTSTRAP_KEY = 'nexgo.admin.permissions.bootstrapped.v3';

type PermissionSummary = {
  foregroundLocation: boolean | null;
  mediaLibrary: boolean | null;
};

const initialSummary: PermissionSummary = {
  foregroundLocation: null,
  mediaLibrary: null,
};

function showSettingsAlert(title: string, message: string) {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Go to Settings',
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

export function useAppPermissions() {
  const hasStartedRef = useRef(false);
  const [checking, setChecking] = useState(true);
  const [summary, setSummary] = useState<PermissionSummary>(initialSummary);
  const [error, setError] = useState<unknown>(null);

  const requestAllPermissions = useCallback(async ({ force = false } = {}) => {
    if (hasStartedRef.current && !force) {
      return;
    }

    hasStartedRef.current = true;
    setChecking(true);

    try {
      setError(null);
      const hasBootstrapped = await AsyncStorage.getItem(PERMISSIONS_BOOTSTRAP_KEY);
      if (hasBootstrapped && !force) {
        setChecking(false);
        return;
      }

      await AsyncStorage.setItem(PERMISSIONS_BOOTSTRAP_KEY, new Date().toISOString());

      const locationResult = await Location.requestForegroundPermissionsAsync();
      const mediaResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const nextSummary = {
        foregroundLocation: locationResult.granted,
        mediaLibrary: mediaResult.granted,
      };

      if (!locationResult.granted && !locationResult.canAskAgain) {
        showSettingsAlert(
          'Location access is needed',
          'NexGO Admin needs location access to support live map monitoring and location-aware operations. Please enable Location permission in settings.'
        );
      }

      if (!mediaResult.granted && !mediaResult.canAskAgain) {
        showSettingsAlert(
          'Photo access is needed',
          'NexGO Admin needs photo access so you can select admin profile images and promotion artwork. Please enable Photos permission in settings.'
        );
      }

      setSummary(nextSummary);
    } catch (permissionError) {
      console.warn('[Permissions] Admin permission bootstrap failed:', permissionError);
      setError(permissionError);
      showSettingsAlert(
        'Permissions could not be checked',
        'NexGO Admin could not complete the permission check. Please open app settings and confirm Location and Photos permissions.'
      );
    } finally {
      setChecking(false);
      hasStartedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setChecking(false);
      return;
    }

    void requestAllPermissions();
  }, [requestAllPermissions]);

  return {
    checking,
    error,
    summary,
    requestAllPermissions,
  };
}
