import { io, Socket } from 'socket.io-client';

import { API_BASE_URL } from './api';

const SOCKET_SERVER_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export type AdminDriverLocation = {
  driverId: string;
  latitude: number;
  longitude: number;
  vehicleCategory?: string;
  isOnline?: boolean;
  heading?: number;
};

let adminSocket: Socket | null = null;

export function getAdminSocket() {
  if (!adminSocket) {
    adminSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });
  }

  return adminSocket;
}

export function requestDriverLocationSnapshot() {
  getAdminSocket().emit('get_all_driver_locations');
}

