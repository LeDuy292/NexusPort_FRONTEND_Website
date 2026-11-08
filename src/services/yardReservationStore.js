// Shared Yard Reservation Store for syncing Gate Booking Reservations with Yard Maps
const STORAGE_KEY = 'nexusport_yard_reservations'

export const yardReservationStore = {
  getReservations: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const list = JSON.parse(raw)
      if (!Array.isArray(list)) return []

      // Mỗi container hoặc booking CHỈ ĐƯỢC ĐẶT DUY NHẤT 1 VỊ TRÍ trong toàn bộ bãi cảng.
      // Quét từ mới nhất (cuối mảng) lên trước để giữ lại vị trí được cập nhật sau cùng.
      const seenContainers = new Set()
      const seenBookings = new Set()
      const deduped = []

      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i]
        const contKey = (item.containerNo || item.containerId || item.booking?.containerId || '').trim().toUpperCase()
        const bookKey = (item.bookingCode || item.booking?.id || '').trim().toUpperCase()

        // Bỏ qua các bản ghi rác không có mã container lẫn mã booking
        if (!contKey && !bookKey) continue

        let isDuplicate = false
        if (contKey) {
          if (seenContainers.has(contKey)) isDuplicate = true
          else seenContainers.add(contKey)
        }
        if (bookKey) {
          if (seenBookings.has(bookKey)) isDuplicate = true
          else seenBookings.add(bookKey)
        }

        if (!isDuplicate) {
          deduped.unshift(item)
        }
      }
      return deduped
    } catch {
      return []
    }
  },

  addReservation: (reservation) => {
    try {
      const list = yardReservationStore.getReservations()
      const contId = (reservation.containerId || reservation.containerNo || reservation.booking?.containerId || '').trim().toUpperCase()
      const bookId = (reservation.bookingCode || reservation.booking?.id || '').trim().toUpperCase()

      // 1 container chỉ nằm ở 1 vị trí:
      // Khi chọn vị trí mới thì huỷ toàn bộ vị trí cũ của container này ở mọi Block!
      const filtered = list.filter((r) => {
        const rCont = (r.containerId || r.containerNo || r.booking?.containerId || '').trim().toUpperCase()
        const rBook = (r.bookingCode || r.booking?.id || '').trim().toUpperCase()
        if (contId && rCont === contId) return false
        if (bookId && rBook === bookId) return false
        if (
          r.blockCode === reservation.blockCode &&
          Number(r.bay) === Number(reservation.bay) &&
          Number(r.row) === Number(reservation.row) &&
          Number(r.tier) === Number(reservation.tier)
        ) {
          return false
        }
        return true
      })

      const newItem = {
        ...reservation,
        containerNo: contId || reservation.containerNo,
        containerId: contId || reservation.containerId,
        createdAt: new Date().toISOString(),
      }
      filtered.push(newItem)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))

      // Kích hoạt event đồng bộ tức thì cho các component khác đang mở
      window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: newItem }))
      return newItem
    } catch (err) {
      console.error('Failed to save yard reservation to store', err)
      return reservation
    }
  },

  removeReservation: (posId) => {
    try {
      const list = yardReservationStore.getReservations().filter((r) => r.posId !== posId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: { posId, removed: true } }))
    } catch (err) {
      console.error('Failed to remove reservation', err)
    }
  },

  // Xoá toàn bộ vị trí đã lưu của một container cụ thể
  clearContainerReservation: (containerId) => {
    try {
      const key = (containerId || '').trim().toUpperCase()
      if (!key) return
      const list = yardReservationStore.getReservations().filter((r) => {
        const rCont = (r.containerId || r.containerNo || r.booking?.containerId || '').trim().toUpperCase()
        return rCont !== key
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
      window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: { clearedContainer: key } }))
    } catch (err) {
      console.error('Failed to clear container reservation', err)
    }
  }
}
