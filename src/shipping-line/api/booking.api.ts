import { apiClient } from './client';
import {
  ExportBooking,
  BookingFilterParams,
  ApproveBookingDto,
  RejectBookingDto,
} from '../types/booking.types';
import { PaginatedResult } from '../types/common.types';

const INITIAL_BOOKINGS: ExportBooking[] = [
  {
    id: 'bkg-001',
    bookingNumber: 'BKG-2026-0891',
    shipperName: 'Công ty Cổ phần Thủy sản Minh Phú',
    vesselName: 'EVER GLORY',
    voyageNumber: 'EG-2605W',
    destinationPort: 'Tokyo, Nhật Bản (JPTYO)',
    containerType: '40RF',
    containerQuantity: 4,
    etd: '05/11/2026 14:00',
    status: 'PENDING',
    cutOffs: [
      { code: 'SI_CUTOFF', label: 'SI Cut-off', deadline: '03/11/2026 12:00', isPassed: false },
      { code: 'VGM_CUTOFF', label: 'VGM Cut-off', deadline: '04/11/2026 10:00', isPassed: false },
      { code: 'CY_CUTOFF', label: 'CY Cut-off (Cắt máng cảng)', deadline: '04/11/2026 18:00', isPassed: false },
    ],
    containers: [
      { id: 'c1', containerNumber: 'EMCU9284710', containerType: '40RF', sealNumber: 'SL-88412', vgmWeight: 28400, status: 'CHO_DONG' },
      { id: 'c2', containerNumber: 'EMCU9284725', containerType: '40RF', sealNumber: 'SL-88413', vgmWeight: 28250, status: 'CHO_DONG' },
    ],
    history: [
      { id: 'h1', timestamp: '01/11/2026 09:15', actor: 'Shipper', action: 'TẠO_BOOKING', description: 'Gửi yêu cầu đặt 4x40RF đi Tokyo' },
    ],
  },
  {
    id: 'bkg-002',
    bookingNumber: 'BKG-2026-0892',
    shipperName: 'Tập đoàn Dệt may Việt Nam (Vinatex)',
    vesselName: 'ONE CONTINUITY',
    voyageNumber: 'OC-2612E',
    destinationPort: 'Los Angeles, Mỹ (USLAX)',
    containerType: '40HC',
    containerQuantity: 10,
    etd: '07/11/2026 20:00',
    status: 'PENDING',
    cutOffs: [
      { code: 'SI_CUTOFF', label: 'SI Cut-off', deadline: '05/11/2026 17:00', isPassed: false },
      { code: 'VGM_CUTOFF', label: 'VGM Cut-off', deadline: '06/11/2026 12:00', isPassed: false },
      { code: 'CY_CUTOFF', label: 'CY Cut-off (Cắt máng cảng)', deadline: '06/11/2026 22:00', isPassed: false },
    ],
    containers: [],
    history: [
      { id: 'h2', timestamp: '01/11/2026 10:30', actor: 'Vinatex Forwarder', action: 'TẠO_BOOKING', description: 'Yêu cầu 10x40HC hàng may mặc' },
    ],
  },
  {
    id: 'bkg-003',
    bookingNumber: 'BKG-2026-0870',
    shipperName: 'Công ty TNHH Gỗ An Cường',
    vesselName: 'MOL CREATION',
    voyageNumber: 'MC-2608S',
    destinationPort: 'Singapore (SGSIN)',
    containerType: '20GP',
    containerQuantity: 6,
    etd: '03/11/2026 06:00',
    status: 'APPROVED',
    depotPickUp: 'Depot Tân Cảng Suối Tiên',
    freeDemDays: 7,
    freeDetDays: 5,
    cutOffs: [
      { code: 'SI_CUTOFF', label: 'SI Cut-off', deadline: '01/11/2026 16:00', isPassed: true },
      { code: 'VGM_CUTOFF', label: 'VGM Cut-off', deadline: '02/11/2026 10:00', isPassed: false },
      { code: 'CY_CUTOFF', label: 'CY Cut-off (Cắt máng cảng)', deadline: '02/11/2026 18:00', isPassed: false },
    ],
    containers: [
      { id: 'c3', containerNumber: 'TCNU4821903', containerType: '20GP', sealNumber: 'SL-99104', vgmWeight: 21500, status: 'DA_HA_BAI' },
      { id: 'c4', containerNumber: 'TCNU4821919', containerType: '20GP', sealNumber: 'SL-99105', vgmWeight: 21400, status: 'DA_HA_BAI' },
    ],
    history: [
      { id: 'h3', timestamp: '30/10/2026 14:00', actor: 'Shipper', action: 'TẠO_BOOKING', description: 'Gửi yêu cầu 6x20GP đi Singapore' },
      { id: 'h4', timestamp: '31/10/2026 08:30', actor: 'Hãng tàu ONE', action: 'DUYỆT_BOOKING', description: 'Duyệt cấp vỏ tại Depot Suối Tiên, Free 7 DEM / 5 DET' },
    ],
  },
  {
    id: 'bkg-004',
    bookingNumber: 'BKG-2026-0855',
    shipperName: 'Công ty CP Cà phê Trung Nguyên',
    vesselName: 'EVER BLINK',
    voyageNumber: 'EB-2603N',
    destinationPort: 'Hamburg, Đức (DEHAM)',
    containerType: '40HC',
    containerQuantity: 8,
    etd: '02/11/2026 18:00',
    status: 'BL_ISSUED',
    blNumber: 'ONEY26085500',
    depotPickUp: 'Depot ICD Phước Long',
    freeDemDays: 10,
    freeDetDays: 7,
    cutOffs: [
      { code: 'SI_CUTOFF', label: 'SI Cut-off', deadline: '30/10/2026 17:00', isPassed: true },
      { code: 'VGM_CUTOFF', label: 'VGM Cut-off', deadline: '31/10/2026 12:00', isPassed: true },
      { code: 'CY_CUTOFF', label: 'CY Cut-off (Cắt máng cảng)', deadline: '01/11/2026 20:00', isPassed: true },
    ],
    containers: [
      { id: 'c5', containerNumber: 'TEMU7193842', containerType: '40HC', sealNumber: 'SL-77123', vgmWeight: 29500, status: 'DA_XEP_TAU' },
      { id: 'c6', containerNumber: 'TEMU7193858', containerType: '40HC', sealNumber: 'SL-77124', vgmWeight: 29480, status: 'DA_XEP_TAU' },
    ],
    history: [
      { id: 'h5', timestamp: '28/10/2026 09:00', actor: 'Shipper', action: 'TẠO_BOOKING', description: 'Tạo booking xuất cà phê 8x40HC' },
      { id: 'h6', timestamp: '28/10/2026 11:20', actor: 'Hãng tàu', action: 'DUYỆT_BOOKING', description: 'Đã duyệt cấp vỏ' },
      { id: 'h7', timestamp: '01/11/2026 16:00', actor: 'Documentation Team', action: 'PHÁT_HÀNH_BL', description: 'Phát hành OBL ONEY26085500' },
    ],
  },
  {
    id: 'bkg-005',
    bookingNumber: 'BKG-2026-0840',
    shipperName: 'Công ty TNHH Nhựa Duy Tân',
    vesselName: 'KMTC INCHEON',
    voyageNumber: 'KI-2601W',
    destinationPort: 'Busan, Hàn Quốc (KRPUS)',
    containerType: '20GP',
    containerQuantity: 3,
    etd: '04/11/2026 10:00',
    status: 'REJECTED',
    rejectionReason: 'Tàu đã đầy tải tải trọng phân bổ (Deadweight capacity full)',
    history: [
      { id: 'h8', timestamp: '29/10/2026 15:45', actor: 'Shipper', action: 'TẠO_BOOKING', description: 'Đề nghị cấp 3x20GP đi Busan' },
      { id: 'h9', timestamp: '30/10/2026 09:00', actor: 'Hãng tàu', action: 'TỪ_CHỐI_BOOKING', description: 'Từ chối: Tàu đã đầy tải tải trọng phân bổ' },
    ],
  },
];

function mapBackendBooking(item: any): ExportBooking {
  return {
    id: String(item.id),
    bookingNumber: item.bookingNo || `BK-${item.id}`,
    shipperName: item.forwarderName || 'Forwarder Khách Hàng',
    vesselName: item.vesselName || 'EVER GIVEN',
    voyageNumber: item.voyageNumber || 'EG-2605W',
    destinationPort: item.portOfDischarge || 'Tokyo, Nhật Bản (JPTYO)',
    containerType: (item.containerType as any) || '40HC',
    containerQuantity: item.quantity || 1,
    etd: item.requestedEtd ? new Date(item.requestedEtd).toLocaleString('vi-VN') : '05/11/2026 14:00',
    status: (item.status === 'Submitted' ? 'PENDING'
          : item.status === 'Approved' ? 'CONFIRMED'
          : item.status === 'ContainersDeclared' ? 'CONFIRMED'
          : item.status === 'Loaded' ? 'COMPLETED'
          : item.status === 'BlIssued' ? 'COMPLETED'
          : item.status === 'Rejected' ? 'REJECTED'
          : 'PENDING') as any,
    rejectionReason: item.rejectReason,
    cutOffs: [
      { code: 'SI_CUTOFF', label: 'SI Cut-off', deadline: item.siCutoff ? new Date(item.siCutoff).toLocaleString('vi-VN') : '03/11/2026 12:00', isPassed: false },
      { code: 'VGM_CUTOFF', label: 'VGM Cut-off', deadline: item.vgmCutoff ? new Date(item.vgmCutoff).toLocaleString('vi-VN') : '04/11/2026 10:00', isPassed: false },
      { code: 'CY_CUTOFF', label: 'CY Cut-off (Cắt máng cảng)', deadline: item.cyCutoff ? new Date(item.cyCutoff).toLocaleString('vi-VN') : '04/11/2026 18:00', isPassed: false },
    ],
    containers: (item.containers || []).map((c: any) => ({
      id: String(c.id),
      containerNumber: c.containerNo,
      containerType: c.containerType,
      sealNumber: c.sealNo,
      vgmWeight: c.vgmKg,
      status: c.status
    })),
    history: [
      { id: 'h1', timestamp: item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '01/11/2026', actor: 'Forwarder', action: 'TẠO_BOOKING', description: item.commodityDescription || 'Yêu cầu đặt chỗ xuất khẩu' }
    ]
  };
}

let localBookings = [...INITIAL_BOOKINGS];

export const bookingApi = {
  getBookings: async (params: BookingFilterParams): Promise<PaginatedResult<ExportBooking>> => {
    try {
      const res = await apiClient.get('/bookings', { params });
      const rawList = res.data?.items || res.data?.data;
      if (Array.isArray(rawList) && rawList.length > 0) {
        const liveList = rawList.map(mapBackendBooking);
        // Prepend live bookings from backend
        const existingIds = new Set(liveList.map((b: ExportBooking) => b.bookingNumber));
        localBookings = [...liveList, ...INITIAL_BOOKINGS.filter(b => !existingIds.has(b.bookingNumber))];
      }
    } catch (e) {
      console.warn('Backend bookings fallback to local dataset:', e);
    }

    let filtered = [...localBookings];

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.bookingNumber.toLowerCase().includes(q) ||
          b.shipperName.toLowerCase().includes(q) ||
          b.destinationPort.toLowerCase().includes(q)
      );
    }

    if (params.status) {
      filtered = filtered.filter((b) => b.status === params.status);
    }

    if (params.voyage) {
      filtered = filtered.filter((b) => b.voyageNumber === params.voyage);
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return {
      items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  },

  getBookingDetail: async (id: string): Promise<ExportBooking> => {
    const found = localBookings.find((b) => b.id === id || b.bookingNumber === id);
    if (!found) throw new Error('Không tìm thấy thông tin booking.');
    return found;
  },

  approveBooking: async (id: string, dto: ApproveBookingDto): Promise<ExportBooking> => {
    const index = localBookings.findIndex((b) => b.id === id || b.bookingNumber === id);
    if (index === -1) throw new Error('Không tìm thấy booking để duyệt.');

    const current = localBookings[index];
    const updated: ExportBooking = {
      ...current,
      status: 'APPROVED',
      voyageNumber: dto.voyageNumber || current.voyageNumber,
      depotPickUp: dto.depotPickUp,
      freeDemDays: dto.freeDemDays,
      freeDetDays: dto.freeDetDays,
      history: [
        ...(current.history || []),
        {
          id: `h-${Date.now()}`,
          timestamp: new Date().toLocaleString('vi-VN'),
          actor: 'Hãng tàu',
          action: 'DUYỆT_BOOKING',
          description: `Đã duyệt cấp vỏ tại ${dto.depotPickUp}, miễn phí ${dto.freeDemDays} ngày DEM / ${dto.freeDetDays} ngày DET`,
        },
      ],
    };

    localBookings[index] = updated;
    return updated;
  },

  rejectBooking: async (id: string, dto: RejectBookingDto): Promise<ExportBooking> => {
    const index = localBookings.findIndex((b) => b.id === id || b.bookingNumber === id);
    if (index === -1) throw new Error('Không tìm thấy booking.');

    const current = localBookings[index];
    const updated: ExportBooking = {
      ...current,
      status: 'REJECTED',
      rejectionReason: dto.reason,
      history: [
        ...(current.history || []),
        {
          id: `h-${Date.now()}`,
          timestamp: new Date().toLocaleString('vi-VN'),
          actor: 'Hãng tàu',
          action: 'TỪ_CHỐI_BOOKING',
          description: `Lý do từ chối: ${dto.reason}`,
        },
      ],
    };

    localBookings[index] = updated;
    return updated;
  },

  issueBillOfLading: async (id: string): Promise<ExportBooking> => {
    const index = localBookings.findIndex((b) => b.id === id || b.bookingNumber === id);
    if (index === -1) throw new Error('Không tìm thấy booking.');

    const current = localBookings[index];
    const newBlNumber = `ONEY${Math.floor(10000000 + Math.random() * 90000000)}`;
    const updated: ExportBooking = {
      ...current,
      status: 'BL_ISSUED',
      blNumber: newBlNumber,
      history: [
        ...(current.history || []),
        {
          id: `h-${Date.now()}`,
          timestamp: new Date().toLocaleString('vi-VN'),
          actor: 'Hãng tàu',
          action: 'PHÁT_HÀNH_BL',
          description: `Đã phát hành vận đơn B/L số ${newBlNumber}`,
        },
      ],
    };

    localBookings[index] = updated;
    return updated;
  },
};

