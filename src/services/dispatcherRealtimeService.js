import { io } from 'socket.io-client';

const getRealtimeUrl = () => {
  if (import.meta.env.VITE_REALTIME_URL) {
    return import.meta.env.VITE_REALTIME_URL;
  }
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith('http')) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  return 'http://localhost:3001';
};

const EVENT_NAME = 'dispatcher.status.updated';

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
};

export function connectDispatcherRealtime(onStatusUpdated, onConnectionError) {
  const token = getToken();
  if (!token) return () => {};

  try {
    const socket = io(getRealtimeUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on(EVENT_NAME, onStatusUpdated);
    if (onConnectionError) socket.on('connect_error', onConnectionError);

    return () => {
      socket.off(EVENT_NAME, onStatusUpdated);
      if (onConnectionError) socket.off('connect_error', onConnectionError);
      socket.disconnect();
    };
  } catch (err) {
    if (onConnectionError) onConnectionError(err);
    return () => {};
  }
}

export default connectDispatcherRealtime;
