import { PortSyncMessage } from '../types/portSync.types';

const INITIAL_MESSAGES: PortSyncMessage[] = [
  {
    id: 'msg-01',
    messageType: 'BAPLIE',
    direction: 'OUTBOUND',
    timestamp: '01/11/2026 21:30',
    status: 'SUCCESS',
    referenceNumber: 'BAPLIE-EE-2610N-01',
    retryCount: 0,
    payloadSummary: 'Sơ đồ xếp dỡ container tàu EVER ENVOY (180 conts)',
  },
  {
    id: 'msg-02',
    messageType: 'COPRAR',
    direction: 'OUTBOUND',
    timestamp: '01/11/2026 20:15',
    status: 'FAILED',
    referenceNumber: 'COPRAR-LOAD-OS2609',
    errorMessage: 'ERR_PORT_GATEWAY: Cảng từ chối do trùng lặp mã xếp dỡ cẩu bờ B02',
    retryCount: 2,
    payloadSummary: 'Lệnh bốc dỡ xếp tàu xuất khẩu cho chuyến OS-2609E',
  },
  {
    id: 'msg-03',
    messageType: 'CODECO_IN',
    direction: 'INBOUND',
    timestamp: '01/11/2026 18:40',
    status: 'SUCCESS',
    referenceNumber: 'CODECO-IN-98124',
    retryCount: 0,
    payloadSummary: 'Thông báo hạ bãi cảng thành công cont EMCU9284710',
  },
  {
    id: 'msg-04',
    messageType: 'CODECO_OUT',
    direction: 'INBOUND',
    timestamp: '01/11/2026 16:10',
    status: 'SUCCESS',
    referenceNumber: 'CODECO-OUT-8812',
    retryCount: 0,
    payloadSummary: 'Thông báo xe nhận hàng ra cổng cont PSCU8291048',
  },
  {
    id: 'msg-05',
    messageType: 'VERMAS',
    direction: 'OUTBOUND',
    timestamp: '01/11/2026 14:05',
    status: 'FAILED',
    referenceNumber: 'VGM-EMCU-9284710',
    errorMessage: 'VGM_TIMEOUT: Cổng truyền dữ liệu EDI TOS cảng không phản hồi sau 30s',
    retryCount: 1,
    payloadSummary: 'Xác nhận khối lượng toàn bộ VGM container EMCU9284710 (28,400 kg)',
  },
];

let localMessages = [...INITIAL_MESSAGES];

export const portSyncApi = {
  getMessages: async (): Promise<PortSyncMessage[]> => {
    return [...localMessages];
  },

  resendMessage: async (id: string): Promise<PortSyncMessage> => {
    const index = localMessages.findIndex((m) => m.id === id);
    if (index === -1) throw new Error('Không tìm thấy bản tin cần gửi lại.');

    // Simulate resend and recover
    localMessages[index] = {
      ...localMessages[index],
      status: 'SUCCESS',
      errorMessage: undefined,
      retryCount: (localMessages[index].retryCount ?? 0) + 1,
      timestamp: new Date().toLocaleString('vi-VN'),
    };

    return localMessages[index];
  },
};

