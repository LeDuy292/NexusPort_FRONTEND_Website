/**
 * Websocket / SignalR Service Abstraction
 * Cung cấp kết nối thời gian thực cho Realtime Dashboard
 */
class WebsocketService {
  constructor() {
    this.connection = null
    this.listeners = {}
  }

  // Khởi động kết nối SignalR / WebSocket
  connect(hubUrl) {
    console.log(`Connecting to SignalR Hub at: ${hubUrl}`)
    // Ở bước này, chúng ta định nghĩa mock kết nối.
    // Khi tích hợp, lập trình viên sẽ import @microsoft/signalr
    // và thiết lập: this.connection = new signalR.HubConnectionBuilder().withUrl(hubUrl).build();
    
    this.connection = {
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      on: (eventName, callback) => {
        if (!this.listeners[eventName]) this.listeners[eventName] = []
        this.listeners[eventName].push(callback)
      },
      off: (eventName, callback) => {
        if (!this.listeners[eventName]) return
        this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback)
      },
      invoke: (methodName, ...args) => {
        console.log(`Invoking method ${methodName} with args:`, args)
        return Promise.resolve()
      }
    }

    return this.connection.start()
  }

  disconnect() {
    if (this.connection) {
      this.connection.stop()
      this.connection = null
    }
  }

  // Lắng nghe sự kiện từ Server (Ví dụ: cập nhật container, cảnh báo)
  subscribe(event, callback) {
    if (this.connection) {
      this.connection.on(event, callback)
    }
  }

  unsubscribe(event, callback) {
    if (this.connection) {
      this.connection.off(event, callback)
    }
  }
}

const websocketService = new WebsocketService()
export default websocketService
