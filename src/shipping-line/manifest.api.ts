import {
  ImportVoyage,
  BillOfLading,
} from '../types/manifest.types';

const INITIAL_VOYAGES: ImportVoyage[] = [
  {
    id: 'vyg-01',
    vesselName: 'EVER ENVOY',
    voyageNumber: 'EE-2610N',
    eta: '02/11/2026 08:00',
    ata: '02/11/2026 07:45',
    berthCode: 'Cầu B-01',
    totalBL: 24,
    totalContainers: 180,
    manifestUploaded: true,
  },
  {
    id: 'vyg-02',
    vesselName: 'ONE SWAN',
    voyageNumber: 'OS-2609E',
    eta: '04/11/2026 14:00',
    berthCode: 'Cầu B-02',
    totalBL: 18,
    totalContainers: 145,
    manifestUploaded: true,
  },
  {
    id: 'vyg-03',
    vesselName: 'WAN HAI 312',
    voyageNumber: 'WH-2615S',
    eta: '06/11/2026 22:00',
    totalBL: 12,
    totalContainers: 90,
    manifestUploaded: false,
  },
];

let localVoyages = [...INITIAL_VOYAGES];

let localBLs: BillOfLading[] = [
  {
    id: 'bl-001',
    blNumber: 'ONEY26001928',
    voyageNumber: 'EE-2610N',
    vesselName: 'EVER ENVOY',
    consignee: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)',
    containerCount: 2,
    status: 'PENDING_DO',
    eta: '02/11/2026 08:00',
    packagesCount: 1200,
    grossWeightKg: 42000,
    containers: [
      { id: 'ic1', containerNumber: 'TCLU5192834', containerType: '40HC', sealNumber: 'SL-88190', status: 'DISCHARGED', dischargedAt: '02/11/2026 09:30' },
      { id: 'ic2', containerNumber: 'TCLU5192840', containerType: '40HC', sealNumber: 'SL-88191', status: 'DISCHARGED', dischargedAt: '02/11/2026 09:45' },
    ],
    charges: [
      { id: 'ch1', chargeName: 'Cước biển nhập khẩu (Ocean Freight)', amount: 48500000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
      { id: 'ch2', chargeName: 'Phí lệnh giao hàng (D/O Fee)', amount: 1200000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
      { id: 'ch3', chargeName: 'Phí vệ sinh container (Cleaning Fee)', amount: 800000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
      { id: 'ch4', chargeName: 'Phí THC nhập (Terminal Handling)', amount: 5600000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
    ],
  },
  {
    id: 'bl-002',
    blNumber: 'ONEY26001929',
    voyageNumber: 'EE-2610N',
    vesselName: 'EVER ENVOY',
    consignee: 'Công ty TNHH Samsung Electronics HCMC',
    containerCount: 4,
    status: 'PENDING_PAYMENT',
    eta: '02/11/2026 08:00',
    packagesCount: 3400,
    grossWeightKg: 78500,
    containers: [
      { id: 'ic3', containerNumber: 'SMLU3921045', containerType: '40HC', sealNumber: 'SL-99120', status: 'ON_VESSEL' },
      { id: 'ic4', containerNumber: 'SMLU3921050', containerType: '40HC', sealNumber: 'SL-99121', status: 'ON_VESSEL' },
    ],
    charges: [
      { id: 'ch5', chargeName: 'Cước biển nhập khẩu (Ocean Freight)', amount: 92000000, currency: 'VND', isPaid: false },
      { id: 'ch6', chargeName: 'Phí lệnh giao hàng (D/O Fee)', amount: 1500000, currency: 'VND', isPaid: false },
      { id: 'ch7', chargeName: 'Phí THC nhập (Terminal Handling)', amount: 11200000, currency: 'VND', isPaid: false },
    ],
  },
  {
    id: 'bl-003',
    blNumber: 'ONEY26001930',
    voyageNumber: 'EE-2610N',
    vesselName: 'EVER ENVOY',
    consignee: 'Công ty TNHH Thép Posco Việt Nam',
    containerCount: 1,
    status: 'DO_ISSUED',
    eta: '02/11/2026 08:00',
    packagesCount: 22,
    grossWeightKg: 28000,
    containers: [
      { id: 'ic5', containerNumber: 'PSCU8291048', containerType: '20GP', sealNumber: 'SL-33100', status: 'GATE_OUT', dischargedAt: '02/11/2026 10:15', gateOutAt: '02/11/2026 14:00' },
    ],
    charges: [
      { id: 'ch8', chargeName: 'Cước trọn gói D/O & THC', amount: 18500000, currency: 'VND', isPaid: true, paidAt: '31/10/2026' },
    ],
  },
];

export const manifestApi = {
  getVoyages: async (): Promise<ImportVoyage[]> => {
    return [...localVoyages];
  },

  getVoyageManifest: async (voyageNumber: string): Promise<{ voyage: ImportVoyage; bls: BillOfLading[] }> => {
    const voyage = localVoyages.find((v) => v.voyageNumber === voyageNumber) || localVoyages[0];
    const bls = localBLs.filter((b) => b.voyageNumber === voyage.voyageNumber);
    return { voyage, bls };
  },

  getBLDetail: async (blNumber: string): Promise<BillOfLading> => {
    const found = localBLs.find((b) => b.blNumber === blNumber || b.id === blNumber);
    if (!found) throw new Error('Không tìm thấy thông tin vận đơn B/L.');
    return found;
  },

  importManifestCsv: async (voyageNumber: string, _file: File): Promise<{ count: number }> => {
    const voyage = localVoyages.find((v) => v.voyageNumber === voyageNumber);
    if (voyage) {
      voyage.manifestUploaded = true;
    }
    return { count: 15 };
  },

  sendArrivalNotice: async (blNumber: string): Promise<BillOfLading> => {
    const index = localBLs.findIndex((b) => b.blNumber === blNumber);
    if (index === -1) throw new Error('Không tìm thấy vận đơn.');
    localBLs[index] = {
      ...localBLs[index],
      status: 'PENDING_PAYMENT',
    };
    return localBLs[index];
  },

  confirmPayment: async (blNumber: string): Promise<BillOfLading> => {
    const index = localBLs.findIndex((b) => b.blNumber === blNumber);
    if (index === -1) throw new Error('Không tìm thấy vận đơn.');
    localBLs[index] = {
      ...localBLs[index],
      status: 'PENDING_DO',
      charges: localBLs[index].charges?.map((c) => ({ ...c, isPaid: true, paidAt: new Date().toLocaleDateString('vi-VN') })),
    };
    return localBLs[index];
  },

  issueDeliveryOrder: async (blNumber: string): Promise<{ bl: BillOfLading; doNumber: string }> => {
    const index = localBLs.findIndex((b) => b.blNumber === blNumber);
    if (index === -1) throw new Error('Không tìm thấy vận đơn.');
    const doNumber = `DO-${blNumber.replace('ONEY', '')}`;
    localBLs[index] = {
      ...localBLs[index],
      status: 'DO_ISSUED',
    };
    return { bl: localBLs[index], doNumber };
  },
};

