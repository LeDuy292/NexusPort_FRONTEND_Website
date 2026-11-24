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

  // Chuẩn hóa xếp tầng (Stacking rule): Tầng 1 (nền bãi) bắt buộc phải có cont trước khi lên tầng 2.
  // Không bao giờ để container lơ lửng ở tầng 2 khi tầng 1 trống
  const posTierMap = new Map();
  deduped.forEach(item => {
    const block = item.blockCode || item.block || '';
    const bay = Number(item.bay) || 1;
    const row = Number(item.row) || 1;
    const key = `${block}-${bay}-${row}`;
    if (!posTierMap.has(key)) posTierMap.set(key, []);
    posTierMap.get(key).push(item);
  });

  posTierMap.forEach((itemsAtPos) => {
    itemsAtPos.sort((a, b) => (Number(a.tier) || 1) - (Number(b.tier) || 1));
    itemsAtPos.forEach((item, idx) => {
      const correctTier = idx + 1; // 1, 2, 3...
      item.tier = correctTier;
      if (item.tierCode) item.tierCode = String(correctTier);
      const padB = String(item.bay).padStart(2, '0');
      const padR = String(item.row).padStart(2, '0');
      const block = item.blockCode || item.block || '';
      item.slotCode = `${block}.${padB}.${padR}.${correctTier}`;
      item.posId = `${block}-B${padB}-R${item.row}-T${correctTier}`;
    });
  });

  return deduped;
}

let isSyncingFromApi = false;

export const yardReservationStore = {
  // Lấy danh sách lưu trữ từ localStorage và tự động kéo từ server nếu là máy khác
  getReservations: () => {
    try {
      if (typeof window !== 'undefined' && !isSyncingFromApi && !window.__yard_res_synced_once) {
        window.__yard_res_synced_once = true;
        yardReservationStore.getReservationsAsync().catch(() => {});
      }
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

  // Async accessor đồng bộ trực tiếp từ Database PostgreSQL của hệ thống
  getReservationsAsync: async () => {
    isSyncingFromApi = true;
    try {
      const data = await apiRequest('', 'GET');
      const list = Array.isArray(data) ? data : [];
      const validated = dedupAndValidate(list);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: { syncFromApi: true } }));
      }
      return validated;
    } catch {
      return yardReservationStore.getReservations();
    } finally {
      isSyncingFromApi = false;
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

  // Thêm hoặc cập nhật nhiều reservations cùng lúc (Batch)
  addReservationsBatch: async (reservations = [], options = {}) => {
    if (!Array.isArray(reservations) || reservations.length === 0) return [];
    try {
      const list = yardReservationStore.getReservations();
      const newItems = reservations.map(r => {
        const contId = (r.containerId || r.containerNo || r.booking?.containerId || '').trim().toUpperCase();
        return {
          ...r,
          containerNo: contId,
          containerId: contId,
          createdAt: r.createdAt || new Date().toISOString(),
        };
      });
      const updated = dedupAndValidate([...list, ...newItems]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (!options?.silent && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: { batch: true, count: newItems.length } }));
      }
      // Đồng bộ background lên server
      for (const item of newItems) {
        apiRequest('', 'POST', item).catch(() => null);
      }
      return updated;
    } catch (e) {
      console.warn('Batch add reservation warning:', e);
      return [];
    }
  },

  // Thêm hoặc cập nhật một reservation
  addReservation: async (reservation, options = {}) => {
    if (!reservation) return null;
    try {
      const list = yardReservationStore.getReservations();
      const contId = (reservation.containerId || reservation.containerNo || reservation.booking?.containerId || '').trim().toUpperCase();
      const newItem = {
        ...reservation,
        containerNo: contId,
        containerId: contId,
        createdAt: reservation.createdAt || new Date().toISOString(),
      };
      const updated = dedupAndValidate([...list, newItem]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (!options?.silent && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('yard-reservation-updated', { detail: newItem }));
      }

      try {
        const saved = await apiRequest('', 'POST', reservation);
        return saved || newItem;
      } catch {
        return newItem;
      }
    } catch (err) {
      console.warn('Add reservation error:', err);
      return null;
    }
  },

  // Alias để tương thích an toàn với các component gọi saveReservation
  saveReservation: async (reservation, options = {}) => {
    return yardReservationStore.addReservation(reservation, options);
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

// Khởi tạo: Tự động kéo toàn bộ vị trí bãi đã lưu trong Database PostgreSQL về máy
if (typeof window !== 'undefined') {
  yardReservationStore.getReservationsAsync().catch(() => {});
}
