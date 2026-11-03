import {
  ImportVoyage,
  BillOfLading,
} from '../types/manifest.types';
import { DeliveryOrder } from '../types/deliveryOrder.types';

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
    consigneeName: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)',
    shipper: 'Fonterra Co-operative Group Ltd (Auckland, New Zealand)',
    notifyParty: 'Công ty Cổ phần Sữa Việt Nam - Trung Tâm Tiếp Vận Logistics',
    pol: 'NZAKL (Cảng Auckland, New Zealand)',
    pod: 'VNSGN (Cảng Tân Cảng Cát Lái - NexusPort)',
    cargoDescription: 'Bột sữa nguyên kem tách béo (Skimmed Milk Powder) phục vụ chế biến thực phẩm',
    hsCode: '0402.10.19',
    packagesCount: 1200,
    packageType: 'Bao xếp trên Pallet (Bags on Pallets)',
    grossWeightKg: 42000,
    cbm: 68.5,
    freightTerms: 'PREPAID',
    blType: 'ORIGINAL',
    containerCount: 2,
    status: 'PENDING_DO',
    eta: '02/11/2026 08:00',
    containers: [
      {
        id: 'ic1',
        containerNumber: 'TCLU5192834',
        containerType: '40HC',
        sealNumber: 'SL-88190',
        weightKg: 21000,
        tareWeightKg: 3880,
        cargoType: 'Hàng lạnh (Reefer -18°C)',
        status: 'DISCHARGED',
        dischargedAt: '02/11/2026 09:30',
      },
      {
        id: 'ic2',
        containerNumber: 'TCLU5192840',
        containerType: '40HC',
        sealNumber: 'SL-88191',
        weightKg: 21000,
        tareWeightKg: 3880,
        cargoType: 'Hàng lạnh (Reefer -18°C)',
        status: 'DISCHARGED',
        dischargedAt: '02/11/2026 09:45',
      },
    ],
    charges: [
      { id: 'ch1', chargeName: 'Cước biển nhập khẩu (Ocean Freight)', amount: 48500000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
      { id: 'ch2', chargeName: 'Phí lệnh giao hàng (D/O Fee)', amount: 1200000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
      { id: 'ch3', chargeName: 'Phí vệ sinh container (Cleaning Fee)', amount: 800000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
      { id: 'ch4', chargeName: 'Phí THC nhập (Terminal Handling Charge)', amount: 5600000, currency: 'VND', isPaid: true, paidAt: '01/11/2026' },
    ],
  },
  {
    id: 'bl-002',
    blNumber: 'ONEY26001929',
    voyageNumber: 'EE-2610N',
    vesselName: 'EVER ENVOY',
    consignee: 'Công ty TNHH Samsung Electronics HCMC CE Complex',
    consigneeName: 'Công ty TNHH Samsung Electronics HCMC CE Complex',
    shipper: 'Samsung Electronics Co., Ltd (Suwon-si, Gyeonggi-do, Hàn Quốc)',
    notifyParty: 'Samsung SDS Global SCL Vietnam Co., Ltd (TP. Thủ Đức)',
    pol: 'KRPUS (Cảng Busan, Hàn Quốc)',
    pod: 'VNSGN (Cảng Tân Cảng Cát Lái - NexusPort)',
    cargoDescription: 'Linh kiện vi mạch bán dẫn & tấm nền hiển thị OLED cao cấp cho thiết bị thông minh',
    hsCode: '8542.31.00',
    packagesCount: 3400,
    packageType: 'Thùng carton chống sốc (Cartons)',
    grossWeightKg: 78500,
    cbm: 145.2,
    freightTerms: 'PREPAID',
    blType: 'SEA_WAYBILL',
    containerCount: 4,
    status: 'PENDING_PAYMENT',
    eta: '02/11/2026 08:00',
    containers: [
      {
        id: 'ic3',
        containerNumber: 'SMLU3921045',
        containerType: '40HC',
        sealNumber: 'SL-99120',
        weightKg: 39250,
        tareWeightKg: 3900,
        cargoType: 'Hàng bách hóa công nghệ',
        status: 'ON_VESSEL',
      },
      {
        id: 'ic4',
        containerNumber: 'SMLU3921050',
        containerType: '40HC',
        sealNumber: 'SL-99121',
        weightKg: 39250,
        tareWeightKg: 3900,
        cargoType: 'Hàng bách hóa công nghệ',
        status: 'ON_VESSEL',
      },
    ],
    charges: [
      { id: 'ch5', chargeName: 'Cước biển nhập khẩu (Ocean Freight)', amount: 92000000, currency: 'VND', isPaid: false },
      { id: 'ch6', chargeName: 'Phí lệnh giao hàng (D/O Fee)', amount: 1500000, currency: 'VND', isPaid: false },
      { id: 'ch7', chargeName: 'Phí THC nhập (Terminal Handling Charge)', amount: 11200000, currency: 'VND', isPaid: false },
    ],
  },
  {
    id: 'bl-003',
    blNumber: 'ONEY26001930',
    voyageNumber: 'EE-2610N',
    vesselName: 'EVER ENVOY',
    consignee: 'Công ty TNHH Thép Posco Việt Nam',
    consigneeName: 'Công ty TNHH Thép Posco Việt Nam',
    shipper: 'POSCO Holdings Inc (Gangnam-gu, Seoul, Hàn Quốc)',
    notifyParty: 'Posco International Vietnam Corp (Quận 1, TP.HCM)',
    pol: 'KRPUS (Cảng Busan, Hàn Quốc)',
    pod: 'VNSGN (Cảng Tân Cảng Cát Lái - NexusPort)',
    cargoDescription: 'Thép cuộn mạ kẽm cán nguội tiêu chuẩn công nghiệp nặng',
    hsCode: '7210.49.12',
    packagesCount: 22,
    packageType: 'Cuộn thép đai sắt (Steel Coils)',
    grossWeightKg: 28000,
    cbm: 18.0,
    freightTerms: 'COLLECT',
    blType: 'TELEX_RELEASE',
    containerCount: 1,
    status: 'DO_ISSUED',
    eta: '02/11/2026 08:00',
    containers: [
      {
        id: 'ic5',
        containerNumber: 'PSCU8291048',
        containerType: '20GP',
        sealNumber: 'SL-33100',
        weightKg: 28000,
        tareWeightKg: 2250,
        cargoType: 'Hàng nặng (Heavy Cargo)',
        status: 'GATE_OUT',
        dischargedAt: '02/11/2026 10:15',
        gateOutAt: '02/11/2026 14:00',
      },
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

  issueDeliveryOrder: async (
    blNumber: string,
    options?: { validUntilDays?: number; emptyReturnDepot?: string; freeDetDays?: number }
  ): Promise<{ bl: BillOfLading; doNumber: string; deliveryOrder: Partial<DeliveryOrder> }> => {
    const index = localBLs.findIndex((b) => b.blNumber === blNumber);
    if (index === -1) throw new Error('Không tìm thấy vận đơn.');
    const bl = localBLs[index];
    const doNumber = `DO-${blNumber.replace('ONEY', '')}`;
    const validityDays = options?.validUntilDays || 7;
    const now = new Date();
    const expiryDate = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
    const validUntilStr = `${expiryDate.toLocaleDateString('vi-VN')} 23:59`;

    localBLs[index] = {
      ...bl,
      status: 'DO_ISSUED',
    };

    const newDO: Partial<DeliveryOrder> = {
      id: `do-${Date.now()}`,
      doNumber,
      blNumber: bl.blNumber,
      consignee: bl.consignee,
      vesselName: bl.vesselName,
      voyageNumber: bl.voyageNumber,
      validUntil: validUntilStr,
      status: 'ACTIVE',
      containerCount: bl.containerCount,
      emptyReturnDepot: options?.emptyReturnDepot || 'Depot Tân Cảng Suối Tiên',
      freeDetDays: options?.freeDetDays || 5,
      issuedAt: `${now.toLocaleDateString('vi-VN')} ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
    };

    return { bl: localBLs[index], doNumber, deliveryOrder: newDO };
  },
};
