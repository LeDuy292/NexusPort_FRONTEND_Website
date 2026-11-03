import { DeliveryOrder, DOFilterParams } from '../types/deliveryOrder.types';

const INITIAL_DOS: DeliveryOrder[] = [
  {
    id: 'do-1',
    doNumber: 'DO-26001928',
    blNumber: 'ONEY26001928',
    consignee: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)',
    validUntil: '10/11/2026 23:59',
    status: 'ACTIVE',
    containerCount: 2,
    issuedAt: '01/11/2026 15:30',
    updatedAt: '01/11/2026 15:30',
  },
  {
    id: 'do-2',
    doNumber: 'DO-26001915',
    blNumber: 'ONEY26001915',
    consignee: 'Công ty TNHH Hóa chất Miền Nam',
    validUntil: '08/11/2026 23:59',
    status: 'HOLD',
    containerCount: 3,
    holdReason: 'Thiếu giấy phép kiểm tra chuyên ngành hóa chất nguy hiểm',
    issuedAt: '30/10/2026 11:20',
    updatedAt: '31/10/2026 09:10',
  },
  {
    id: 'do-3',
    doNumber: 'DO-26001890',
    blNumber: 'ONEY26001890',
    consignee: 'Công ty TNHH Thiết bị Y tế Hoàng Long',
    validUntil: '02/11/2026 18:00',
    status: 'ACTIVE',
    containerCount: 1,
    issuedAt: '28/10/2026 14:00',
    updatedAt: '28/10/2026 14:00',
  },
  {
    id: 'do-4',
    doNumber: 'DO-26001850',
    blNumber: 'ONEY26001850',
    consignee: 'Công ty CP Xuất Nhập khẩu Thủy sản Cửu Long',
    validUntil: '26/10/2026 23:59',
    status: 'EXPIRED',
    containerCount: 2,
    issuedAt: '20/10/2026 08:30',
    updatedAt: '27/10/2026 00:00',
  },
  {
    id: 'do-5',
    doNumber: 'DO-26001822',
    blNumber: 'ONEY26001822',
    consignee: 'Công ty TNHH Vận tải & Logistics Sao Mai',
    validUntil: '24/10/2026 23:59',
    status: 'CANCELLED',
    containerCount: 1,
    holdReason: 'Chủ hàng đổi phương thức vận chuyển đường sắt',
    issuedAt: '18/10/2026 10:00',
    updatedAt: '19/10/2026 16:30',
  },
];

let localDOs = [...INITIAL_DOS];

export const deliveryOrderApi = {
  getDeliveryOrders: async (params?: DOFilterParams): Promise<DeliveryOrder[]> => {
    let result = [...localDOs];
    if (params?.status) {
      result = result.filter((d) => d.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.doNumber.toLowerCase().includes(q) ||
          d.blNumber.toLowerCase().includes(q) ||
          d.consignee.toLowerCase().includes(q)
      );
    }
    return result;
  },

  holdDO: async (id: string, reason: string): Promise<DeliveryOrder> => {
    const index = localDOs.findIndex((d) => d.id === id || d.doNumber === id);
    if (index === -1) throw new Error('Không tìm thấy lệnh D/O.');
    localDOs[index] = {
      ...localDOs[index],
      status: 'HOLD',
      holdReason: reason,
      updatedAt: new Date().toLocaleString('vi-VN'),
    };
    return localDOs[index];
  },

  releaseDO: async (id: string): Promise<DeliveryOrder> => {
    const index = localDOs.findIndex((d) => d.id === id || d.doNumber === id);
    if (index === -1) throw new Error('Không tìm thấy lệnh D/O.');
    localDOs[index] = {
      ...localDOs[index],
      status: 'ACTIVE',
      holdReason: undefined,
      updatedAt: new Date().toLocaleString('vi-VN'),
    };
    return localDOs[index];
  },

  cancelDO: async (id: string, reason: string): Promise<DeliveryOrder> => {
    const index = localDOs.findIndex((d) => d.id === id || d.doNumber === id);
    if (index === -1) throw new Error('Không tìm thấy lệnh D/O.');
    localDOs[index] = {
      ...localDOs[index],
      status: 'CANCELLED',
      holdReason: reason,
      updatedAt: new Date().toLocaleString('vi-VN'),
    };
    return localDOs[index];
  },
};

