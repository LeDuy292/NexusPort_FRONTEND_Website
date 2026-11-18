// Shared Yard Reservation Store for syncing Gate Booking Reservations with Yard Maps
const API_BASE = '/api/yard-reservations';
const STORAGE_KEY = 'yard_reservations_backup';

// API helper
async function apiRequest(url = '', method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${url}`, opts);
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`API error ${resp.status}: ${txt}`);
  }
  return resp.status === 204 ? null : resp.json();
}

// Deduplication and stacking validation
function dedupAndValidate(list) {
  const seenContainers = new Set();
  const seenSlots = new Set();
  const deduped = [];

  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    const contKey = (item.containerNo || item.containerId || item.booking?.containerId || '')
      .trim()
      .toUpperCase();
    const block = item.blockCode || item.block || '';
    const slotKey = `${block}-${item.bay}-${item.row}-${item.tier}`;

    if (!contKey && !item.posId && !item.bay) continue;

    let isDuplicate = false;
    if (contKey && contKey !== 'CONT' && contKey !== 'CONT-40') {
      if (seenContainers.has(contKey)) isDuplicate = true;
      else seenContainers.add(contKey);
    }
    if (slotKey && slotKey !== '---') {
      if (seenSlots.has(slotKey)) isDuplicate = true;
      else seenSlots.add(slotKey);
    }
    if (!isDuplicate) deduped.unshift(item);
  }

  // ===== STACKING VALIDATION: Loại bỏ container "lơ lửng" (tầng N khi tầng N-1 trống) =====
  deduped.sort((a, b) => Number(a.tier || 1) - Number(b.tier || 1));
  const validSlots = new Set();
  const result = [];

  for (const item of deduped) {
    const tier = Number(item.tier || 1);
    const block = item.blockCode || item.block || '';
    const slotId = `${block}-${item.bay}-${item.row}-${tier}`;

    if (tier <= 1) {
      validSlots.add(slotId);
      result.push(item);
    } else {
      const lowerSlotId = `${block}-${item.bay}-${item.row}-${tier - 1}`;
      if (validSlots.has(lowerSlotId)) {
        validSlots.add(slotId);
        result.push(item);
      } else {
        // Tầng dưới chưa có → reset xuống tầng 1 nếu tầng 1 còn trống
        const tier1SlotId = `${block}-${item.bay}-${item.row}-1`;
        if (!validSlots.has(tier1SlotId)) {
          const fixedItem = { ...item, tier: 1, tierCode: '1' };
          validSlots.add(tier1SlotId);
          result.push(fixedItem);
        }
        // Nếu tầng 1 đã bị chiếm thì bỏ qua container này
      }
    }
  }
  return result;
}

export const yardReservationStore = {
  // Lấy danh sách lưu trữ từ localStorage và loại bỏ trùng lặp (trả về Array đồng bộ)
  getReservations: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return dedupAndValidate(Array.isArray(list) ? list : []);
    } catch {
      return [];
    }
  },

  // Synchronous accessor alias
  getReservationsSync: () => {
    return yardReservationStore.getReservations();
  },

  // Async accessor nếu cần đồng bộ với backend
  getReservationsAsync: async () => {
    try {
      const data = await apiRequest('', 'GET');
      const list = Array.isArray(data) ? data : [];
      const validated = dedupAndValidate(list);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      return validated;
    } catch {
      return yardReservationStore.getReservations();
    }
  },

  // Lấy vị trí đặt chỗ của 1 container hoặc booking cụ thể (đồng bộ)
  getReservation: (identifier) => {
    try {
      if (!identifier) return null;
      const key = String(identifier).trim().toUpperCase();
      const list = yardReservationStore.getReservations();
      return (
        list.find((r) => {
          const rCont = (r.containerNo || r.containerId || r.booking?.containerId || '').trim().toUpperCase();
          const rBook = (r.bookingCode || r.booking?.id || r.bookingId || '').trim().toUpperCase();
          if (rCont && (rCont === key || (key.length >= 7 && rCont.includes(key)) || (rCont.length >= 7 && key.includes(rCont)))) {
            return true;
          }
          if (rBook && (rBook === key || rBook.includes(key) || key.includes(rBook))) {
            return true;
          }
          return false;
        }) || null
      );
    } catch {
      return null;
    }
  },

  // Thêm hoặc cập nhật một reservation
  addReservation: async (reservation) => {
    const list = yardReservationStore.getReservations();
    const contId = (reservation.containerId || reservation.containerNo || reservation.booking?.containerId || '').trim().toUpperCase();
    const newItem = {
      ...reservation,
      containerNo: contId,
      containerId: contId,
      createdAt: new Date().toISOString(),
    };
    const updated = dedupAndValidate([...list, newItem]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: newItem }));

    try {
      const saved = await apiRequest('', 'POST', reservation);
      return saved || newItem;
    } catch {
      return newItem;
    }
  },

  // Xóa một reservation dựa trên posId
  removeReservation: async (posId) => {
    try {
      const currentList = yardReservationStore.getReservations();
      const list = currentList.filter((r) => r.posId !== posId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(
        new CustomEvent('yard-reservation-updated', { detail: { posId, removed: true } })
      );
      await apiRequest(`/${encodeURIComponent(posId)}`, 'DELETE').catch(() => null);
    } catch (err) {
      console.error('Failed to remove reservation', err);
    }
  },

  // Xoá toàn bộ vị trí đã lưu của một container cụ thể
  clearContainerReservation: async (containerId) => {
    try {
      const key = (containerId || '').trim().toUpperCase();
      if (!key) return;
      const currentList = yardReservationStore.getReservations();
      const list = currentList.filter((r) => {
        const rCont = (r.containerId || r.containerNo || r.booking?.containerId || '')
          .trim()
          .toUpperCase();
        return rCont !== key;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(
        new CustomEvent('yard-reservation-updated', { detail: { clearedContainer: key } })
      );
      await apiRequest(`/container/${encodeURIComponent(key)}`, 'DELETE').catch(() => null);
    } catch (err) {
      console.error('Failed to clear container reservation', err);
    }
  },

  // Xóa toàn bộ vị trí bãi để test lại từ đầu
  clearAll: async () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      window.dispatchEvent(
        new CustomEvent('yard-reservation-updated', { detail: { allCleared: true } })
      );
      await apiRequest('', 'DELETE').catch(() => null);
    } catch (err) {
      console.error('Failed to clear all reservations', err);
    }
  },
};
