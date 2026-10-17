import * as signalR from '@microsoft/signalr';

const HUB_URL = import.meta.env.VITE_SIGNALR_REEFER_HUB_URL || 'http://localhost:5000/hubs/reefer-monitoring';

class ReeferSignalRService {
  constructor() {
    this.connection = null;
    this.connectionState = 'DISCONNECTED'; // CONNECTED | CONNECTING | RECONNECTING | DISCONNECTED
    this.listeners = {
      monitoringUpdated: new Set(),
      alertCreated: new Set(),
      alertUpdated: new Set(),
      stateChanged: new Set(),
    };
    this.reconnectResyncCallback = null;
  }

  getToken() {
    try {
      const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
      return stored ? JSON.parse(stored)?.token : null;
    } catch {
      return null;
    }
  }

  setConnectionState(newState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.listeners.stateChanged.forEach((cb) => {
        try {
          cb(newState);
        } catch (e) {
          console.error('[SignalR] State changed listener error:', e);
        }
      });
    }
  }

  async start(onResyncAfterReconnect = null) {
    if (onResyncAfterReconnect) {
      this.reconnectResyncCallback = onResyncAfterReconnect;
    }

    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {}
    }

    this.setConnectionState('CONNECTING');

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => this.getToken() || '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Event handlers
    this.connection.on('MonitoringUpdated', (payload) => {
      this.listeners.monitoringUpdated.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('[SignalR] MonitoringUpdated error:', err);
        }
      });
    });

    this.connection.on('ReeferAlertCreated', (payload) => {
      this.listeners.alertCreated.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('[SignalR] ReeferAlertCreated error:', err);
        }
      });
    });

    this.connection.on('ReeferAlertUpdated', (payload) => {
      this.listeners.alertUpdated.forEach((cb) => {
        try {
          cb(payload);
        } catch (err) {
          console.error('[SignalR] ReeferAlertUpdated error:', err);
        }
      });
    });

    // Lifecycle events
    this.connection.onreconnecting((error) => {
      console.warn('[SignalR] Reconnecting to ReeferMonitoringHub...', error);
      this.setConnectionState('RECONNECTING');
    });

    this.connection.onreconnected(async (connectionId) => {
      console.log('[SignalR] Reconnected to ReeferMonitoringHub:', connectionId);
      this.setConnectionState('CONNECTED');
      try {
        await this.connection.invoke('SubscribeToOverview');
      } catch (err) {
        console.error('[SignalR] Re-subscribe overview failed:', err);
      }
      if (this.reconnectResyncCallback) {
        try {
          await this.reconnectResyncCallback();
        } catch (err) {
          console.error('[SignalR] Resync callback failed after reconnect:', err);
        }
      }
    });

    this.connection.onclose((error) => {
      console.warn('[SignalR] Connection closed:', error);
      this.setConnectionState('DISCONNECTED');
    });

    try {
      await this.connection.start();
      this.setConnectionState('CONNECTED');
      await this.connection.invoke('SubscribeToOverview');
      console.log('[SignalR] Connected to ReeferMonitoringHub successfully.');
    } catch (err) {
      console.error('[SignalR] Connection to ReeferMonitoringHub failed:', err);
      this.setConnectionState('DISCONNECTED');
    }
  }

  async stop() {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.error('[SignalR] Stop connection error:', err);
      }
      this.connection = null;
      this.setConnectionState('DISCONNECTED');
    }
  }

  async subscribeToSession(sessionId) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('SubscribeToSession', sessionId);
      } catch (err) {
        console.error('[SignalR] SubscribeToSession error:', err);
      }
    }
  }

  async unsubscribeFromSession(sessionId) {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      try {
        await this.connection.invoke('UnsubscribeFromSession', sessionId);
      } catch (err) {
        console.error('[SignalR] UnsubscribeFromSession error:', err);
      }
    }
  }

  onMonitoringUpdated(callback) {
    this.listeners.monitoringUpdated.add(callback);
    return () => this.listeners.monitoringUpdated.delete(callback);
  }

  onAlertCreated(callback) {
    this.listeners.alertCreated.add(callback);
    return () => this.listeners.alertCreated.delete(callback);
  }

  onAlertUpdated(callback) {
    this.listeners.alertUpdated.add(callback);
    return () => this.listeners.alertUpdated.delete(callback);
  }

  onStateChanged(callback) {
    this.listeners.stateChanged.add(callback);
    callback(this.connectionState);
    return () => this.listeners.stateChanged.delete(callback);
  }
}

export const reeferSignalRService = new ReeferSignalRService();
export default reeferSignalRService;
