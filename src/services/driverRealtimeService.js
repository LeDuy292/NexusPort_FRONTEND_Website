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

    const handleKickout = () => {
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      } catch (_) {}
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login?kicked=true';
      }
    };

    if (onConnected) socket.on('connect', onConnected);
    socket.on('disconnect', (reason) => {
      if (onDisconnected) onDisconnected(reason);
      if (reason === 'io server disconnect') {
        handleKickout();
      }
    });

    socket.on('connect_error', (err) => {
      if (onConnectionError) onConnectionError(err);
      const msg = err?.message || '';
      if (
        msg.includes('Phiên làm việc đã bị kết thúc') ||
        msg.includes('SESSION_KICKED') ||
        msg.includes('không còn hợp lệ')
      ) {
        handleKickout();
      }
    });

    socket.on('auth:session_kicked', (data) => {
      console.warn('[DriverRealtime] auth:session_kicked event received:', data);
      handleKickout();
    });

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
      socket.off('auth:session_kicked');
      if (onTripAssigned) socket.off('trip:assigned', onTripAssigned);
      if (onTripStatusUpdated) socket.off('trip:status_updated', onTripStatusUpdated);
      if (onOperationCompleted) socket.off('yard.operation.completed', onOperationCompleted);
      if (onConnected) socket.off('connect', onConnected);
      socket.off('disconnect');
      socket.off('connect_error');
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
