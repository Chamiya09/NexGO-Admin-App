import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const ADMIN_SESSION_STORAGE_KEY = 'nexgo-admin-session';
const ADMIN_SESSION_FILE = `${FileSystem.documentDirectory || ''}nexgo-admin-session.json`;

let adminToken: string | null = null;

function getWebStorage() {
  try {
    return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function setAdminToken(nextToken: string | null) {
  adminToken = nextToken;
}

export function getAdminToken() {
  return adminToken;
}

export async function persistAdminSession(token: string, admin: unknown) {
  setAdminToken(token);
  const nextSession = JSON.stringify({ token, admin });

  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(ADMIN_SESSION_STORAGE_KEY, nextSession);
    return;
  }

  if (FileSystem.documentDirectory) {
    await FileSystem.writeAsStringAsync(ADMIN_SESSION_FILE, nextSession);
  }
}

export async function readAdminSession(): Promise<{ token: string; admin?: unknown } | null> {
  const rawSession =
    Platform.OS === 'web'
      ? getWebStorage()?.getItem(ADMIN_SESSION_STORAGE_KEY)
      : FileSystem.documentDirectory
        ? await FileSystem.readAsStringAsync(ADMIN_SESSION_FILE).catch(() => null)
        : null;

  if (!rawSession) {
    return null;
  }

  try {
    const parsedSession = JSON.parse(rawSession) as { token?: string; admin?: unknown };
    return parsedSession.token ? { token: parsedSession.token, admin: parsedSession.admin } : null;
  } catch {
    return null;
  }
}

export async function clearAdminSession() {
  setAdminToken(null);

  if (Platform.OS === 'web') {
    getWebStorage()?.removeItem(ADMIN_SESSION_STORAGE_KEY);
    return;
  }

  if (FileSystem.documentDirectory) {
    await FileSystem.deleteAsync(ADMIN_SESSION_FILE, { idempotent: true }).catch(() => undefined);
  }
}
