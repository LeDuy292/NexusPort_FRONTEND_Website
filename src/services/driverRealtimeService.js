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

const getToken = () => {
  try {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    return stored ? JSON.parse(stored)?.token : null;
  } catch {
    return null;
  }
};

/**
 * Đăng ký lắng nghe sự kiện thời gian thực cho Tài xế:
 * - trip:assigned: Có chuyến mới được phân công
 * - trip:status_updated: Trạng thái chuyến cập nhật
 * - yard.operation.completed: Thao tác bãi hoàn tất
 *
 * @param {Object} handlers - { onTripAssigned, onTripStatusUpdated, onOperationCompleted, onConnected, onDisconnected, onConnectionError }
 * @returns {Function} cleanup function ngắt kết nối
 */
export function subscribeDriverTripEvents(handlers = {}) {
  const token = getToken();
  if (!token) return () => {};

  const {
    onTripAssigned,
    onTripStatusUpdated,
    onOperationCompleted,
    onConnected,
    onDisconnected,
    onConnectionError,
  } = handlers;

  try {
    const socket = io(getRealtimeUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    if (onConnected) socket.on('connect', onConnected);
    if (onDisconnected) socket.on('disconnect', onDisconnected);
    if (onConnectionError) socket.on('connect_error', onConnectionError);

    if (onTripAssigned) {
      socket.on('trip:assigned', onTripAssigned);
    }
    if (onTripStatusUpdated) {
      socket.on('trip:status_updated', onTripStatusUpdated);
    }
    if (onOperationCompleted) {
      socket.on('yard.operation.completed', onOperationCompleted);
    }

    return () => {
      if (onTripAssigned) socket.off('trip:assigned', onTripAssigned);
      if (onTripStatusUpdated) socket.off('trip:status_updated', onTripStatusUpdated);
      if (onOperationCompleted) socket.off('yard.operation.completed', onOperationCompleted);
      if (onConnected) socket.off('connect', onConnected);
      if (onDisconnected) socket.off('disconnect', onDisconnected);
      if (onConnectionError) socket.off('connect_error', onConnectionError);
      socket.disconnect();
    };
  } catch (err) {
    if (onConnectionError) onConnectionError(err);
    return () => {};
  }
}

export function connectDriverRealtime(onOperationCompleted, onConnectionError) {
  return subscribeDriverTripEvents({ onOperationCompleted, onConnectionError });
}

export default subscribeDriverTripEvents;
