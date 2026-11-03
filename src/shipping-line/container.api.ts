import { ContainerLookupData } from '../types/container.types';

export function validateISO6346(code: string): { isValid: boolean; message?: string } {
  const clean = code.trim().toUpperCase();
  if (!clean) return { isValid: false, message: 'Vui lòng nhập số container.' };
  if (!/^[A-Z]{4}\d{7}$/.test(clean)) {
    return { isValid: false, message: 'Số container phải có đúng 4 chữ cái và 7 chữ số (chuẩn ISO 6346, ví dụ: TCLU5192834).' };
  }

  // ISO 6346 check digit validation
  const charValues: Record<string, number> = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  };

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = clean[i];
    const val = char >= '0' && char <= '9' ? parseInt(char, 10) : charValues[char] || 0;
    sum += val * Math.pow(2, i);
  }

  const checkDigit = (sum % 11) % 10;
  const actualCheckDigit = parseInt(clean[10], 10);

  if (checkDigit !== actualCheckDigit) {
    return {
      isValid: false,
      message: `Chữ số kiểm tra (check-digit) không hợp lệ theo ISO 6346 (kỳ vọng ${checkDigit}, thực tế ${actualCheckDigit}).`,
    };
  }

  return { isValid: true };
}

export const containerApi = {
  lookup: async (containerNumber: string): Promise<ContainerLookupData> => {
    const clean = containerNumber.trim().toUpperCase();

    // Mock realistic lifecycle
    return {
      containerNumber: clean,
      containerType: clean.startsWith('TC') ? '40HC' : clean.startsWith('EM') ? '40RF' : '20GP',
      status: 'LƯU BÃI CẢNG (DISCHARGED_AT_YARD)',
      currentLocation: 'BÃI B - BLOCK B03 - BAY 12 - ROW 02 - TIER 03',
      sealNumber: 'SL-881903',
      vesselVoyage: 'EVER ENVOY / EE-2610N',
      bookingOrBLNumber: 'ONEY26001928',
      events: [
        {
          id: 'ev-1',
          timestamp: '25/10/2026 14:00',
          eventCode: 'GATE_IN_POL',
          title: 'Hạ bãi cảng xếp (Shanghai Port, Trung Quốc)',
          location: 'SIPG Terminal, Thượng Hải',
          details: 'Container đã kiểm tra seal SL-881903 nguyên vẹn, VGM 28,450 kg',
        },
        {
          id: 'ev-2',
          timestamp: '27/10/2026 09:30',
          eventCode: 'LOAD_ON_VESSEL',
          title: 'Xếp lên tàu EVER ENVOY (Hầm số 02)',
          location: 'Cầu bến SH-04, Thượng Hải',
          details: 'Cẩu bờ STS hoàn tất bốc dỡ theo sơ đồ BAPLIE',
        },
        {
          id: 'ev-3',
          timestamp: '02/11/2026 08:30',
          eventCode: 'VESSEL_BERTHED',
          title: 'Tàu cập cảng NexusPort Tân Cảng',
          location: 'Cầu Bến B-01, NexusPort',
          details: 'Làm thủ tục hải quan hoa tiêu và cập cầu an toàn',
        },
        {
          id: 'ev-4',
          timestamp: '02/11/2026 10:15',
          eventCode: 'DISCHARGED',
          title: 'Dỡ khỏi tàu hạ bãi bến cảng',
          location: 'Vị trí B03-12-02-03',
          details: 'Cẩu bờ STS-01 dỡ hạ xe đầu kéo nội bộ chuyển về block B03',
        },
        {
          id: 'ev-5',
          timestamp: '02/11/2026 11:00',
          eventCode: 'REEFER_PLUGGED',
          title: 'Cắm điện giám sát nhiệt độ',
          location: 'Trạm cắm bãi Reefer C01',
          details: 'Nhiệt độ cài đặt: -18.0°C, nhiệt độ đo thực: -17.8°C',
        },
      ],
      demDet: {
        containerNumber: clean,
        calculationDate: '01/11/2026 23:00',
        dischargedDate: '24/10/2026 08:00',
        totalDays: 9,
        freeDays: 5,
        chargeableDays: 4,
        currency: 'VND',
        totalAmount: 2200000,
        tiers: [
          {
            tierName: 'Thời gian miễn phí (Free time)',
            fromDay: 1,
            toDay: 5,
            ratePerDay: 0,
            daysCount: 5,
            subTotal: 0,
          },
          {
            tierName: 'Bậc 1 (Từ ngày 6 đến 8)',
            fromDay: 6,
            toDay: 8,
            ratePerDay: 500000,
            daysCount: 3,
            subTotal: 1500000,
          },
          {
            tierName: 'Bậc 2 (Từ ngày 9 trở đi)',
            fromDay: 9,
            toDay: 9,
            ratePerDay: 700000,
            daysCount: 1,
            subTotal: 700000,
          },
        ],
      },
    };
  },
};

