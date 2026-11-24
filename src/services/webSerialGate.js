/**
 * Kết nối ESP32 và webcam trực tiếp từ trình duyệt (Chrome / Edge), không cần chạy dịch vụ AI trên máy tại cổng.
 *
 *  - ESP32 nối qua USB: đọc các dòng sự kiện (CAPTURE_IN, STATUS:OPENED_IN...) và gửi lệnh (OPEN_IN, CLOSE_OUT...) bằng Web Serial.
 *  - Webcam: lấy bằng getUserMedia, chụp khung hình gửi lên dịch vụ AI trên cloud để đọc biển số.
 *
 * Giao thức serial khớp firmware esp32_smart_gate.ino (115200 baud, mỗi lệnh/sự kiện một dòng).
 */

const BAUD_RATE = 115200
// Chip cầu nối USB-UART thường gặp trên board ESP32: CH340, CP210x, FTDI
const USB_FILTERS = [{ usbVendorId: 0x1a86 }, { usbVendorId: 0x10c4 }, { usbVendorId: 0x0403 }]

const lineListeners = new Set()
const stateListeners = new Set()

let port = null
let reader = null
let writer = null
let reading = false
let opening = false
let connected = false
let label = ''
const barrier = { in: 'closed', out: 'closed' }

const emitState = () => stateListeners.forEach(fn => { try { fn({ connected, label }) } catch { /* bỏ qua */ } })
const emitLine = line => lineListeners.forEach(fn => { try { fn(line) } catch { /* bỏ qua */ } })

function track(line) {
  const m = /^STATUS:(OPENED|CLOSED)_(IN|OUT)/i.exec(line)
  if (m) barrier[m[2].toLowerCase()] = m[1].toUpperCase() === 'OPENED' ? 'opened' : 'closed'
}

async function readLoop() {
  const decoder = new TextDecoder()
  let buffer = ''
  reading = true
  try {
    while (port?.readable && reading) {
      reader = port.readable.getReader()
      try {
        while (reading) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let index
          while ((index = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, index).trim()
            buffer = buffer.slice(index + 1)
            if (line) { track(line); emitLine(line) }
          }
        }
      } finally {
        try { reader.releaseLock() } catch { /* bỏ qua */ }
        reader = null
      }
    }
  } catch {
    // Rút dây hoặc mất kết nối: dọn dẹp bên dưới
  }
  await cleanup()
}

async function cleanup() {
  reading = false
  try { writer?.releaseLock() } catch { /* bỏ qua */ }
  writer = null
  try { await port?.close() } catch { /* bỏ qua */ }
  port = null
  if (connected) {
    connected = false
    label = ''
    barrier.in = 'closed'
    barrier.out = 'closed'
    emitState()
  }
}

async function openPort(selected) {
  if (opening) return false
  opening = true
  try {
    await selected.open({ baudRate: BAUD_RATE })
    port = selected
    const info = selected.getInfo?.() || {}
    label = info.usbVendorId ? `USB ${info.usbVendorId.toString(16).toUpperCase()}:${(info.usbProductId || 0).toString(16).toUpperCase()}` : 'USB'
    connected = true
    emitState()
    void readLoop()
    return true
  } catch (error) {
    port = null
    throw error
  } finally {
    opening = false
  }
}

export const webSerialGate = {
  isSupported() { return typeof navigator !== 'undefined' && 'serial' in navigator },
  get connected() { return connected },
  get label() { return label },
  barrier() { return { ...barrier } },
  onLine(fn) { lineListeners.add(fn); return () => lineListeners.delete(fn) },
  onState(fn) { stateListeners.add(fn); return () => stateListeners.delete(fn) },

  /** Phải gọi từ thao tác của người dùng (bấm nút): trình duyệt hiện hộp chọn cổng. */
  async connect() {
    if (!this.isSupported()) throw new Error('Trình duyệt này không hỗ trợ kết nối USB. Hãy dùng Chrome hoặc Edge bản máy tính.')
    if (connected) return true
    let selected
    try {
      selected = await navigator.serial.requestPort({ filters: USB_FILTERS })
    } catch (error) {
      if (error?.name === 'NotFoundError') return false // người dùng đóng hộp chọn
      throw error
    }
    await openPort(selected)
    return true
  },

  /** Tự nối lại cổng đã được cấp quyền trước đó (không cần bấm), dùng khi mở trang hoặc vừa cắm dây. */
  async reconnect() {
    if (!this.isSupported() || connected || opening) return false
    try {
      const ports = await navigator.serial.getPorts()
      const candidate = ports.find(p => { const i = p.getInfo?.() || {}; return USB_FILTERS.some(f => f.usbVendorId === i.usbVendorId) }) || ports[0]
      if (!candidate) return false
      await openPort(candidate)
      return true
    } catch {
      return false
    }
  },

  async send(command) {
    if (!connected || !port?.writable) throw new Error('ESP32 chưa kết nối qua USB.')
    if (!writer) writer = port.writable.getWriter()
    await writer.write(new TextEncoder().encode(`${command}\n`))
    return true
  },

  async disconnect() {
    reading = false
    try { await reader?.cancel() } catch { /* bỏ qua */ }
    await cleanup()
  },
}

if (typeof navigator !== 'undefined' && 'serial' in navigator) {
  // Cắm dây vào là tự kết nối nếu trình duyệt đã được cấp quyền cổng này
  navigator.serial.addEventListener('connect', () => { void webSerialGate.reconnect() })
  navigator.serial.addEventListener('disconnect', () => { void webSerialGate.disconnect() })
}

// ── Webcam trong trình duyệt ────────────────────────────────────────────────
let stream = null
let probe = null
let displayEl = null
let starting = null
const cameraListeners = new Set()
const emitCamera = () => cameraListeners.forEach(fn => { try { fn(stream) } catch { /* bỏ qua */ } })

const hasFrame = video => Boolean(video && video.videoWidth > 0 && video.videoHeight > 0)
const waitFor = (test, timeoutMs) => new Promise(resolve => {
  const startedAt = Date.now()
  const tick = () => (test() ? resolve(true) : Date.now() - startedAt > timeoutMs ? resolve(false) : setTimeout(tick, 80))
  tick()
})

export const browserCamera = {
  isSupported() { return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) },
  get stream() { return stream },
  get active() { return Boolean(stream && stream.active) },
  onChange(fn) { cameraListeners.add(fn); return () => cameraListeners.delete(fn) },
  /** Gắn thẻ <video> đang hiển thị trên trang để chụp đúng khung hình người dùng đang thấy. */
  attach(el) { displayEl = el || null },

  async start() {
    if (this.active) return stream
    if (starting) return starting
    if (!this.isSupported()) throw new Error('Trình duyệt không hỗ trợ webcam.')
    starting = (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        // Thẻ video ẩn nhưng nằm trong trang (video tách khỏi trang có thể không giải mã khung hình)
        probe = document.createElement('video')
        probe.muted = true
        probe.playsInline = true
        probe.autoplay = true
        probe.setAttribute('aria-hidden', 'true')
        probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none'
        document.body.appendChild(probe)
        probe.srcObject = stream
        await probe.play().catch(() => {})
        await waitFor(() => hasFrame(probe), 4000)
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { this.stop() }))
        emitCamera()
        return stream
      } finally {
        starting = null
      }
    })()
    return starting
  },

  stop() {
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    if (probe) { probe.srcObject = null; probe.remove() }
    probe = null
    emitCamera()
  },

  /** Chụp khung hình hiện tại thành ảnh JPEG (ưu tiên khung đang hiển thị, đợi tối đa 2 giây nếu webcam chưa cho hình). */
  async captureBlob(quality = 0.92) {
    await waitFor(() => hasFrame(displayEl) || hasFrame(probe), 2000)
    const source = hasFrame(displayEl) ? displayEl : hasFrame(probe) ? probe : null
    if (!source) return null
    const canvas = document.createElement('canvas')
    canvas.width = source.videoWidth
    canvas.height = source.videoHeight
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  },
}
